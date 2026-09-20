-- shares_lin_with(person) walked the person's ancestry for every row it was
-- asked about, so people_public and lin_graph paid a recursive query per
-- person for any viewer outside the lin (300 ms for a 400-member lin, and the
-- same again for a name search). The set of people who share a lin with the
-- caller does not depend on the row, so compute it once per query instead:
-- lin_circle() returns it, and the view and graph test membership with an
-- IN (subquery), which Postgres evaluates once as a hash.
create or replace function public.lin_circle() returns setof uuid
language sql stable
set search_path = public
as $$
  select m.person_id
  from public.lins_of(public.current_person_id()) as v(lin_id)
  cross join lateral public.lin_members(v.lin_id) as m;
$$;
revoke execute on function public.lin_circle() from anon, public;
grant execute on function public.lin_circle() to authenticated;

-- Same answer as before, for callers that want it per person.
create or replace function public.shares_lin_with(person uuid) returns boolean
language sql stable
set search_path = public
as $$
  select person in (select public.lin_circle());
$$;

drop view public.people_public;
create view public.people_public with (security_barrier = true) as
select id, display_name, grad_year, claimed_at, photo_path,
  case when show_professional or id = public.current_person_id() or public.is_admin() then major end major,
  case when show_location or id = public.current_person_id() or public.is_admin() then hometown end hometown,
  case when show_bio_interests or id = public.current_person_id() or public.is_admin() then bio end bio,
  case when show_socials or id = public.current_person_id() or public.is_admin() then instagram end instagram,
  case when show_linkedin or id = public.current_person_id() or public.is_admin() or id in (select public.lin_circle()) then linkedin end linkedin,
  show_location, show_bio_interests, show_socials, show_professional, show_linkedin,
  hidden, created_at, updated_at
from public.people
where public.is_admin() or not hidden;
revoke all on public.people_public from anon, public;
grant select on public.people_public to authenticated;

create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)),
 circle as (select public.lin_circle() as id),
 nodes as (
 select p.id,m.is_founder,(p.hidden) placeholder,
 case when p.hidden then null else p.display_name end display_name,
 case when p.hidden then null else p.grad_year end grad_year,
 case when p.hidden then null else p.photo_path end photo_path,
 case when p.hidden or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.major end major,
 case when p.hidden or not coalesce(p.show_location or p.id=public.current_person_id() or public.is_admin(), false) then null else p.hometown end hometown,
 case when p.hidden or not coalesce(p.show_bio_interests or p.id=public.current_person_id() or public.is_admin(), false) then null else p.bio end bio,
 case when p.hidden or not coalesce(p.show_socials or p.id=public.current_person_id() or public.is_admin(), false) then null else p.instagram end instagram,
 case when p.hidden or not coalesce(p.show_linkedin or p.id=public.current_person_id() or public.is_admin() or p.id in (select id from circle), false) then null else p.linkedin end linkedin,
 case when p.hidden then null else p.claimed_at is not null end claimed
 from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id) order by l.created_at)
 from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;
