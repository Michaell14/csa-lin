-- Photo storage hardening.
--
-- 1. photo_path must be the person's own avatar object. It was in the
--    member-editable column set with no shape rule, so a member could point
--    their avatar at any object in the bucket.
-- 2. Reads were bucket-wide: every signed-in user could list the whole bucket
--    (enumerating person ids) and fetch photos of hidden people. Reads are now
--    limited to your own folder, visible people's folders, or admin.
-- 3. Writes were "anything under your folder"; now only avatar.<ext>.
--
-- merge_people no longer copies the duplicate's photo_path onto the survivor:
-- that path lives in the duplicate's folder, which rule 1 forbids and rule 2
-- would make unreadable once the duplicate is hidden. It clears the duplicate's
-- photo_path instead, so nothing is left pointing into a retired folder. SQL
-- cannot move a storage object, so carrying the picture over is the caller's
-- job: mergePeople in web/src/lib/api/admin.ts copies the duplicate's avatar
-- into the survivor's own folder, points the survivor at the copy, and deletes
-- the original.

-- ---------- 1. photo_path shape ----------
update public.people
set photo_path = null
where photo_path is not null
  and photo_path !~ ('^' || id::text || '/avatar\.(jpg|jpeg|png|webp)$');

alter table public.people
  add constraint people_photo_path_own_folder
    check (photo_path is null or photo_path ~ ('^' || id::text || '/avatar\.(jpg|jpeg|png|webp)$'));

-- ---------- 2 & 3. storage policies ----------
-- <person uuid>/avatar.<ext>, nothing else.
create or replace function public.is_avatar_path(object_name text) returns boolean
language sql immutable
set search_path = public
as $$
  select object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png|webp)$';
$$;

-- The person whose folder this object sits in.
create or replace function public.photo_owner(object_name text) returns uuid
language sql immutable
set search_path = public
as $$
  select case when public.is_avatar_path(object_name)
              then split_part(object_name, '/', 1)::uuid end;
$$;

drop policy if exists photos_read   on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;

create policy photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or public.photo_owner(name) = public.current_person_id()
      or exists (
        select 1 from public.people p
        where p.id = public.photo_owner(name)
          and p.hidden = false
          and p.merged_into is null
      )
    )
  );

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_avatar_path(name)
    and (public.is_admin() or public.photo_owner(name) = public.current_person_id())
  );

create policy photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and public.is_avatar_path(name)
    and (public.is_admin() or public.photo_owner(name) = public.current_person_id())
  );

create policy photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_admin() or public.photo_owner(name) = public.current_person_id())
  );

-- ---------- merge_people: survivor keeps its own photo ----------
create or replace function public.merge_people(survivor uuid, duplicate uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  dup public.people%rowtype;
  surv_claimed boolean;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if survivor = duplicate then
    raise exception 'cannot merge a person into themselves' using errcode = '22023';
  end if;

  select * into dup from public.people where id = duplicate;
  if not found then
    raise exception 'duplicate person not found' using errcode = '22023';
  end if;
  select (claimed_at is not null) into surv_claimed from public.people where id = survivor;
  if surv_claimed is null then
    raise exception 'survivor person not found' using errcode = '22023';
  end if;
  if surv_claimed and dup.claimed_at is not null then
    raise exception 'both people are claimed; clear one sign-in identity first' using errcode = '22023';
  end if;

  -- Re-point links where the duplicate is the big.
  update public.links l
  set big_id = survivor
  where l.big_id = duplicate
    and l.little_id <> survivor
    and not exists (select 1 from public.links x where x.big_id = survivor and x.little_id = l.little_id);
  delete from public.links where big_id = duplicate;

  -- Re-point links where the duplicate is the little.
  update public.links l
  set little_id = survivor
  where l.little_id = duplicate
    and l.big_id <> survivor
    and not exists (select 1 from public.links x where x.little_id = survivor and x.big_id = l.big_id);
  delete from public.links where little_id = duplicate;

  update public.lins set founder_id = survivor where founder_id = duplicate;
  delete from public.admins where person_id = duplicate;

  -- Free the unique columns on the duplicate and retire it. photo_path goes too:
  -- the object is about to be unreadable to members, and the caller deletes it
  -- once the survivor holds its own copy.
  update public.people
  set penn_email = null, personal_email = null, auth_user_id = null, claimed_at = null,
      photo_path = null, merged_into = survivor, hidden = true
  where id = duplicate;

  -- Survivor inherits. If only the duplicate was claimed, its identity wins outright.
  -- photo_path is not inherited: it must live in the survivor's own folder, so the
  -- caller copies the object there and repoints the survivor afterwards.
  update public.people s
  set penn_email     = case when not surv_claimed and dup.claimed_at is not null
                            then dup.penn_email else coalesce(s.penn_email, dup.penn_email) end,
      auth_user_id   = case when not surv_claimed and dup.claimed_at is not null
                            then dup.auth_user_id else coalesce(s.auth_user_id, dup.auth_user_id) end,
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
      personal_email = coalesce(s.personal_email, dup.personal_email),
      major          = coalesce(s.major,          dup.major),
      hometown       = coalesce(s.hometown,       dup.hometown),
      bio            = coalesce(s.bio,            dup.bio),
      instagram      = coalesce(s.instagram,      dup.instagram),
      linkedin       = coalesce(s.linkedin,       dup.linkedin)
  where s.id = survivor;
end $$;
