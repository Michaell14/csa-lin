-- A lin founded below another lin's founder is redundant: everyone in the
-- lower lin is already in the upper one. Distinct big branches remain distinct
-- lins, including for their shared descendants.

-- Keep a generated name in step when its founder moves up the chain. A name
-- edited by a founder or admin is preserved.
create function public.available_lin_name(root uuid, excluded_lin uuid)
returns text language plpgsql stable set search_path = public as $$
declare
  base text;
  candidate text;
begin
  select display_name || '''s Lin' into base from public.people where id = root;
  if base is null then raise exception 'no person % to found a lin', root; end if;
  for n in 1..100 loop
    candidate := case when n = 1 then base else base || ' ' || n end;
    if not exists (select 1 from public.lins where name = candidate and id is distinct from excluded_lin) then
      return candidate;
    end if;
  end loop;
  raise exception 'no free name for %', base;
end $$;

create or replace function public.ensure_lin_for_link() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  root uuid;
  carried public.lins%rowtype;
  old_base text;
  generated_name boolean;
begin
  if new.status <> 'confirmed' or
     (tg_op = 'UPDATE' and old.status = 'confirmed'
      and old.big_id = new.big_id and old.little_id = new.little_id) then
    return new;
  end if;

  -- Serialise both founding and reconciliation. In particular, two links
  -- confirmed at once must not each keep a newly nested lin.
  perform pg_advisory_xact_lock(20260915000001);

  -- A person can have several bigs, hence several top roots. Each root needs
  -- its own lin; sharing a descendant does not merge the big branches.
  for root in
    with chain as (
      select new.big_id as id
      union
      select public.ancestors_of(new.big_id)
    )
    select c.id from chain c join public.people p on p.id = c.id
    where not exists (
      select 1 from public.links l
      where l.little_id = c.id and l.status = 'confirmed'
    )
    order by p.grad_year, p.display_name, p.id
  loop
    if exists (select 1 from public.lins where founder_id = root) then
      continue;
    end if;

    -- Carry the little's existing lin up to the first root that needs one.
    -- If every root already has a lin, it is removed as redundant below.
    select * into carried from public.lins
    where founder_id = new.little_id
    order by created_at, id limit 1;
    if found then
      select display_name || '''s Lin' into old_base
      from public.people where id = carried.founder_id;
      generated_name := carried.name = old_base
        or (left(carried.name, length(old_base) + 1) = old_base || ' '
            and substring(carried.name from length(old_base) + 2) ~ '^[2-9][0-9]*$');
      update public.lins
      set founder_id = root,
          name = case when generated_name then public.available_lin_name(root, carried.id)
                      else carried.name end
      where id = carried.id;
    else
      perform public.found_lin(root);
    end if;
  end loop;

  -- Remove only lins nested along the same big → little path. If two founders
  -- reach the same person through different bigs, neither is an ancestor of
  -- the other and both lins stay.
  delete from public.lins child
  where exists (
    select 1 from public.lins parent
    where parent.id <> child.id
      and parent.founder_id in (select public.ancestors_of(child.founder_id))
  );
  return new;
end $$;

drop trigger links_found_lin on public.links;
create trigger links_found_lin
  after insert or update of status, big_id, little_id on public.links
  for each row execute function public.ensure_lin_for_link();

-- Reconcile rows created under the earlier policy. Keep the oldest row for
-- duplicate founders, then remove lins nested below another founder.
with ranked as (
  select id, row_number() over (partition by founder_id order by created_at, id) as rank
  from public.lins
)
delete from public.lins l using ranked r where l.id = r.id and r.rank > 1;

delete from public.lins child
where exists (
  select 1 from public.lins parent
  where parent.id <> child.id
    and parent.founder_id in (select public.ancestors_of(child.founder_id))
);

create unique index lins_one_per_founder on public.lins(founder_id);

-- Admin creation/reassignment must obey the same rule. The link trigger runs
-- its internal lin writes at trigger depth > 1 and reconciles before commit.
create function public.guard_lin_structure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'authenticated' or pg_trigger_depth() > 1
     or (tg_op = 'UPDATE' and new.founder_id is not distinct from old.founder_id) then
    return new;
  end if;
  -- BEFORE triggers run before RLS checks. Preserve the existing permission
  -- error for members and avoid revealing the shape of other people's lins.
  if public.is_admin() is not true then
    raise exception 'Only an admin can create or reassign a lin'
      using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(20260915000001);
  if exists (
    select 1 from public.lins l
    where l.id is distinct from new.id
      and (l.founder_id = new.founder_id
        or l.founder_id in (select public.ancestors_of(new.founder_id))
        or l.founder_id in (select public.descendants_of(new.founder_id)))
  ) then
    raise exception 'This founder is already on another lin''s big/little path'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger lins_guard_structure
  before insert or update of founder_id on public.lins
  for each row execute function public.guard_lin_structure();

