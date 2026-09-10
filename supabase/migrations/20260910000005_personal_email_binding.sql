-- Bind the personal-email sign-in the way the Penn one is bound.
--
-- The hook's Penn branch claims an unclaimed profile and, since the previous
-- migration, refuses to issue person_id when the profile is already bound to a
-- different auth.users row. The personal-email branch had no such anchor: it
-- matched on the address and claimed_at alone, so any confirmed Auth account
-- registered on that address received the profile and its admin rights. A
-- mailbox that is deleted and re-registered, or an old school address handed to
-- someone new, is enough.
--
-- The two branches cannot share auth_user_id: signing in with a personal Google
-- account is a different auth.users row on purpose, and auth_user_id holds the
-- Penn one. So the personal address gets its own binding column, filled by the
-- first sign-in that uses it and required to match on every sign-in after.

alter table public.people
  add column personal_auth_user_id uuid unique;

comment on column public.people.personal_auth_user_id is
  'auth.users id of the personal-email sign-in, bound on first use. auth_user_id holds the Penn one.';

-- The view is "select p.*", which froze the column list when it was created.
create or replace view public.people_with_contact
with (security_barrier = true) as
  select p.*
  from public.people p
  where public.is_admin() or p.id = public.current_person_id();

-- ---------- members may not set their own binding ----------
-- Unchanged from ..._review_fixes.sql apart from personal_auth_user_id joining
-- the protected column list and the merge exemption.
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
     and new.auth_user_id is null and new.claimed_at is null
     and new.personal_auth_user_id is null then
    return new;
  end if;

  if old.claimed_at is not null and new.penn_email is distinct from old.penn_email then
    raise exception 'penn_email is locked after claim' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.penn_email            is distinct from old.penn_email
  or new.hidden                is distinct from old.hidden
  or new.merged_into           is distinct from old.merged_into
  or new.auth_user_id          is distinct from old.auth_user_id
  or new.personal_auth_user_id is distinct from old.personal_auth_user_id
  or new.claimed_at            is distinct from old.claimed_at
  or new.created_at            is distinct from old.created_at then
    raise exception 'not allowed to change protected fields' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------- the hook binds and then enforces ----------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  claims    jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid       uuid  := (event ->> 'user_id')::uuid;
  email     text  := lower(coalesce(claims ->> 'email', ''));
  stored    text;
  confirmed boolean;
  pid       uuid;
  bound     uuid;
  reject constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with your Penn Google account.'));
  unverified constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with a verified email address.'));
  conflicted constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'That profile is linked to a different sign-in. Ask an admin to unlink it.'));
begin
  if email = '' or uid is null then
    return reject;
  end if;

  select lower(u.email), u.email_confirmed_at is not null
  into stored, confirmed
  from auth.users u
  where u.id = uid;

  if stored is null or stored <> email or confirmed is not true then
    return unverified;
  end if;

  if public.is_penn_email(email) then
    select id into pid
    from public.people
    where penn_email = email and merged_into is null
    limit 1;

    if pid is not null then
      update public.people
      set auth_user_id = uid, claimed_at = now()
      where id = pid and auth_user_id is null;

      -- The update above is a no-op both for a repeat sign-in, where the
      -- profile is already bound to this uid, and for a profile bound to some
      -- other Auth user. Only the first may carry person_id; issuing it for the
      -- second would hand this session a profile it does not own. An admin
      -- clears people.auth_user_id to re-open the claim.
      perform 1 from public.people where id = pid and auth_user_id = uid;
      if not found then
        return conflicted;
      end if;
    end if;
  else
    select id, personal_auth_user_id into pid, bound
    from public.people
    where personal_email = email and claimed_at is not null and merged_into is null
    limit 1;

    if pid is null then
      return reject;
    end if;

    -- Same rule as the Penn branch, against the personal binding: the first
    -- sign-in on this address takes it, everyone after has to match. The
    -- guarded update rather than a bare one settles a race between two first
    -- sign-ins; the re-read then tells the loser apart from the winner.
    if bound is distinct from uid then
      update public.people
      set personal_auth_user_id = uid
      where id = pid and personal_auth_user_id is null;

      perform 1 from public.people where id = pid and personal_auth_user_id = uid;
      if not found then
        return conflicted;
      end if;
    end if;
  end if;

  claims := claims || jsonb_build_object('person_id', pid);
  return jsonb_set(event, '{claims}', claims);
end $$;

-- ---------- merge_people carries the pair, never half of it ----------
-- Unchanged from ..._photo_policies.sql apart from personal_auth_user_id.
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
  set penn_email = null, personal_email = null, auth_user_id = null,
      personal_auth_user_id = null, claimed_at = null,
      photo_path = null, merged_into = survivor, hidden = true
  where id = duplicate;

  -- Survivor inherits. If only the duplicate was claimed, its identity wins outright.
  -- personal_auth_user_id moves only with the address it belongs to: a survivor
  -- keeping its own personal_email must not end up bound to the duplicate's
  -- sign-in, which would lock the address's real owner out of both.
  -- photo_path is not inherited: it must live in the survivor's own folder, so the
  -- caller copies the object there and repoints the survivor afterwards.
  update public.people s
  set penn_email     = case when not surv_claimed and dup.claimed_at is not null
                            then dup.penn_email else coalesce(s.penn_email, dup.penn_email) end,
      auth_user_id   = case when not surv_claimed and dup.claimed_at is not null
                            then dup.auth_user_id else coalesce(s.auth_user_id, dup.auth_user_id) end,
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
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
