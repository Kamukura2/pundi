-- CVFinance v7.4.0: monthly progress, drag ordering, and language preference.
-- Additive migration. No financial records are deleted.

alter table public.monthly_budgets
  add column if not exists payment_status text not null default 'auto',
  add column if not exists paid_amount numeric(20,2) not null default 0,
  add column if not exists tracking_month text;

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_payment_status_check,
  drop constraint if exists monthly_budgets_paid_amount_check,
  drop constraint if exists monthly_budgets_tracking_month_check;

alter table public.monthly_budgets
  add constraint monthly_budgets_payment_status_check check (payment_status in ('auto','partial','done')),
  add constraint monthly_budgets_paid_amount_check check (paid_amount >= 0),
  add constraint monthly_budgets_tracking_month_check check (tracking_month is null or tracking_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table public.yearly_expenses
  add column if not exists sort_order integer not null default 0;

alter table public.clients
  add column if not exists sort_order integer not null default 0;

update public.clients set status = 'pending' where status = 'freeze';

alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check check (status in ('paid','pending'));

alter table public.app_settings
  add column if not exists language text not null default 'en';

alter table public.app_settings
  drop constraint if exists app_settings_language_check;

alter table public.app_settings
  add constraint app_settings_language_check check (language in ('en','id'));

create index if not exists clients_user_type_order_idx
  on public.clients(user_id, client_type, sort_order);

create index if not exists yearly_user_order_idx
  on public.yearly_expenses(user_id, sort_order);
