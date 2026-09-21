-- Penn renamed SEAS mailboxes from @seas.upenn.edu to
-- @engineering.upenn.edu. Treat those two addresses as one institutional
-- identity while keeping @engineering.upenn.edu as the stored default.

create or replace function public.canonical_penn_email(email text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when lower(trim(email)) ~ '^[^@[:space:]]+@seas\.upenn\.edu$'
      then regexp_replace(lower(trim(email)), '@seas\.upenn\.edu$', '@engineering.upenn.edu')
    else lower(trim(email))
  end;
$$;

comment on function public.canonical_penn_email(text) is
  'Normalizes Penn sign-in addresses; legacy SEAS addresses use the Engineering domain.';

-- Refuse to guess if historical data already assigned the two aliases to
-- different people. An administrator must resolve that conflict explicitly.
do $$
declare
  conflicts text;
begin
  select string_agg(canonical_email, ', ' order by canonical_email)
    into conflicts
  from (
    select public.canonical_penn_email(penn_email) as canonical_email
    from public.people
    where penn_email is not null
    group by public.canonical_penn_email(penn_email)
    having count(*) > 1
  ) duplicate_aliases;

  if conflicts is not null then
    raise exception 'Cannot enable Penn email aliases; multiple profiles use: %', conflicts;
  end if;
end $$;

-- The guard above makes this a one-to-one rewrite. Migrations run outside the
-- authenticated app role, so the claimed-email protection correctly permits
-- this controlled data transition.
update public.people
set penn_email = public.canonical_penn_email(penn_email)
where lower(penn_email) ~ '^[^@[:space:]]+@seas\.upenn\.edu$';

-- The original exact-email unique constraint remains useful. This index also
-- prevents an administrator or future code path from assigning the two domain
-- variants to separate profiles.
create unique index people_penn_email_canonical_key
  on public.people (public.canonical_penn_email(penn_email))
  where penn_email is not null;

create or replace function public.normalize_people_penn_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Do not rewrite a legacy claimed address during unrelated profile edits.
  -- Only newly supplied email values are normalized.
  if tg_op = 'INSERT' then
    new.penn_email := public.canonical_penn_email(new.penn_email);
  elsif new.penn_email is distinct from old.penn_email then
    new.penn_email := public.canonical_penn_email(new.penn_email);
  end if;
  return new;
end;
$$;

create trigger people_canonicalize_penn_email
  before insert or update on public.people
  for each row execute function public.normalize_people_penn_email();

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  claims    jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid       uuid  := (event ->> 'user_id')::uuid;
  email     text  := lower(coalesce(claims ->> 'email', ''));
  canonical_email text;
  stored    text;
  confirmed boolean;
  dev_password_login boolean;
  method    text := coalesce(event ->> 'authentication_method', '');
  pid       uuid;
  bound     uuid;
  reject constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign in with a verified Penn email or a personal Google account already linked to your profile.'));
  unverified constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with a verified email address.'));
  nursing_only constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Email-code sign-in is only for @nursing.upenn.edu. Use Google sign-in for other addresses.'));
  conflicted constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'That profile is linked to a different sign-in. Ask an admin to unlink it.'));
begin
  if email = '' or uid is null then
    return reject;
  end if;

  select lower(u.email), u.email_confirmed_at is not null,
         coalesce(u.raw_app_meta_data ->> 'local_dev_password_login', '') = 'true'
  into stored, confirmed, dev_password_login
  from auth.users u
  where u.id = uid;

  if stored is null or stored <> email or confirmed is not true then
    return unverified;
  end if;

  -- Supabase Email signup, password, and OTP are separate authentication
  -- methods; restricting the form alone would not restrict their public API.
  -- The exception exists only for seeded local password users.
  if method in ('otp', 'magiclink', 'email/signup', 'password', 'recovery', 'invite')
     and email !~ '^[^@]+@nursing\.upenn\.edu$'
     and not (method = 'password' and dev_password_login) then
    return nursing_only;
  end if;

  if public.is_penn_email(email) then
    canonical_email := public.canonical_penn_email(email);

    -- Prefer the immutable Supabase identity. This keeps a claimed profile
    -- attached when Penn changes the primary email on the same Google account.
    select id into pid
    from public.people
    where auth_user_id = uid
    limit 1;

    if pid is null then
      select id into pid
      from public.people
      where public.canonical_penn_email(penn_email) = canonical_email
      limit 1;
    end if;

    if pid is not null then
      update public.people
      set auth_user_id = uid, claimed_at = now()
      where id = pid and auth_user_id is null;

      perform 1 from public.people where id = pid and auth_user_id = uid;
      if not found then
        return conflicted;
      end if;
    end if;
  else
    select id, personal_auth_user_id into pid, bound
    from public.people
    where personal_email = email and claimed_at is not null
    limit 1;

    if pid is null then
      return reject;
    end if;

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

create or replace function public.create_my_profile(profile_name text, class_year integer)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email text;
  canonical_email text;
  confirmed boolean;
  pid uuid;
  bound uuid;
begin
  if uid is null then
    raise exception 'Sign in before creating a profile' using errcode = '42501';
  end if;

  -- Lock this account so two setup submissions cannot create two profiles.
  select lower(u.email), u.email_confirmed_at is not null
    into email, confirmed
    from auth.users u where u.id = uid for update;
  if confirmed is not true or not coalesce(public.is_penn_email(email), false) then
    raise exception 'A verified Penn email is required' using errcode = '42501';
  end if;
  if profile_name is null or length(trim(profile_name)) = 0 or length(trim(profile_name)) > 100 then
    raise exception 'Name must be between 1 and 100 characters' using errcode = '22023';
  end if;
  if class_year is null or class_year not between 1900 and 2200 then
    raise exception 'Enter a valid four-digit class year' using errcode = '22023';
  end if;

  canonical_email := public.canonical_penn_email(email);

  -- A stale JWT may lack person_id even though another tab (or an admin) has
  -- already created the profile. Reuse that row without changing its details.
  select id into pid from public.people where auth_user_id = uid;
  if pid is not null then return pid; end if;

  select id, auth_user_id into pid, bound
    from public.people
    where public.canonical_penn_email(penn_email) = canonical_email
    for update;
  if pid is not null then
    if bound is not null and bound <> uid then
      raise exception 'That profile is linked to a different sign-in. Ask an admin to unlink it.' using errcode = '42501';
    end if;
    -- The auth hook performs the actual claim during the session refresh.
    -- This RPC must not bypass the protected-column update guard.
    return pid;
  end if;

  insert into public.people (display_name, grad_year, penn_email, auth_user_id, claimed_at)
    values (trim(profile_name), class_year, canonical_email, uid, now()) returning id into pid;
  return pid;
end $$;

revoke all on function public.canonical_penn_email(text) from public, anon;
grant execute on function public.canonical_penn_email(text) to authenticated, service_role;
revoke all on function public.normalize_people_penn_email() from public, anon, authenticated;