revoke execute on function public.available_lin_name(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.guard_lin_structure() from public, anon, authenticated;

-- Merging duplicate people can also converge two founded lins. Keep the
-- survivor's lin if there is one; otherwise carry the duplicate's lin across
-- before rewiring confirmed links, whose trigger would otherwise found a new
-- survivor lin and discard the duplicate's name, color, and identity.
create or replace function public.merge_people(survivor uuid, duplicate uuid, survivor_photo_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  dup public.people%rowtype;
  surv_claimed boolean;
  duplicate_default_name text;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if survivor = duplicate then
    raise exception 'cannot merge a person into themselves' using errcode = '22023';
  end if;

  select * into dup from public.people where id = duplicate;
  if not found then raise exception 'duplicate person not found' using errcode = '22023'; end if;
  select (claimed_at is not null) into surv_claimed from public.people where id = survivor;
  if surv_claimed is null then raise exception 'survivor person not found' using errcode = '22023'; end if;
  if surv_claimed and dup.claimed_at is not null then
    raise exception 'both people are claimed; clear one sign-in identity first' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(20260915000001);

  if exists (select 1 from public.lins_of(survivor)) then
    delete from public.lins where founder_id = duplicate;
  else
    -- The carried lin will cover these descendants, making their separate
    -- founded lins redundant. Remove them before the founder guard runs.
    delete from public.lins
    where founder_id in (select public.descendants_of(survivor))
      and founder_id <> duplicate;
    duplicate_default_name := dup.display_name || '''s Lin';
    update public.lins l
    set founder_id = survivor,
        name = case
          when l.name = duplicate_default_name
            or (left(l.name, length(duplicate_default_name) + 1) = duplicate_default_name || ' '
                and substring(l.name from length(duplicate_default_name) + 2) ~ '^[2-9][0-9]*$')
            then public.available_lin_name(survivor, l.id)
          else l.name
        end
    where l.founder_id = duplicate;
  end if;

  update public.links l set big_id = survivor
  where l.big_id = duplicate and l.little_id <> survivor
    and not exists (select 1 from public.links x where x.big_id = survivor and x.little_id = l.little_id);
  delete from public.links where big_id = duplicate;

  update public.links l set little_id = survivor
  where l.little_id = duplicate and l.big_id <> survivor
    and not exists (select 1 from public.links x where x.little_id = survivor and x.big_id = l.big_id);
  delete from public.links where little_id = duplicate;

  -- Removing a duplicate incoming link can invoke the link-removal trigger
  -- after the earlier cleanup. Do not leave a new lin on the merged person.
  delete from public.lins where founder_id = duplicate;
  delete from public.admins where person_id = duplicate;

  update public.people
  set penn_email = null, personal_email = null, auth_user_id = null,
      personal_auth_user_id = null, claimed_at = null,
      photo_path = null, merged_into = survivor, hidden = true
  where id = duplicate;

  update public.people s
  set penn_email     = case when not surv_claimed and dup.claimed_at is not null
                            then dup.penn_email else coalesce(s.penn_email, dup.penn_email) end,
      auth_user_id   = case when not surv_claimed and dup.claimed_at is not null
                            then dup.auth_user_id else coalesce(s.auth_user_id, dup.auth_user_id) end,
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
      photo_path     = coalesce(s.photo_path,     survivor_photo_path),
      personal_email = coalesce(s.personal_email, dup.personal_email),
      personal_auth_user_id = case when s.personal_email is null
                                   then dup.personal_auth_user_id else s.personal_auth_user_id end,
      major          = coalesce(s.major,          dup.major),
      hometown       = coalesce(s.hometown,       dup.hometown),
      bio            = coalesce(s.bio,            dup.bio),
      instagram      = coalesce(s.instagram,      dup.instagram),
      linkedin       = coalesce(s.linkedin,       dup.linkedin)
  where s.id = survivor;
end $$;
