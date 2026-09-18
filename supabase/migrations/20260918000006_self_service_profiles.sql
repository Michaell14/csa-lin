-- A verified Penn account without a pre-existing person can make its own
-- profile. Keep the table's admin-only INSERT policy: callers never choose the
-- email, auth binding, claim timestamp, or any protected profile columns.
create function public.create_my_profile(profile_name text, class_year integer)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email text;
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

  -- A stale JWT may lack person_id even though another tab (or an admin) has
  -- already created the profile. Reuse that row without changing its details.
  select id into pid from public.people where auth_user_id = uid;
  if pid is not null then return pid; end if;

  select id, auth_user_id into pid, bound
    from public.people where penn_email = email for update;
  if pid is not null then
    if bound is not null and bound <> uid then
      raise exception 'That profile is linked to a different sign-in. Ask an admin to unlink it.' using errcode = '42501';
    end if;
    -- The auth hook performs the actual claim during the session refresh.
    -- This RPC must not bypass the protected-column update guard.
    return pid;
  end if;

  insert into public.people (display_name, grad_year, penn_email, auth_user_id, claimed_at)
    values (trim(profile_name), class_year, email, uid, now()) returning id into pid;
  return pid;
end $$;

revoke all on function public.create_my_profile(text, integer) from public, anon;
grant execute on function public.create_my_profile(text, integer) to authenticated;

-- Members may report their own profile before they have a confirmed link.
drop policy correction_insert on public.correction_requests;
create policy correction_insert on public.correction_requests for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and status = 'pending'
    and resolved_by is null
    and resolved_at is null
    and kind in ('profile', 'relationship')
    and person_id is not null
    and (
      person_id = public.current_person_id()
      or exists (
        select 1
        from public.lins_of(public.current_person_id()) as mine(lin_id)
        join public.lins_of(person_id) as theirs(lin_id) using (lin_id)
      )
    )
  );
