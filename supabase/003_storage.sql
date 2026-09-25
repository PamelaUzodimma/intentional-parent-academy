-- =====================================================================
-- Storage: payment-receipts bucket
-- Private bucket — parents can upload but not list/read each other's
-- receipts; only academy_admin can view them (needed to verify transfers).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

-- Anyone (including anonymous checkout sessions) can upload a receipt —
-- there's no login requirement for parents in the MVP. Uploads are
-- namespaced by order_number as the folder, e.g. IPA-2026-000001/receipt.jpg
create policy "Anyone can upload a payment receipt"
  on storage.objects for insert
  with check (bucket_id = 'payment-receipts');

-- Only academy_admin can read receipts back (used by the verification queue).
create policy "Admins can view payment receipts"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'academy_admin'
    )
  );

-- Nobody can overwrite or delete an uploaded receipt from the client —
-- these are evidence records. Admin corrections happen via the service
-- role key server-side only, if ever needed.
