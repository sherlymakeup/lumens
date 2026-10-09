-- Lumens konektor v1 (ala Tasklet Connections).
-- Run once in the Supabase SQL editor of the FRESH Lumens project.
-- The app talks to this table server-side with the service_role key.
-- Secrets are AES-256-GCM encrypted by the server before insert;
-- the raw secret never leaves the server.

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('http', 'mcp')),
  base_url text not null check (char_length(base_url) between 1 and 500),
  auth_type text not null default 'none' check (auth_type in ('none', 'bearer', 'header', 'query')),
  auth_name text check (char_length(auth_name) between 1 and 120),
  auth_secret text,
  tools jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on edits.
create or replace function public.touch_connection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_connections_touch on public.connections;
create trigger trg_connections_touch
  before update on public.connections
  for each row execute function public.touch_connection_updated_at();

create index if not exists idx_connections_enabled
  on public.connections (enabled) where enabled = true;

-- Lock it down: the server uses the service_role key (bypasses RLS),
-- nobody else should read/write.
alter table public.connections enable row level security;

drop policy if exists connections_no_access on public.connections;
create policy connections_no_access on public.connections
  for all using (false);
