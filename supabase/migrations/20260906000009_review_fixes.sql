-- Fixes from the whole-branch review of the backend.

-- ---------------------------------------------------------------------------
-- 1. guard_people_update: let merge_people retire a CLAIMED duplicate.
--    SECURITY DEFINER does not change auth.role(), so the admin's JWT still
--    reaches this trigger inside merge_people; the penn_email lock fired on the
--    statement that nulls the duplicate's identity columns. The merge is
--    recognisable by merged_into flipping from null to a value, by an admin.
--
--    NOTE on the first bypass: the condition is inverted on purpose. Anything
--    that is not literally the 'authenticated' app role (postgres, service_role,
--    the auth hook) skips the column guards. That is safe only while no policy
--    grants anon a write. Never add an anon write policy, and never let the
--    service_role key reach a browser.
-- ---------------------------------------------------------------------------
create or replace function public.guard_people_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  -- merge_people retires the duplicate with exactly this shape: merged_into set,
  -- every sign-in identity column cleared. Requiring the full shape means the
  -- exemption cannot be used to hand a claimed profile a different penn_email.
  if public.is_admin()
     and new.merged_into is not null and old.merged_into is null
     and new.penn_email is null and new.personal_email is null
     and new.auth_user_id is null and new.claimed_at is null then
    return new;
  end if;

  if old.claimed_at is not null and new.penn_email is distinct from old.penn_email then
    raise exception 'penn_email is locked after claim' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.penn_email   is distinct from old.penn_email
  or new.hidden       is distinct from old.hidden
  or new.merged_into  is distinct from old.merged_into
  or new.auth_user_id is distinct from old.auth_user_id
  or new.claimed_at   is distinct from old.claimed_at
  or new.created_at   is distinct from old.created_at then
    raise exception 'not allowed to change protected fields' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1b. merge_people: when the duplicate is the claimed one and the survivor is
--     not, the duplicate's sign-in identity must REPLACE the survivor's, not be
--     coalesced behind a possibly mistyped survivor penn_email. Otherwise the
--     survivor ends up claimed under an email the auth hook can never match.
-- ---------------------------------------------------------------------------
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

  -- Free the unique columns on the duplicate and retire it.
  update public.people
  set penn_email = null, personal_email = null, auth_user_id = null, claimed_at = null,
      merged_into = survivor, hidden = true
  where id = duplicate;

  -- Survivor inherits. If only the duplicate was claimed, its identity wins outright.
  update public.people s
  set penn_email     = case when not surv_claimed and dup.claimed_at is not null
                            then dup.penn_email else coalesce(s.penn_email, dup.penn_email) end,
      auth_user_id   = case when not surv_claimed and dup.claimed_at is not null
                            then dup.auth_user_id else coalesce(s.auth_user_id, dup.auth_user_id) end,
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
      personal_email = coalesce(s.personal_email, dup.personal_email),
      photo_path     = coalesce(s.photo_path,     dup.photo_path),
      major          = coalesce(s.major,          dup.major),
      hometown       = coalesce(s.hometown,       dup.hometown),
      bio            = coalesce(s.bio,            dup.bio),
      instagram      = coalesce(s.instagram,      dup.instagram),
      linkedin       = coalesce(s.linkedin,       dup.linkedin)
  where s.id = survivor;
end $$;

-- ---------------------------------------------------------------------------
-- 2. prevent_link_cycle must see the WHOLE confirmed graph, not the caller's
--    RLS-filtered view of it. It is a read-only check, so security definer is
--    safe. Without this, narrowing links_select would silently admit cycles.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_link_cycle() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.little_id = new.big_id
     or new.little_id in (select public.ancestors_of(new.big_id)) then
    raise exception 'link would create a cycle' using errcode = '23514';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. lin_graph: one call returns a lin's drawable nodes and edges, already
--    filtered so no edge points at a node the caller cannot see. Hidden or
--    merged people are dropped, except the founder, who comes back as a
--    placeholder (no name, no photo, no profile fields, no claimed flag). Confirmed links only.
-- ---------------------------------------------------------------------------
create or replace function public.lin_graph(lin uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with members as (
    select m.person_id, m.is_founder
    from public.lin_members(lin) m
  ),
  nodes as (
    select p.id,
           m.is_founder,
           (p.hidden or p.merged_into is not null)                         as placeholder,
           case when p.hidden or p.merged_into is not null then null else p.display_name end as display_name,
           p.grad_year,
           case when p.hidden or p.merged_into is not null then null else p.photo_path   end as photo_path,
           case when p.hidden or p.merged_into is not null then null else p.major        end as major,
           case when p.hidden or p.merged_into is not null then null else p.hometown     end as hometown,
           case when p.hidden or p.merged_into is not null then null else p.bio          end as bio,
           case when p.hidden or p.merged_into is not null then null else p.instagram    end as instagram,
           case when p.hidden or p.merged_into is not null then null else p.linkedin     end as linkedin,
           case when p.hidden or p.merged_into is not null then null else (p.claimed_at is not null) end as claimed
    from members m
    join public.people p on p.id = m.person_id
  )
  select jsonb_build_object(
    'people', coalesce(
      (select jsonb_agg(to_jsonb(n) order by n.grad_year, n.display_name) from nodes n),
      '[]'::jsonb),
    'links', coalesce(
      (select jsonb_agg(jsonb_build_object(
                 'id', l.id, 'big_id', l.big_id, 'little_id', l.little_id,
                 'academic_year', l.academic_year)
               order by l.created_at)
       from public.links l
       where l.status = 'confirmed'
         and l.big_id    in (select person_id from members)
         and l.little_id in (select person_id from members)),
      '[]'::jsonb)
  );
$$;

revoke execute on function public.lin_graph(uuid) from anon, public;
grant  execute on function public.lin_graph(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. is_admin: the earlier "revoke from anon" was a no-op because EXECUTE is
--    granted to PUBLIC by default. Revoke from public, grant to the roles that
--    need it (authenticated for policies, supabase_auth_admin is not needed).
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Pin search_path on the three functions that lacked it (Supabase linter:
--    function_search_path_mutable).
-- ---------------------------------------------------------------------------
alter function public.current_person_id() set search_path = public;
alter function public.is_penn_email(text) set search_path = public;
alter function public.set_updated_at()    set search_path = public;
