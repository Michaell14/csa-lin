-- Memories belong to a lin and are visible only to its members and admins.
create function public.can_access_lin_memories(lin uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.lin_members(lin) where person_id = public.current_person_id()
  );
$$;
revoke all on function public.can_access_lin_memories(uuid) from public, anon;
grant execute on function public.can_access_lin_memories(uuid) to authenticated;

create table public.lin_memories (
  id uuid primary key default gen_random_uuid(),
  lin_id uuid not null references public.lins(id) on delete cascade,
  author_id uuid not null references public.people(id),
  caption text not null default '' check (length(caption) <= 2000),
  media_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  check (media_path = lin_id::text || '/' || author_id::text || '/' || id::text ||
    case when media_type = 'image' then '.jpg' else '.mp4' end
    or media_path = lin_id::text || '/' || author_id::text || '/' || id::text ||
    case when media_type = 'image' then '.png' else '.webm' end)
);
create index lin_memories_timeline on public.lin_memories(lin_id, created_at desc, id desc);
alter table public.lin_memories enable row level security;
revoke all on public.lin_memories from anon, authenticated;
grant select, delete on public.lin_memories to authenticated;
grant insert (id, lin_id, author_id, caption, media_path, media_type) on public.lin_memories to authenticated;
create policy memories_read on public.lin_memories for select to authenticated
  using (public.can_access_lin_memories(lin_id));
create policy memories_insert on public.lin_memories for insert to authenticated
  with check (author_id = public.current_person_id() and public.can_access_lin_memories(lin_id)
    and exists (select 1 from storage.objects where bucket_id = 'lin-memories' and name = media_path));
create policy memories_delete on public.lin_memories for delete to authenticated
  using (author_id = public.current_person_id() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lin-memories', 'lin-memories', false, 52428800,
  array['image/jpeg', 'image/png', 'video/mp4', 'video/webm']);
-- Compare UUIDs as text so malformed storage paths cannot cause cast errors.
create policy memories_media_read on storage.objects for select to authenticated
  using (bucket_id = 'lin-memories' and exists (
    select 1 from public.lins where id::text = (storage.foldername(name))[1]
      and public.can_access_lin_memories(id)
  ));
create policy memories_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lin-memories'
    and (storage.foldername(name))[2] = public.current_person_id()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|mp4|webm)$'
    and exists (select 1 from public.lins where id::text = (storage.foldername(name))[1]
      and public.can_access_lin_memories(id)));
create policy memories_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lin-memories' and
    ((storage.foldername(name))[2] = public.current_person_id()::text or public.is_admin()));
