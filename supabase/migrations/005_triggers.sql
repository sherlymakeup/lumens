-- Lumens triggers (P3): cron terjadwal + webhook, per-user.
-- Run once in the Supabase SQL editor of the Lumens project.
-- Server-side via service_role key; RLS denies direct client access.

create table if not exists public.triggers (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cron', 'webhook')),
  schedule text check (schedule in ('hourly', 'daily', 'interval')),
  time text,
  interval_minutes integer,
  prompt text not null,
  enabled boolean not null default true,
  last_run timestamptz,
  next_run timestamptz,
  webhook_secret text,
  created_at timestamptz not null default now()
);

create index if not exists idx_triggers_user on public.triggers (user_id);
create index if not exists idx_triggers_due on public.triggers (enabled, next_run)
  where type = 'cron' and enabled = true;

alter table public.triggers enable row level security;
drop policy if exists triggers_no_access on public.triggers;
create policy triggers_no_access on public.triggers for all using (false);
