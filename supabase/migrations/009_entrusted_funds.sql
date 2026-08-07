-- CVFinance v7.5.1: non-recurring entrusted-fund liabilities.
-- Additive migration. No existing financial records are changed or deleted.

begin;

create table if not exists public.entrusted_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(20,2) not null check (amount >= 0),
  deduction_source text not null check (deduction_source in ('cash','stocks')),
  is_settled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.entrusted_funds;
create trigger set_updated_at
before update on public.entrusted_funds
for each row execute function public.set_updated_at();

alter table public.entrusted_funds enable row level security;
alter table public.entrusted_funds force row level security;

drop policy if exists entrusted_funds_select_own on public.entrusted_funds;
drop policy if exists entrusted_funds_insert_own on public.entrusted_funds;
drop policy if exists entrusted_funds_update_own on public.entrusted_funds;
drop policy if exists entrusted_funds_delete_own on public.entrusted_funds;

create policy entrusted_funds_select_own on public.entrusted_funds
for select to authenticated using ((select auth.uid()) = user_id);
create policy entrusted_funds_insert_own on public.entrusted_funds
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy entrusted_funds_update_own on public.entrusted_funds
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy entrusted_funds_delete_own on public.entrusted_funds
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.entrusted_funds from anon;
grant select, insert, update, delete on public.entrusted_funds to authenticated;

create index if not exists entrusted_funds_user_status_order_idx
on public.entrusted_funds(user_id, is_settled, sort_order);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entrusted_funds'
  ) then
    alter publication supabase_realtime add table public.entrusted_funds;
  end if;
end $$;

commit;
