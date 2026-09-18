-- Remove the unused merge column after replacing every live object that
-- referenced it. The earlier migrations are retained for database history.
do $$ begin
  if exists (select 1 from public.people where merged_into is not null) then
    raise exception 'Cannot remove merged_into while merged profiles exist';
  end if;
end $$;

create or replace function public.guard_people_update() returns trigger
language plpgsql set search_path = public as $$
declare
  cleared_binding boolean := false;
begin
  -- Changing a personal address must still release its old Auth binding.
  if new.personal_email is distinct from old.personal_email
     and new.personal_auth_user_id is not distinct from old.personal_auth_user_id then
    new.personal_auth_user_id := null;
    cleared_binding := true;
  end if;

  if auth.role() is distinct from 'authenticated' then
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
  or new.auth_user_id          is distinct from old.auth_user_id
  or (not cleared_binding
      and new.personal_auth_user_id is distinct from old.personal_auth_user_id)
  or new.claimed_at            is distinct from old.claimed_at
  or new.created_at            is distinct from old.created_at then
    raise exception 'not allowed to change protected fields' using errcode = '42501';
  end if;
  return new;
end $$;

drop policy people_select on public.people;
create policy people_select on public.people
  for select to authenticated
  using (public.is_admin() or hidden = false);

drop policy photos_read on storage.objects;
create policy photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or public.photo_owner(name) = public.current_person_id()
      or exists (
        select 1 from public.people p
        where p.id = public.photo_owner(name)
          and p.hidden = false
      )
    )
  );

create or replace function public.lin_members(lin uuid)
returns table (person_id uuid, is_founder boolean)
language sql stable security definer
set search_path = public
as $$
  select l.founder_id, true
  from public.lins l
  where l.id = lin
  union
  select d.id, false
  from public.lins l
  cross join lateral public.descendants_of(l.founder_id) as d(id)
  join public.people p on p.id = d.id
  where l.id = lin;
$$;

create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)), nodes as (
 select p.id,m.is_founder,(p.hidden) placeholder,
 case when p.hidden then null else p.display_name end display_name,
 case when p.hidden then null else p.grad_year end grad_year,
 case when p.hidden then null else p.photo_path end photo_path,
 case when p.hidden or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.major end major,
 case when p.hidden or not coalesce(p.show_location or p.id=public.current_person_id() or public.is_admin(), false) then null else p.hometown end hometown,
 case when p.hidden or not coalesce(p.show_bio_interests or p.id=public.current_person_id() or public.is_admin(), false) then null else p.bio end bio,
 case when p.hidden or not coalesce(p.show_socials or p.id=public.current_person_id() or public.is_admin(), false) then null else p.instagram end instagram,
 case when p.hidden or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.linkedin end linkedin,
 case when p.hidden then null else p.claimed_at is not null end claimed
 from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id) order by l.created_at)
 from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;

create or replace function public.lin_member_counts()
returns table (lin_id uuid, member_count bigint)
language sql stable security definer
set search_path = public
as $$
  with recursive members (lin_id, person_id) as (
    select id, founder_id from public.lins
    union
    select m.lin_id, link.little_id
    from members m
    join public.links link on link.big_id = m.person_id and link.status = 'confirmed'
  )
  select l.id,
    count(*) filter (where m.person_id = l.founder_id
      or (p.id is not null))
  from public.lins l
  join members m on m.lin_id = l.id
  left join public.people p on p.id = m.person_id
  group by l.id;
$$;

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
    where penn_email = email
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

drop view public.people_public;
drop view public.people_with_contact;

alter table public.people drop column merged_into;

create view public.people_public with (security_barrier = true) as
select id, display_name, grad_year, claimed_at, photo_path,
  case when show_professional or id = public.current_person_id() or public.is_admin() then major end major,
  case when show_location or id = public.current_person_id() or public.is_admin() then hometown end hometown,
  case when show_bio_interests or id = public.current_person_id() or public.is_admin() then bio end bio,
  case when show_socials or id = public.current_person_id() or public.is_admin() then instagram end instagram,
  case when show_professional or id = public.current_person_id() or public.is_admin() then linkedin end linkedin,
  show_location, show_bio_interests, show_socials, show_professional,
  hidden, created_at, updated_at
from public.people
where public.is_admin() or not hidden;
revoke all on public.people_public from anon, public;
grant select on public.people_public to authenticated;

create view public.people_with_contact with (security_barrier = true) as
select p.* from public.people p
where public.is_admin() or p.id = public.current_person_id();
revoke all on public.people_with_contact from anon, public;
grant select on public.people_with_contact to authenticated;
comment on view public.people_with_contact is
  'people rows including penn_email, personal_email and auth_user_id: own row for members, all rows for admins.';
