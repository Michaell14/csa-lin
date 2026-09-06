-- Helpers used by RLS policies and the auth hook.

create or replace function public.is_penn_email(email text) returns boolean
language sql immutable
as $$
  select lower(email) ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*upenn\.edu$';
$$;

-- The auth hook (Task 7) stamps person_id into the JWT. Null for viewers.
create or replace function public.current_person_id() returns uuid
language sql stable
as $$
  select nullif(nullif(auth.jwt() ->> 'person_id', ''), 'null')::uuid;
$$;

-- security definer so it can read admins regardless of policies on that table.
create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.person_id = public.current_person_id()
  );
$$;

revoke execute on function public.is_admin() from anon;
