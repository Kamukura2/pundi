begin;

create table if not exists public.electricity_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topup_date date not null default current_date,
  topup_time time not null default localtime,
  amount_kwh numeric(20,4) not null check (amount_kwh > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.electricity_topups;
create trigger set_updated_at
before update on public.electricity_topups
for each row execute function public.set_updated_at();

alter table public.electricity_topups enable row level security;
alter table public.electricity_topups force row level security;

drop policy if exists electricity_topups_select_own on public.electricity_topups;
drop policy if exists electricity_topups_insert_own on public.electricity_topups;
drop policy if exists electricity_topups_update_own on public.electricity_topups;
drop policy if exists electricity_topups_delete_own on public.electricity_topups;

create policy electricity_topups_select_own on public.electricity_topups
for select to authenticated using ((select auth.uid()) = user_id);
create policy electricity_topups_insert_own on public.electricity_topups
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy electricity_topups_update_own on public.electricity_topups
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy electricity_topups_delete_own on public.electricity_topups
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.electricity_topups from anon;
grant select, insert, update, delete on public.electricity_topups to authenticated;

create index if not exists electricity_topups_user_time_idx
  on public.electricity_topups(user_id, topup_date, topup_time);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'electricity_topups'
  ) then
    alter publication supabase_realtime add table public.electricity_topups;
  end if;
end $$;

commit;
