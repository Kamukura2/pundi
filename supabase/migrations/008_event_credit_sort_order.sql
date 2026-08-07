-- CVFinance v7.5.0: persistent ordering plus automatic monthly client-payment rollover.
-- Additive migration. No financial records are deleted.

alter table public.planned_events
  add column if not exists sort_order integer not null default 0;

alter table public.credit_items
  add column if not exists sort_order integer not null default 0;

alter table public.clients
  add column if not exists tracking_month text;

alter table public.clients
  drop constraint if exists clients_tracking_month_check;

alter table public.clients
  add constraint clients_tracking_month_check check (tracking_month is null or tracking_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

update public.clients
set tracking_month = to_char(timezone('Asia/Jakarta', now()), 'YYYY-MM')
where tracking_month is null;

with ranked as (
  select id, row_number() over (partition by user_id order by event_date, created_at, id) - 1 as position
  from public.planned_events
)
update public.planned_events as item
set sort_order = ranked.position
from ranked
where item.id = ranked.id and item.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by user_id, is_paid order by due_date, created_at, id) - 1 as position
  from public.credit_items
)
update public.credit_items as item
set sort_order = ranked.position
from ranked
where item.id = ranked.id and item.sort_order = 0;

create index if not exists events_user_order_idx
  on public.planned_events(user_id, sort_order);

create index if not exists credit_items_user_paid_order_idx
  on public.credit_items(user_id, is_paid, sort_order);
