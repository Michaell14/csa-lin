alter table public.people
  add column preferred_name text check (preferred_name is null or length(preferred_name) <= 80),
  add column pronouns text check (pronouns is null or length(pronouns) <= 50),
  add column school text check (school is null or length(school) <= 100),
  add column current_city text check (current_city is null or length(current_city) <= 100),
  add column interests text check (interests is null or length(interests) <= 300),
  add column csa_role text check (csa_role is null or length(csa_role) <= 100);

grant select (preferred_name, pronouns, school, current_city, interests, csa_role)
  on public.people to authenticated;

create or replace view public.people_with_contact
with (security_barrier = true) as
  select p.* from public.people p
  where public.is_admin() or p.id = public.current_person_id();

