-- CVFinance v7.3.0: client lifecycle separation and yearly payment tracking.
-- Additive only: existing clients remain recurring and no financial rows are removed.

alter table public.clients
  add column if not exists client_type text not null default 'recurring';

alter table public.clients
  drop constraint if exists clients_client_type_check;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('recurring','ending'));

alter table public.clients
  add column if not exists ending_paid boolean not null default false;

alter table public.yearly_expenses
  add column if not exists last_paid_year smallint;

alter table public.yearly_expenses
  drop constraint if exists yearly_expenses_last_paid_year_check;

alter table public.yearly_expenses
  add constraint yearly_expenses_last_paid_year_check
  check (last_paid_year is null or last_paid_year between 2000 and 2100);

create index if not exists clients_user_type_status_idx
  on public.clients(user_id, client_type, status);

