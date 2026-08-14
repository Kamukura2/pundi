-- CVFinance v7.8.0: isolated active-trading portfolio, ledger and daily performance snapshots.
-- Additive only. Existing Investment holdings and all financial modules are unchanged.

begin;

create table if not exists public.trading_positions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  display_symbol text not null, market text not null check (market in ('NASDAQ','NYSE','AMEX')),
  provider_symbol text not null, currency text not null check (currency in ('USD','IDR')),
  quantity numeric(28,10) not null default 0 check (quantity >= 0),
  avg_purchase_price numeric(20,6) not null default 0 check (avg_purchase_price >= 0),
  current_price numeric(20,6) not null default 0 check (current_price >= 0),
  manual_current_price numeric(20,6) not null default 0 check (manual_current_price >= 0),
  target_price numeric(20,6) not null default 0 check (target_price >= 0),
  stop_loss_price numeric(20,6) not null default 0 check (stop_loss_price >= 0),
  price_source text not null default 'manual', price_status text not null default 'manual',
  price_as_of timestamptz, last_price_fetch_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, display_symbol, market)
);

create table if not exists public.trading_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid references public.trading_positions(id) on delete set null,
  entry_type text not null check (entry_type in ('opening','deposit','withdraw','buy','sell')),
  ticker text not null default '', quantity numeric(28,10) not null default 0,
  execution_price numeric(20,6) not null default 0, currency text not null check (currency in ('USD','IDR')),
  fx_rate numeric(20,6) not null default 0, cash_delta_idr numeric(24,6) not null default 0,
  cash_delta_usd numeric(24,8) not null default 0, external_flow_idr numeric(24,6) not null default 0,
  realized_pl_idr numeric(24,6) not null default 0, trade_date date not null, note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.trading_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null, equity_idr numeric(24,6) not null default 0,
  net_contributions_idr numeric(24,6) not null default 0, holdings_value_idr numeric(24,6) not null default 0,
  cash_value_idr numeric(24,6) not null default 0, spy_price numeric(20,6) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['trading_positions','trading_ledger','trading_snapshots']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

create index if not exists trading_positions_user_idx on public.trading_positions(user_id);
create index if not exists trading_ledger_user_date_idx on public.trading_ledger(user_id, trade_date desc, created_at desc);
create index if not exists trading_snapshots_user_date_idx on public.trading_snapshots(user_id, snapshot_date);

do $$
declare table_name text;
begin
  foreach table_name in array array['trading_positions','trading_ledger','trading_snapshots']
  loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

commit;
