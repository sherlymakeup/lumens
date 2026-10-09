-- Lumens threads (isolated agent sessions, ala ChatGPT conversation ID).
-- Run once in the Supabase SQL editor of the Lumens project.
-- Server-side only via service_role key; RLS denies everything else.

create table if not exists public.threads (
  id text primary key,
  parent_id text references public.threads (id) on delete set null,
  sandbox_id text,
  workdir text not null,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

create index if not exists idx_threads_parent on public.threads (parent_id);
create index if not exists idx_threads_last_active on public.threads (last_active);

alter table public.threads enable row level security;

drop policy if exists threads_no_access on public.threads;
create policy threads_no_access on public.threads
  for all using (false);
