-- CVFinance v8.0.0: confirmed Investment dividends and entitlement lifecycle.
-- Additive only. Trading and existing Investment holdings remain unchanged.

begin;

create table if not exists public.investment_dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.stock_holdings(id) on delete cascade,
  event_key text not null,
  ticker text not null,
  dividend_type text not null default 'regular' check (dividend_type in ('interim','final','regular','special')),
  currency text not null check (currency in ('IDR','USD')),
  amount_per_share numeric(24,10) not null default 0 check (amount_per_share >= 0),
  eligible_shares numeric(28,10) not null default 0 check (eligible_shares >= 0),
  announcement_date date,
  ex_date date,
  record_date date,
  payment_date date,
  dividend_status text not null default 'confirmed' check (dividend_status in ('announced','confirmed','receivable','paid','cancelled')),
  eligibility_status text not null default 'pending' check (eligibility_status in ('pending','review','locked')),
  source_provider text not null default 'manual',
  source_url text not null default '',
  is_manual boolean not null default false,
  fx_rate numeric(20,6) not null default 0 check (fx_rate >= 0),
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, holding_id, event_key)
);

drop trigger if exists set_updated_at on public.investment_dividends;
create trigger set_updated_at before update on public.investment_dividends for each row execute function public.set_updated_at();

alter table public.investment_dividends enable row level security;
alter table public.investment_dividends force row level security;
drop policy if exists investment_dividends_select_own on public.investment_dividends;
drop policy if exists investment_dividends_insert_own on public.investment_dividends;
drop policy if exists investment_dividends_update_own on public.investment_dividends;
drop policy if exists investment_dividends_delete_own on public.investment_dividends;
create policy investment_dividends_select_own on public.investment_dividends for select to authenticated using ((select auth.uid()) = user_id);
create policy investment_dividends_insert_own on public.investment_dividends for insert to authenticated with check ((select auth.uid()) = user_id);
create policy investment_dividends_update_own on public.investment_dividends for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy investment_dividends_delete_own on public.investment_dividends for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.investment_dividends from anon;
grant select, insert, update, delete on public.investment_dividends to authenticated;

create index if not exists investment_dividends_user_year_idx on public.investment_dividends(user_id, payment_date desc);
create index if not exists investment_dividends_holding_idx on public.investment_dividends(holding_id);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='investment_dividends') then
    alter publication supabase_realtime add table public.investment_dividends;
  end if;
end $$;

commit;
