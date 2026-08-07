begin;

-- Records created by Telegram remain ordinary CVFinance records. These nullable
-- columns only provide source visibility and idempotency for webhook retries.
alter table public.transactions
  add column if not exists source text not null default 'app',
  add column if not exists telegram_update_id bigint;

alter table public.credit_items
  add column if not exists source_origin text not null default 'app',
  add column if not exists telegram_update_id bigint;

alter table public.electricity_readings
  add column if not exists source text not null default 'app',
  add column if not exists telegram_update_id bigint;

create unique index if not exists transactions_telegram_update_unique
  on public.transactions(user_id, telegram_update_id)
  where telegram_update_id is not null;

create unique index if not exists credit_items_telegram_update_unique
  on public.credit_items(user_id, telegram_update_id)
  where telegram_update_id is not null;

create unique index if not exists electricity_telegram_update_unique
  on public.electricity_readings(user_id, telegram_update_id)
  where telegram_update_id is not null;

-- Vercel instances are ephemeral, so multi-step Telegram conversations live
-- here instead of process memory. The browser app never reads this table.
create table if not exists public.telegram_cvfinance_states (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  state jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, telegram_user_id, telegram_chat_id)
);

-- Telegram retries webhook deliveries. Claiming update_id prevents duplicate
-- financial writes while retaining only minimal, non-financial diagnostics.
create table if not exists public.telegram_cvfinance_updates (
  update_id bigint primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  update_kind text not null,
  status text not null check (status in ('processing','completed','failed','ignored')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.telegram_cvfinance_states;
create trigger set_updated_at
before update on public.telegram_cvfinance_states
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.telegram_cvfinance_updates;
create trigger set_updated_at
before update on public.telegram_cvfinance_updates
for each row execute function public.set_updated_at();

create index if not exists telegram_cvfinance_states_expiry_idx
  on public.telegram_cvfinance_states(owner_user_id, expires_at);

create index if not exists telegram_cvfinance_updates_owner_created_idx
  on public.telegram_cvfinance_updates(owner_user_id, created_at desc);

alter table public.telegram_cvfinance_states enable row level security;
alter table public.telegram_cvfinance_states force row level security;
alter table public.telegram_cvfinance_updates enable row level security;
alter table public.telegram_cvfinance_updates force row level security;

-- Only the server-side secret/service-role client may access bot state.
revoke all on public.telegram_cvfinance_states from anon, authenticated;
revoke all on public.telegram_cvfinance_updates from anon, authenticated;
grant select, insert, update, delete on public.telegram_cvfinance_states to service_role;
grant select, insert, update, delete on public.telegram_cvfinance_updates to service_role;

commit;
