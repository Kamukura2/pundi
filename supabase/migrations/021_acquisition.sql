-- Pundi Acquisition v1: minimal first-party attribution and CTA intent.
-- Forward-only additive schema. No finance data is stored or modified.
begin;
create table if not exists public.user_acquisition (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null default 'direct' check (source in ('google','reddit','facebook','linkedin','whatsapp','friend','community','organic','direct','other')),
  landing_path text not null default '/' check (char_length(landing_path) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.acquisition_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('cta_click')),
  source text not null check (source in ('google','reddit','facebook','linkedin','whatsapp','friend','community','organic','direct','other')),
  landing_path text not null check (char_length(landing_path) between 1 and 200),
  cta text not null check (char_length(cta) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists acquisition_events_created_idx on public.acquisition_events(created_at desc);
create index if not exists acquisition_events_source_idx on public.acquisition_events(source, created_at desc);
create index if not exists acquisition_events_landing_idx on public.acquisition_events(landing_path, created_at desc);
alter table public.user_acquisition enable row level security;
alter table public.user_acquisition force row level security;
alter table public.acquisition_events enable row level security;
alter table public.acquisition_events force row level security;
revoke all on public.user_acquisition, public.acquisition_events from anon, authenticated;
grant all on public.user_acquisition, public.acquisition_events to service_role;
drop policy if exists user_acquisition_select_own on public.user_acquisition;
create policy user_acquisition_select_own on public.user_acquisition for select to authenticated using ((select auth.uid()) = user_id);
commit;
