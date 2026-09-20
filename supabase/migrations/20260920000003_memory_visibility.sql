-- Memories are public to signed-in viewers by default. Authors can instead
-- keep an individual post within its lin.
alter table public.lin_memories
  add column private_to_lin boolean not null default false;

grant insert (private_to_lin) on public.lin_memories to authenticated;

drop policy memories_read on public.lin_memories;
create policy memories_read on public.lin_memories for select to authenticated
  using (not private_to_lin or public.can_access_lin_memories(lin_id));

-- Storage policies cannot rely on the caller being able to join an RLS table
-- consistently, so centralize the same visibility rule in a narrow helper.
create function public.can_read_memory_media(path text) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lin_memories m
    where m.media_path = path
      and (not m.private_to_lin or public.can_access_lin_memories(m.lin_id))
  );
$$;
revoke all on function public.can_read_memory_media(text) from public, anon;
grant execute on function public.can_read_memory_media(text) to authenticated;

alter policy memories_media_read on storage.objects
  using (bucket_id = 'lin-memories' and public.can_read_memory_media(name));
