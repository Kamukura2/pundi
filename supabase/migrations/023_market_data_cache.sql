-- V3.2 market-data cache only. No user or financial rows are stored here.
create table if not exists public.market_data_cache (
  cache_key text primary key check (char_length(cache_key) between 1 and 160),
  payload jsonb not null,
  provider text not null check (char_length(provider) between 1 and 64),
  normalized_symbol text not null check (char_length(normalized_symbol) between 1 and 64),
  currency text not null check (currency in ('IDR','USD','USDT','USDC','FDUSD')),
  quote_status text not null check (quote_status in ('LIVE','DELAYED','FALLBACK','STALE','OFFLINE')),
  quote_as_of timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.market_data_cache enable row level security;
revoke all on table public.market_data_cache from anon, authenticated;
grant select, insert, update, delete on table public.market_data_cache to service_role;

create index if not exists market_data_cache_expiry_idx
  on public.market_data_cache (expires_at);
