-- Admin-only actions that need more than a single row write.

create or replace function public.merge_people(survivor uuid, duplicate uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  dup public.people%rowtype;
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

  -- Free the unique columns on the duplicate, then let the survivor inherit anything it lacks.
  update public.people
  set penn_email = null, personal_email = null, auth_user_id = null, claimed_at = null,
      merged_into = survivor, hidden = true
  where id = duplicate;

  update public.people s
  set penn_email     = coalesce(s.penn_email,     dup.penn_email),
      personal_email = coalesce(s.personal_email, dup.personal_email),
      auth_user_id   = coalesce(s.auth_user_id,   dup.auth_user_id),
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
      photo_path     = coalesce(s.photo_path,     dup.photo_path),
      major          = coalesce(s.major,          dup.major),
      hometown       = coalesce(s.hometown,       dup.hometown),
      bio            = coalesce(s.bio,            dup.bio),
      instagram      = coalesce(s.instagram,      dup.instagram),
      linkedin       = coalesce(s.linkedin,       dup.linkedin)
  where s.id = survivor;
end $$;

revoke execute on function public.merge_people(uuid, uuid) from anon, public;
grant execute on function public.merge_people(uuid, uuid) to authenticated;

create or replace function public.prevent_last_admin_removal() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (select count(*) from public.admins) <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger admins_keep_one
  before delete on public.admins
  for each row execute function public.prevent_last_admin_removal();
