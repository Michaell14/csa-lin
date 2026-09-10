-- The access token hook only trusted the email claim. If email/password
-- sign-up were ever enabled in the dashboard with confirmations off, anyone
-- could register as victim@upenn.edu and claim that profile. The hook now
-- also requires that Supabase Auth has verified the address (Google reports
-- email_verified; email sign-up sets it on confirmation) and that the claim
-- matches the stored user email.
--
-- It also stops handing out a person_id the caller is not bound to. The claim
-- update is guarded by "auth_user_id is null", so a profile already bound to
-- another Auth user silently skipped it and got its person_id issued anyway.
-- An Auth account deleted and recreated under the same Penn address would
-- inherit the old binding's profile, administrator rights included.

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
    select id into pid
    from public.people
    where personal_email = email and claimed_at is not null and merged_into is null
    limit 1;

    if pid is null then
      return reject;
    end if;
  end if;

  claims := claims || jsonb_build_object('person_id', pid);
  return jsonb_set(event, '{claims}', claims);
end $$;
