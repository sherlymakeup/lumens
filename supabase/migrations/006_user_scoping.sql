-- 006: per-user scoping untuk connections, memories, threads + atomic credit deduct.
-- Jalankan di Supabase SQL editor. Aman di-run ulang (idempotent).

-- 1. connections: tambah user_id
alter table public.connections
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_connections_user on public.connections (user_id);

-- 2. memories: tambah user_id
alter table public.memories
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_memories_user on public.memories (user_id);

-- 3. threads: tambah user_id
alter table public.threads
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_threads_user on public.threads (user_id);

-- 4. Atomic credit deduct — cegah double-spend saat request paralel.
-- Return: sisa kredit (>=0), atau -1 jika kredit tidak cukup / user tidak ada.
create or replace function public.deduct_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update public.profiles
  set credits = credits - 1,
      updated_at = now()
  where id = p_user_id
    and credits > 0
  returning credits into v_remaining;

  if not found then
    return -1;
  end if;
  return v_remaining;
end;
$$;

-- Batasi akses RPC: hanya service_role (app server) yang boleh panggil.
revoke all on function public.deduct_credit(uuid) from public, anon, authenticated;
grant execute on function public.deduct_credit(uuid) to service_role;
