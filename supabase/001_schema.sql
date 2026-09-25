-- =====================================================================
-- Intentional Parent Academy — 7-in-1 Book Ordering & Distribution
-- Core schema (Supabase / Postgres)
-- =====================================================================
-- Design notes:
--   * The `orders` row is the spine of the whole system (PRD §37).
--   * payment_status and fulfilment_status are tracked SEPARATELY (PRD §18).
--   * order_id is human-readable + sequential: IPA-2026-000001 (PRD §17).
--   * Every state-changing action writes to audit_logs (PRD §38).
--   * RLS enforces 3 roles: parent (self-serve checkout), academy_admin
--     (full backend), payment_verifier (payments screen only — up to 5
--     people, enforced by trigger below). Distributors are records the
--     Academy manages; they have no login (see PRD conversation).
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------

create type user_role as enum ('parent', 'academy_admin', 'payment_verifier');

create type payment_status as enum (
  'pending', 'successful', 'failed', 'cancelled', 'refunded'
);

create type fulfilment_status as enum (
  'draft',
  'pending_payment',
  'paid',
  'awaiting_books',
  'allocated_to_distributor',
  'books_dispatched',
  'in_transit',
  'received_by_distributor',
  'ready_for_fulfilment',
  'out_for_delivery',
  'delivered',
  -- exception states
  'delivery_issue',
  'address_issue',
  'distributor_issue',
  'missing_books',
  'damaged_books'
);

create type distributor_status as enum (
  'active', 'temporarily_unavailable', 'inactive', 'pending_review'
);

create type shipment_status as enum (
  'preparing', 'dispatched', 'in_transit', 'delivered', 'discrepancy_reported'
);

-- ---------------------------------------------------------------------
-- USERS  (extends Supabase auth.users)
-- ---------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'parent',
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DISTRIBUTORS
-- ---------------------------------------------------------------------

create table distributors (
  id uuid primary key default uuid_generate_v4(),
  -- No login account — distributors don't get backend access. The
  -- Academy manages this record and shares each distributor's pickup
  -- list with them manually (see /admin/distributors/[id] export).
  name text not null,
  business_name text,
  country text not null,
  state_region text,
  city text,
  address text,
  phone text,
  email text,
  notes text,
  status distributor_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table distributor_service_areas (
  id uuid primary key default uuid_generate_v4(),
  distributor_id uuid not null references distributors(id) on delete cascade,
  country text not null,
  state_region text,   -- null = whole country
  city text            -- null = whole state/region
);

create index idx_service_areas_location
  on distributor_service_areas (country, state_region, city);

-- ---------------------------------------------------------------------
-- PRODUCTS  (kept generic in case the Academy adds more bundles later)
-- ---------------------------------------------------------------------

create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,               -- e.g. "7-in-1 Book Package"
  unit_price numeric(12,2) not null,-- e.g. 49500.00
  currency text not null default 'NGN',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CUSTOMERS (parents)
-- ---------------------------------------------------------------------

create table customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),   -- optional login account
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  whatsapp_number text,
  country text not null,
  state_region text,
  city text,
  delivery_address text not null,
  postal_code text,
  delivery_instructions text,
  created_at timestamptz not null default now()
);

create index idx_customers_email on customers (email);
create index idx_customers_phone on customers (phone);

-- ---------------------------------------------------------------------
-- ORDERS  — the spine of the system
-- ---------------------------------------------------------------------

create sequence order_number_seq start 1;

create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,       -- IPA-2026-000001, generated by trigger
  customer_id uuid not null references customers(id),
  distributor_id uuid references distributors(id),  -- parent's SELECTED distributor
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  currency text not null default 'NGN',

  payment_status payment_status not null default 'pending',
  fulfilment_status fulfilment_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer on orders (customer_id);
create index idx_orders_distributor on orders (distributor_id);
create index idx_orders_payment_status on orders (payment_status);
create index idx_orders_fulfilment_status on orders (fulfilment_status);

