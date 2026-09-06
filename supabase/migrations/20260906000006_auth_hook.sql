-- Custom access token hook: gates sign-in and stamps person_id into the JWT.
-- Runs as supabase_auth_admin; security definer so it can read/write people.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid    uuid  := (event ->> 'user_id')::uuid;
  email  text  := lower(coalesce(claims ->> 'email', ''));
  pid    uuid;
  reject constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with your Penn Google account.'));
begin
  if email = '' then
    return reject;
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

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
