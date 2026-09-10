-- Column-level privacy on people.
--
-- people_select is row-level only, so until now any signed-in user could read
-- penn_email, personal_email and auth_user_id for every visible person by
-- calling PostgREST directly. The web app only ever asked for those columns on
-- the viewer's own row; the database now enforces that.
--
-- Postgres cannot subtract columns from a table-level SELECT grant, so the
-- table grant is revoked and re-issued as an explicit column list. Any new
-- non-sensitive column added to people must be appended to that list or the
-- app will get "permission denied for table people" on it.

revoke select on table public.people from anon, authenticated;

grant select (
  id, display_name, grad_year, claimed_at, photo_path, major, hometown, bio,
  instagram, linkedin, hidden, merged_into, created_at, updated_at
) on table public.people to authenticated;

-- The contact columns are exposed through one view: a member sees their own
-- row, an admin sees every row. The view is owned by postgres and so reads the
-- table with the owner's privileges (bypassing people_select); the WHERE clause
-- is therefore the whole access rule. security_barrier stops a caller from
-- smuggling a leaky function ahead of that clause.
create view public.people_with_contact
with (security_barrier = true) as
  select p.*
  from public.people p
  where public.is_admin() or p.id = public.current_person_id();

revoke all on public.people_with_contact from anon, public;
grant select on public.people_with_contact to authenticated;

comment on view public.people_with_contact is
  'people rows including penn_email, personal_email and auth_user_id: own row for members, all rows for admins.';