-- Auto-generate order_number as IPA-<year>-000001
create or replace function generate_order_number()
returns trigger as $$
begin
  new.order_number := 'IPA-' || extract(year from now())::text || '-' ||
                       lpad(nextval('order_number_seq')::text, 6, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_orders_number
  before insert on orders
  for each row
  when (new.order_number is null)
  execute function generate_order_number();

-- ---------------------------------------------------------------------
-- ORDER ITEMS  (line items — keeps room for multiple products later)
-- ---------------------------------------------------------------------

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

-- ---------------------------------------------------------------------
-- DISTRIBUTOR REASSIGNMENT HISTORY (PRD §34 — must be auditable)
-- ---------------------------------------------------------------------

create table distributor_reassignments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  old_distributor_id uuid references distributors(id),
  new_distributor_id uuid references distributors(id),
  changed_by uuid references profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------

create table payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,              -- 'bank_transfer' | 'paystack' | 'flutterwave' | ...
  transaction_reference text not null unique,  -- for bank_transfer this = order_number; prevents dupes (PRD §39)
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  status payment_status not null default 'pending',
  paid_at timestamptz,
  raw_provider_payload jsonb,

  -- Manual bank-transfer verification fields
  proof_url text,                      -- parent-uploaded receipt/screenshot (Supabase Storage path)
  parent_claimed_at timestamptz,       -- when parent said "I've made the transfer"
  verified_by uuid references profiles(id),  -- admin who confirmed it against the bank statement
  verified_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now()
);

create index idx_payments_order on payments (order_id);
create unique index idx_payments_ref on payments (transaction_reference);

-- ---------------------------------------------------------------------
-- ACADEMY BANK ACCOUNTS  (shown to parents at checkout; admin-editable
-- so the account can change without a code deploy)
-- ---------------------------------------------------------------------

