-- Pundi Commerce v1: server-owned Midtrans orders and account entitlements.
-- Target only: Pundi / ndeycwoyjwyntjkgbzlz.
-- No finance tables are modified and no data crosses product boundaries.

begin;

create extension if not exists pgcrypto;

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null default 'PUNDI' check (product_code = 'PUNDI'),
  sku text not null,
  expected_amount bigint not null check (expected_amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  provider text not null default 'midtrans' check (provider = 'midtrans'),
  provider_order_id text not null unique check (provider_order_id like 'PUNDI-%'),
  provider_transaction_id text,
  status text not null default 'created' check (status in ('created','pending','settlement','capture','deny','cancel','expire','refund','partial_refund','chargeback','provider_error','rejected','unknown')),
  payment_type text,
  purchase_type text not null default 'lifetime' check (purchase_type in ('lifetime','recurring','expiring')),
  duration_days integer check (duration_days is null or duration_days > 0),
  entitlement_code text not null,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_events (
  id uuid primary key default gen_random_uuid(),
  provider_order_id text not null references public.commerce_orders(provider_order_id) on delete cascade,
  provider_status text not null,
  provider_transaction_id text,
  status_code text,
  gross_amount text,
  currency text,
  dedupe_key text not null unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text
);

create table if not exists public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null default 'PUNDI' check (product_code = 'PUNDI'),
  sku text not null,
  plan_code text not null,
  status text not null default 'inactive' check (status in ('active','inactive','refunded','revoked','expired')),
  source text not null check (source in ('midtrans_web','google_play','promo','admin')),
  starts_at timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  provider_order_id text unique references public.commerce_orders(provider_order_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_orders_user_created_idx on public.commerce_orders(user_id, created_at desc);
create index if not exists commerce_orders_status_idx on public.commerce_orders(status, updated_at desc);
create index if not exists commerce_events_order_idx on public.commerce_events(provider_order_id, received_at desc);
create index if not exists commerce_entitlements_user_idx on public.commerce_entitlements(user_id, status, expires_at);

create or replace function public.commerce_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists commerce_orders_updated_at on public.commerce_orders;
create trigger commerce_orders_updated_at before update on public.commerce_orders for each row execute function public.commerce_set_updated_at();
drop trigger if exists commerce_entitlements_updated_at on public.commerce_entitlements;
create trigger commerce_entitlements_updated_at before update on public.commerce_entitlements for each row execute function public.commerce_set_updated_at();

alter table public.commerce_orders enable row level security;
alter table public.commerce_orders force row level security;
alter table public.commerce_events enable row level security;
alter table public.commerce_events force row level security;
alter table public.commerce_entitlements enable row level security;
alter table public.commerce_entitlements force row level security;

drop policy if exists commerce_orders_select_own on public.commerce_orders;
create policy commerce_orders_select_own on public.commerce_orders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists commerce_entitlements_select_own on public.commerce_entitlements;
create policy commerce_entitlements_select_own on public.commerce_entitlements for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.commerce_orders from anon, authenticated;
revoke all on public.commerce_events from anon, authenticated;
revoke all on public.commerce_entitlements from anon, authenticated;
grant select on public.commerce_orders to authenticated;
grant select on public.commerce_entitlements to authenticated;
grant all on public.commerce_orders to service_role;
grant all on public.commerce_events to service_role;
grant all on public.commerce_entitlements to service_role;

-- The existing client entitlement resolver reads this row. It remains the
-- compatibility projection; commerce_entitlements is the auditable source.
alter table public.subscriptions add column if not exists entitlement_source text;
alter table public.subscriptions add column if not exists entitlement_sku text;
alter table public.subscriptions add column if not exists entitlement_expires_at timestamptz;
alter table public.subscriptions add column if not exists entitlement_provider_order_id text;

commit;
