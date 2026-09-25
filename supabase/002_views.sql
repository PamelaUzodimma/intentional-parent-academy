-- =====================================================================
-- Views powering the Academy dashboard (PRD §21, §25, §23)
-- =====================================================================

-- Distributor demand: sum of quantities for PAID orders, grouped by
-- the distributor the parent selected.
create or replace view distributor_demand as
select
  d.id as distributor_id,
  d.name,
  d.city,
  d.country,
  count(o.id) as order_count,
  coalesce(sum(o.quantity), 0) as packages_required
from distributors d
left join orders o
  on o.distributor_id = d.id
  and o.payment_status = 'successful'
group by d.id, d.name, d.city, d.country
order by packages_required desc;

-- Main dashboard overview (PRD §21)
create or replace view academy_overview as
select
  (select coalesce(sum(total_amount), 0) from orders where payment_status = 'successful') as total_revenue,
  (select count(*) from orders where payment_status = 'successful') as total_paid_orders,
  (select coalesce(sum(quantity), 0) from orders where payment_status = 'successful') as total_packages_ordered,
  (select count(*) from orders where payment_status = 'pending') as pending_payments,
  (select count(*) from distributors where status = 'active') as active_distributors,
  (select count(*) from orders where fulfilment_status = 'awaiting_books') as awaiting_books,
  (select count(*) from orders where fulfilment_status in ('allocated_to_distributor','books_dispatched','in_transit','received_by_distributor','ready_for_fulfilment','out_for_delivery','delivered')) as allocated_to_distributors,
  (select count(*) from orders where fulfilment_status = 'in_transit') as in_transit,
  (select count(*) from orders where fulfilment_status in ('received_by_distributor','ready_for_fulfilment','out_for_delivery','delivered')) as received_by_distributors,
  (select count(*) from orders where fulfilment_status = 'delivered') as delivered,
  (select count(*) from orders where fulfilment_status in ('delivery_issue','address_issue','distributor_issue','missing_books','damaged_books')) as exceptions;
