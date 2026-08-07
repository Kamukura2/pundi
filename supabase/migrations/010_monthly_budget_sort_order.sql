-- CVFinance v7.5.2: persistent ordering for Monthly Budgets.
-- Additive migration. Existing budget records and values are preserved.

begin;

alter table public.monthly_budgets
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at, id) - 1 as position
  from public.monthly_budgets
)
update public.monthly_budgets as budget
set sort_order = ranked.position
from ranked
where budget.id = ranked.id and budget.sort_order = 0;

create index if not exists monthly_budgets_user_order_idx
  on public.monthly_budgets(user_id, sort_order);

commit;
