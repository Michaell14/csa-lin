-- Guest accounts: shared, read-only sign-ins for people outside Penn (a demo
-- for a recruiter, another school's CSA). A guest signs in with the password an
-- admin gave out, never gets a person_id, and carries a `guest` claim so the app
-- shows the tree instead of profile setup. With no person_id, every write policy
-- already refuses them; reads are those of any signed-in member.
--
-- An admin creates the user in the dashboard (Add user skips the Nursing-only
-- signup hook) and lists its address here. See "Guest accounts" in
-- supabase/README.md.

create table public.guest_accounts (
  email text primary key
    check (email = lower(trim(email)) and not public.is_penn_email(email)),
  created_at timestamptz not null default now()
);

comment on table public.guest_accounts is
  'Non-Penn addresses that may sign in with a password as read-only guests.';

-- Only the security-definer functions below read it.
alter table public.guest_accounts enable row level security;
revoke all on public.guest_accounts from anon, authenticated;

create function public.is_guest_email(address text) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.guest_accounts g where g.email = lower(trim(address)));
$$;

revoke all on function public.is_guest_email(text) from public, anon, authenticated;
grant execute on function public.is_guest_email(text) to supabase_auth_admin;

-- Unchanged from 20260921000001_engineering_email_aliases.sql apart from the
-- guest branch, which runs before the Nursing-only rule would refuse a password.
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
  guest_password_only constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Guest accounts sign in with their password.'));
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

  -- A guest is a viewer with no profile, whatever else the address matches.
  -- Only the admin-issued password (and refreshing that session) gets in, so
  -- nobody holding the mailbox can take the account over with a code or link.
  if public.is_guest_email(email) then
    if method not in ('password', 'token_refresh') then
      return guest_password_only;
    end if;
    claims := claims || jsonb_build_object('person_id', null, 'guest', true);
    return jsonb_set(event, '{claims}', claims);
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

-- Everyone who has the guest password shares one account, so any of them could
-- change its password or email through the Auth API and lock the rest out.
-- Changes arriving through Auth (which connects as supabase_auth_admin) are
-- dropped for guests; an admin resets the password from the SQL editor instead.
create function public.keep_guest_credentials() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'supabase_auth_admin' and public.is_guest_email(old.email) then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.email_change := old.email_change;
    new.phone := old.phone;
    new.phone_change := old.phone_change;
  end if;
  return new;
end $$;

revoke all on function public.keep_guest_credentials() from public, anon, authenticated;
grant execute on function public.keep_guest_credentials() to supabase_auth_admin;

create trigger keep_guest_credentials
  before update on auth.users
  for each row execute function public.keep_guest_credentials();
