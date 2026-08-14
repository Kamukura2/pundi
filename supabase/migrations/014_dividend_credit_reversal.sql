-- CVFinance v8.0.1: auditable and reversible Investment dividend credits.
-- Additive only. Existing credited records remain compatible.

begin;

alter table public.investment_dividends
  add column if not exists credited_amount_native numeric(28,10) not null default 0 check (credited_amount_native >= 0),
  add column if not exists credited_currency text check (credited_currency is null or credited_currency in ('IDR','USD')),
  add column if not exists credit_reversed_at timestamptz;

create index if not exists investment_dividends_user_credited_idx
  on public.investment_dividends(user_id, credited_at desc)
  where credited_at is not null;

commit;
