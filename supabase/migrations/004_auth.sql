-- Lumens auth: profiles per akun + conversations per-user (pengganti localStorage).
-- Run once in the Supabase SQL editor of the Lumens project.
-- Server-side via service_role key; RLS denies direct client access (semua lewat API server).

-- Profiles: 1 row per auth.users.id. Role 'admin' = unlimited credit.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  credits numeric not null default 0,
  unlimited boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists profiles_no_access on public.profiles;
create policy profiles_no_access on public.profiles for all using (false);

-- Conversations: milik per-user, menggantikan zustand persist localStorage.
create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Untitled',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user on public.conversations (user_id);
create index if not exists idx_conversations_updated on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;
drop policy if exists conversations_no_access on public.conversations;
create policy conversations_no_access on public.conversations for all using (false);

-- updated_at otomatis.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_conversations_touch on public.conversations;
create trigger trg_conversations_touch
  before update on public.conversations
  for each row execute function public.touch_updated_at();
