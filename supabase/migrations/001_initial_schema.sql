begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, account_type text not null check (account_type in ('Cash','Bank','Wallet')),
  balance numeric(20,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income','expense')),
  amount numeric(20,2) not null check (amount >= 0), description text not null,
  category text not null, channel text not null, transaction_date date not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, monthly_amount numeric(20,2) not null check (monthly_amount >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.yearly_expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, amount numeric(20,2) not null check (amount >= 0), payment_month text not null, category text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.planned_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, amount numeric(20,2) not null check (amount >= 0), event_date date not null, category text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.credit_facilities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source text not null, limit_amount numeric(20,2) not null default 0 check (limit_amount >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, source)
);

create table if not exists public.credit_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references public.credit_facilities(id) on delete set null,
  source text not null, description text not null, amount numeric(20,2) not null check (amount >= 0),
  due_date date not null, is_paid boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, monthly_retainer numeric(20,2) not null default 0,
  paid_this_month numeric(20,2) not null default 0, previous_outstanding numeric(20,2) not null default 0,
  status text not null check (status in ('paid','pending','freeze')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.stock_holdings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  display_symbol text not null, market text not null, provider text not null check (provider in ('finnhub','twelvedata')),
  provider_symbol text not null, currency text not null check (currency in ('IDR','USD')),
  quantity numeric(28,10) not null default 0, avg_purchase_price numeric(20,6) not null default 0,
  current_price numeric(20,6) not null default 0, manual_current_price numeric(20,6),
  price_source text not null default 'manual', price_status text not null default 'manual',
  price_as_of timestamptz, last_price_fetch_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, display_symbol, market)
);

create table if not exists public.stock_price_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.stock_holdings(id) on delete cascade,
  scenario text not null check (scenario in ('base','optimistic')),
  target_year smallint not null check (target_year between 2027 and 2100),
  target_price numeric(20,6) not null check (target_price >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, holding_id, scenario, target_year)
);

create table if not exists public.electricity_readings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null, reading_time time not null, remaining_kwh numeric(20,4) not null check (remaining_kwh >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  base_mode text not null default 'manual' check (base_mode in ('manual','auto')),
  optimistic_mode text not null default 'manual' check (optimistic_mode in ('manual','auto')),
  base_growth numeric(8,3) not null default 8, optimistic_growth numeric(8,3) not null default 14,
  usd_idr numeric(20,4) not null default 16250, rate_kwh numeric(20,4) not null default 1740,
  legacy_import_completed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','accounts','transactions','monthly_budgets','yearly_expenses','planned_events','credit_facilities','credit_items','clients','stock_holdings','stock_price_targets','electricity_readings','app_settings']
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

create index if not exists accounts_user_idx on public.accounts(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists budgets_user_idx on public.monthly_budgets(user_id);
create index if not exists yearly_user_idx on public.yearly_expenses(user_id);
create index if not exists events_user_date_idx on public.planned_events(user_id, event_date);
create index if not exists credit_items_user_due_idx on public.credit_items(user_id, is_paid, due_date);
create index if not exists clients_user_status_idx on public.clients(user_id, status);
create index if not exists holdings_user_idx on public.stock_holdings(user_id);
create index if not exists holdings_provider_idx on public.stock_holdings(provider, provider_symbol, market);
create index if not exists targets_holding_idx on public.stock_price_targets(user_id, holding_id, scenario, target_year);
create index if not exists electricity_user_time_idx on public.electricity_readings(user_id, reading_date, reading_time);

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;

commit;
