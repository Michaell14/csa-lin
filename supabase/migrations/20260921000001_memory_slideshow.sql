-- A memory carries up to five photos or videos, in display order, as one
-- row: one insert publishes atomically and one delete removes the post.
-- Each path's extension says what it is, so media_type goes away.
alter table public.lin_memories add column media_paths text[];
update public.lin_memories set media_paths = array[media_path];
alter table public.lin_memories alter column media_paths set not null;

-- Every path belongs to this lin and author, is a fresh object id with an
-- allowed extension, and appears once. Immutable so a check can call it.
create function public.memory_paths_valid(lin uuid, author uuid, paths text[]) returns boolean
language sql immutable as $$
  select coalesce(array_length(paths, 1), 0) between 1 and 5
    and (select count(distinct p) from unnest(paths) p) = array_length(paths, 1)
    and not exists (
      select 1 from unnest(paths) p
      where p !~ ('^' || lin::text || '/' || author::text || '/[0-9a-f-]{36}\.(jpg|png|mp4|webm)$')
    );
$$;

drop policy memories_insert on public.lin_memories;
create policy memories_insert on public.lin_memories for insert to authenticated
  with check (author_id = public.current_person_id() and public.can_access_lin_memories(lin_id)
    and not exists (
      select 1 from unnest(media_paths) p
      where not exists (select 1 from storage.objects where bucket_id = 'lin-memories' and name = p)
    ));

create or replace function public.can_read_memory_media(path text) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lin_memories m
    where m.media_paths @> array[path]
      and (not m.private_to_lin or public.can_access_lin_memories(m.lin_id))
  );
$$;

alter table public.lin_memories drop constraint lin_memories_check;
alter table public.lin_memories drop column media_path;
alter table public.lin_memories drop column media_type;
alter table public.lin_memories
  add constraint lin_memories_media_paths_check check (public.memory_paths_valid(lin_id, author_id, media_paths));
create index lin_memories_media_paths on public.lin_memories using gin (media_paths);
grant insert (media_paths) on public.lin_memories to authenticated;
