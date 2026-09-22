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

-- media_path was unique, so no two memories could ever name one stored object.
-- An array column cannot carry that constraint and the insert policy only asks
-- that each object exists, so a crafted client could publish a second memory
-- over paths a first one already owns; deleting either memory would then delete
-- the shared object and leave the other memory pointing at nothing. Each path
-- is therefore claimed in a ledger keyed by the path, which restores the old
-- guarantee: the second claim fails on the primary key, and deleting a memory
-- cascades its claims away so a genuinely orphaned path can be reused.
create table public.lin_memory_media (
  path text primary key,
  memory_id uuid not null references public.lin_memories(id) on delete cascade
);
create index lin_memory_media_memory on public.lin_memory_media(memory_id);
alter table public.lin_memory_media enable row level security;
revoke all on public.lin_memory_media from anon, authenticated;

-- Security definer because the ledger is closed to authenticated; a trigger
-- function returning trigger cannot be called any other way than by its trigger.
create function public.claim_memory_paths() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.lin_memory_media where memory_id = new.id;
  end if;
  insert into public.lin_memory_media (path, memory_id)
    select p, new.id from unnest(new.media_paths) p;
  return new;
end $$;

create trigger lin_memories_claim_paths after insert or update of media_paths
  on public.lin_memories for each row execute function public.claim_memory_paths();

insert into public.lin_memory_media (path, memory_id)
  select p, m.id from public.lin_memories m, unnest(m.media_paths) p;