create table academy_bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  bank_name text not null,          -- e.g. "Azenith Bank"
  account_name text not null,
  account_number text not null,
  currency text not null default 'NGN',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INVENTORY  (Academy's own book stock)
-- ---------------------------------------------------------------------

create table inventory (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  quantity_on_hand int not null default 0,
  updated_at timestamptz not null default now()
);

create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  inventory_id uuid not null references inventory(id),
  change int not null,              -- positive = stock in, negative = stock out
  reason text not null,             -- 'restock', 'allocation', 'correction', ...
  reference_id uuid,                -- e.g. book_allocation id
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- BOOK ALLOCATIONS  (demand calculated automatically from paid orders)
-- ---------------------------------------------------------------------

create table book_allocations (
  id uuid primary key default uuid_generate_v4(),
  distributor_id uuid not null references distributors(id),
  packages_required int not null,   -- computed: sum(orders.quantity) where paid + this distributor
  packages_allocated int not null default 0,
  status text not null default 'pending',  -- pending | partially_allocated | allocated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SHIPMENTS  (can bundle multiple distributor allocations)
-- ---------------------------------------------------------------------

create table shipments (
  id uuid primary key default uuid_generate_v4(),
  shipment_code text not null unique,   -- e.g. SHP-CA-2026-001
  destination_country text not null,
  dispatch_date date,
  status shipment_status not null default 'preparing',
  created_at timestamptz not null default now()
);

create table shipment_items (
  id uuid primary key default uuid_generate_v4(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  distributor_id uuid not null references distributors(id),
  book_allocation_id uuid references book_allocations(id),
  packages_expected int not null,
  packages_received int,
  packages_damaged int default 0,
  received_at timestamptz,
  discrepancy_notes text
);

-- ---------------------------------------------------------------------
-- DELIVERIES  (distributor → parent, final leg)
-- ---------------------------------------------------------------------

create table deliveries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  distributor_id uuid not null references distributors(id),
  status text not null default 'not_ready',  -- not_ready | ready | out_for_delivery | delivered | issue
  delivered_at timestamptz,
  issue_notes text,
  created_at timestamptz not null default now()
);

create table delivery_events (
  id uuid primary key default uuid_generate_v4(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  event_type text not null,   -- matches the order timeline in PRD §31
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid references profiles(id),
  order_id uuid references orders(id),
  channel text not null,     -- 'email' | 'sms' | 'whatsapp'
  message text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AUDIT LOGS  (PRD §38 — required for every state-changing action)
-- ---------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  entity_type text not null,   -- 'order' | 'payment' | 'distributor' | 'shipment' ...
  entity_id uuid not null,
  action text not null,        -- 'status_changed' | 'distributor_reassigned' | ...
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_audit_entity on audit_logs (entity_type, entity_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table customers enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table deliveries enable row level security;
alter table distributors enable row level security;
alter table book_allocations enable row level security;
alter table shipments enable row level security;
alter table shipment_items enable row level security;
alter table academy_bank_accounts enable row level security;

-- helper: current user's role
create or replace function current_role_is(r user_role)
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = r
  );
$$ language sql stable;

-- Bank account details are public info shown at checkout (read-only for everyone)
create policy public_read_bank_accounts on academy_bank_accounts for select
  using (is_active = true);
create policy admin_manage_bank_accounts on academy_bank_accounts for all
  using (current_role_is('academy_admin'));

-- helper: admin OR payment_verifier (payments screen is shared by both)
create or replace function can_verify_payments()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('academy_admin', 'payment_verifier')
  );
$$ language sql stable;

-- Enforce "up to 5 people" for the payment_verifier role at the data
-- layer, not just in whatever UI grants it.
create or replace function enforce_verifier_cap()
returns trigger as $$
begin
  if new.role = 'payment_verifier' then
    if (select count(*) from profiles where role = 'payment_verifier' and id <> new.id) >= 5 then
      raise exception 'Maximum of 5 payment verifiers already granted';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_verifier_cap
  before insert or update of role on profiles
  for each row execute function enforce_verifier_cap();

-- Academy admins: full access everywhere
create policy admin_full_orders on orders for all
  using (current_role_is('academy_admin'));
create policy admin_full_customers on customers for all
  using (current_role_is('academy_admin'));
create policy admin_full_distributors on distributors for all
  using (current_role_is('academy_admin'));
create policy admin_full_allocations on book_allocations for all
  using (current_role_is('academy_admin'));
create policy admin_full_shipments on shipments for all
  using (current_role_is('academy_admin'));
create policy admin_full_shipment_items on shipment_items for all
  using (current_role_is('academy_admin'));
create policy admin_full_deliveries on deliveries for all
  using (current_role_is('academy_admin'));

-- Payments: admin has full access; payment_verifier can read pending
-- transfers and the order/customer context needed to verify them, but
-- can only ever flip status via the /api/admin/payments/verify route
-- (which itself re-checks the role server-side before writing).
create policy admin_full_payments on payments for all
  using (current_role_is('academy_admin'));
create policy verifier_read_payments on payments for select
  using (can_verify_payments());
create policy verifier_read_orders_for_payments on orders for select
  using (can_verify_payments());
create policy verifier_read_customers_for_payments on customers for select
  using (can_verify_payments());

-- Anyone checking out (parent or distributor, ordering the same way)
-- can see the active distributor list to pick a collection point, and
-- create their own customer + order rows. No login required.
create policy public_read_active_distributors on distributors for select
  using (status = 'active');
create policy public_can_place_order on customers for insert
  with check (true);
create policy public_can_view_own_customer on customers for select
  using (user_id = auth.uid());
create policy public_own_orders on orders for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );
create policy public_own_payments on payments for select
  using (
    order_id in (
      select o.id from orders o
      join customers c on c.id = o.customer_id
      where c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- SEED: the one product this launches with, and the bank account
-- shown to parents at checkout. Update account_number before launch.
-- =====================================================================

insert into products (name, unit_price, currency)
values ('7-in-1 Book Package', 49500.00, 'NGN');

insert into academy_bank_accounts (bank_name, account_name, account_number, currency)
values ('Zenith Bank', 'The Intentional Parent Academy Book Distribution Account', '1228631120', 'NGN');
