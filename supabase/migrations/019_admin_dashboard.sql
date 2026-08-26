-- Pundi Phase 2: owner/admin metadata and billing-neutral entitlements.
-- Forward-only. No finance rows are read or modified by this schema.

begin;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'free' check (status in ('free','trialing','active','past_due','cancelled','expired')),
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  started_at timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlement_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('core_finance','cloud_sync','advanced_insights','export','premium_features')),
  enabled boolean not null,
  reason text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('set_plan','set_entitlement','refresh_metadata')),
  before_metadata jsonb not null default '{}'::jsonb,
  after_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- These tables are server-managed. Browser clients have no direct grants.
do $$
declare table_name text;
begin
  foreach table_name in array ARRAY['app_admins','subscriptions','entitlement_overrides','admin_audit_log']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;

create index if not exists subscriptions_status_idx on public.subscriptions(status, updated_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_log(target_user_id, created_at desc);
create index if not exists admin_audit_admin_idx on public.admin_audit_log(admin_user_id, created_at desc);

commit;
