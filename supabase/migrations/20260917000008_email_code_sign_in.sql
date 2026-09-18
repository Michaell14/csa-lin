-- Keep the verified-email and first-claim rules. Only Nursing mailboxes may
-- authenticate through the Email provider; all other members use Google.
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
    select id into pid
    from public.people
    where penn_email = email and merged_into is null
    limit 1;

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
    where personal_email = email and claimed_at is not null and merged_into is null
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
