-- Lumens agent long-term memory (Fase 1).
-- Run once in the Supabase SQL editor of the FRESH Lumens project.
-- The app talks to this table server-side with the service_role key.

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on edits.
create or replace function public.touch_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_memories_touch on public.memories;
create trigger trg_memories_touch
  before update on public.memories
  for each row execute function public.touch_memory_updated_at();

-- Helpful index for the ilike search + recency ordering the agent uses.
create index if not exists idx_memories_updated_at
  on public.memories (updated_at desc);

-- Lock it down: the server uses the service_role key (bypasses RLS),
-- nobody else should read/write.
alter table public.memories enable row level security;
