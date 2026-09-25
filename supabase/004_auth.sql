-- =====================================================================
-- Auth wiring
-- =====================================================================

alter table profiles enable row level security;

-- Every signed-in user must be able to read their own role — this is
-- what proxy.ts (middleware) checks on every /admin request.
create policy "Users can read their own profile"
  on profiles for select
  using (id = auth.uid());

-- Academy admins can see and manage everyone's profile (needed to
-- promote someone to academy_admin or payment_verifier).
create policy "Admins manage all profiles"
  on profiles for all
  using (current_role_is('academy_admin'));

-- Auto-create a profiles row whenever someone signs up via Supabase Auth.
-- Defaults to 'parent' — promote to 'academy_admin' or 'payment_verifier'
-- manually (see notes below); there is no self-serve upgrade path.
-- Note: parents checking out at /order don't need an account at all —
-- this trigger only matters for people who actually sign in at /login.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, full_name)
  values (new.id, 'parent', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- HOW TO CREATE YOUR FIRST ADMIN ACCOUNT
-- =====================================================================
-- 1. Sign up normally through /login (Supabase Auth → "sign up" flow,
--    or create the user directly in the Supabase Dashboard → Authentication).
-- 2. Run this, with the email you signed up with:
--
--    update profiles set role = 'academy_admin'
--    where id = (select id from auth.users where email = 'you@example.com');
--
-- =====================================================================
-- HOW TO GRANT SOMEONE PAYMENT-VERIFIER ACCESS (max 5 — enforced by a
-- trigger in 001_schema.sql; the 6th grant will raise an error)
-- =====================================================================
-- Same pattern — they sign up at /login first, then:
--
--    update profiles set role = 'payment_verifier'
--    where id = (select id from auth.users where email = 'verifier@example.com');
--
-- A payment_verifier can only reach /admin/payments — every other
-- /admin route still requires academy_admin (enforced in proxy.ts).
-- To revoke access, set their role back to 'parent':
--
--    update profiles set role = 'parent'
--    where id = (select id from auth.users where email = 'verifier@example.com');

-- =====================================================================
-- Admin-facing team management (used by /admin/team)
-- =====================================================================
-- profiles has no email column (that lives in auth.users), and the
-- REST API can't query auth.users directly — these SECURITY DEFINER
-- functions are the sanctioned, admin-gated way to look someone up by
-- email and grant/revoke academy_admin or payment_verifier, and to
-- list who currently holds each role.

create or replace function admin_set_role(target_email text, new_role user_role)
returns void as $$
declare
  target_id uuid;
begin
  if not current_role_is('academy_admin') then
    raise exception 'Not authorized';
  end if;

  select id into target_id from auth.users where email = target_email;
  if target_id is null then
    raise exception 'No account found for %. They must sign up at /login first.', target_email;
  end if;

  insert into profiles (id, role) values (target_id, new_role)
    on conflict (id) do update set role = excluded.role;
end;
$$ language plpgsql security definer;

create or replace function list_team()
returns table (id uuid, email text, role user_role) as $$
begin
  if not current_role_is('academy_admin') then
    raise exception 'Not authorized';
  end if;

  return query
    select p.id, u.email::text, p.role
    from profiles p
    join auth.users u on u.id = p.id
    where p.role in ('academy_admin', 'payment_verifier')
    order by p.role, u.email;
end;
$$ language plpgsql security definer;
