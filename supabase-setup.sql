create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stem text not null,
  choices jsonb not null,
  answer_index integer not null,
  explanation text not null,
  tags text[] not null default '{}',
  difficulty text not null default 'Medium',
  source text not null default '',
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_answer integer not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Practice block',
  mode text not null default 'tutor',
  question_ids uuid[] not null default '{}',
  results jsonb not null default '[]',
  filters jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.test_sessions enable row level security;

drop policy if exists "Users can read their questions" on public.questions;
create policy "Users can read their questions"
on public.questions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their questions" on public.questions;
create policy "Users can create their questions"
on public.questions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their questions" on public.questions;
create policy "Users can update their questions"
on public.questions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their questions" on public.questions;
create policy "Users can delete their questions"
on public.questions
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their attempts" on public.attempts;
create policy "Users can read their attempts"
on public.attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their attempts" on public.attempts;
create policy "Users can create their attempts"
on public.attempts
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.questions
    where questions.id = attempts.question_id
      and questions.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their attempts" on public.attempts;
create policy "Users can update their attempts"
on public.attempts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their attempts" on public.attempts;
create policy "Users can delete their attempts"
on public.attempts
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their test sessions" on public.test_sessions;
create policy "Users can read their test sessions"
on public.test_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their test sessions" on public.test_sessions;
create policy "Users can create their test sessions"
on public.test_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their test sessions" on public.test_sessions;
create policy "Users can update their test sessions"
on public.test_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their test sessions" on public.test_sessions;
create policy "Users can delete their test sessions"
on public.test_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);
