-- The access token hook only trusted the email claim. If email/password
-- sign-up were ever enabled in the dashboard with confirmations off, anyone
-- could register as victim@upenn.edu and claim that profile. The hook now
-- also requires that Supabase Auth has verified the address (Google reports
-- email_verified; email sign-up sets it on confirmation) and that the claim
-- matches the stored user email.

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
