-- These optional profile fields are no longer part of the product. Views must
-- be recreated before their source columns can be removed.
drop view public.people_public;
drop view public.people_with_contact;

alter table public.people
  drop column preferred_name,
  drop column pronouns,
  drop column school,
  drop column csa_role,
  drop column current_city,
  drop column interests;

create view public.people_public with (security_barrier = true) as
select id, display_name, grad_year, claimed_at, photo_path,
  case when show_professional or id = public.current_person_id() or public.is_admin() then major end major,
  case when show_location or id = public.current_person_id() or public.is_admin() then hometown end hometown,
  case when show_bio_interests or id = public.current_person_id() or public.is_admin() then bio end bio,
  case when show_socials or id = public.current_person_id() or public.is_admin() then instagram end instagram,
  case when show_professional or id = public.current_person_id() or public.is_admin() then linkedin end linkedin,
  show_location, show_bio_interests, show_socials, show_professional,
  hidden, merged_into, created_at, updated_at
from public.people
where public.is_admin() or (not hidden and merged_into is null);
revoke all on public.people_public from anon, public;
grant select on public.people_public to authenticated;

create view public.people_with_contact with (security_barrier = true) as
select p.* from public.people p
where public.is_admin() or p.id = public.current_person_id();
revoke all on public.people_with_contact from anon, public;
grant select on public.people_with_contact to authenticated;
comment on view public.people_with_contact is
  'people rows including penn_email, personal_email and auth_user_id: own row for members, all rows for admins.';
