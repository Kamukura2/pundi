-- Pundi v8.5.0: controlled-beta feedback.
-- Forward-only additive schema. No finance data is read or modified.
begin;
create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('Bug','Feature request','Usability','Data / calculation issue','Other')),
  message text not null check (char_length(message) between 1 and 4000),
  page text not null default '' check (char_length(page) <= 120),
  app_version text not null default '' check (char_length(app_version) <= 32),
  build_id text not null default '' check (char_length(build_id) <= 64),
  browser text not null default '' check (char_length(browser) <= 160),
  status text not null default 'New' check (status in ('New','Reviewing','Planned','Resolved','Closed')),
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Critical')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists beta_feedback_created_idx on public.beta_feedback(created_at desc);
create index if not exists beta_feedback_status_idx on public.beta_feedback(status, created_at desc);
create index if not exists beta_feedback_category_idx on public.beta_feedback(category, created_at desc);
alter table public.beta_feedback enable row level security;
alter table public.beta_feedback force row level security;
revoke all on public.beta_feedback from anon;
grant select, insert on public.beta_feedback to authenticated;
grant all on public.beta_feedback to service_role;
drop policy if exists beta_feedback_select_own on public.beta_feedback;
drop policy if exists beta_feedback_insert_own on public.beta_feedback;
create policy beta_feedback_select_own on public.beta_feedback for select to authenticated using (user_id = auth.uid());
create policy beta_feedback_insert_own on public.beta_feedback for insert to authenticated with check (user_id = auth.uid());
commit;
