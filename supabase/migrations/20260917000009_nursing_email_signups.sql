-- Email signups are only for Nursing; Google can still create accounts for
-- other Penn addresses and eligible linked personal addresses.
create function public.before_user_created_nursing_email(event jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
  email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if provider = 'email' and email !~ '^[^@]+@nursing\.upenn\.edu$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Email-code sign-up is only for @nursing.upenn.edu. Use Google sign-in for other addresses.'));
  end if;

  return '{}'::jsonb;
end $$;

grant execute on function public.before_user_created_nursing_email(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created_nursing_email(jsonb) from authenticated, anon, public;
