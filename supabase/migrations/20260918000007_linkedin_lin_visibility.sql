-- LinkedIn gets its own visibility switch, separate from major.
--
-- Until now show_professional covered both major and linkedin. Major stays on
-- show_professional (visible to every signed-in Penn user by default, like
-- hometown, bio and Instagram). LinkedIn moves to show_linkedin, which defaults
-- to false: only members who share a lin with the person, the person
-- themselves, and admins can read it. Setting show_linkedin to true opens it to
-- every signed-in Penn user, like the other fields.

alter table public.people add column show_linkedin boolean not null default false;
grant select (show_linkedin) on public.people to authenticated;

-- True when the caller is a member of at least one of the person's lins. lins_of
-- derives membership from confirmed links and includes each lin's founder, so
-- this is the same notion of "shares a lin" the corrections policy uses. Both
-- sides use the caller's privileges: lins and confirmed links are readable by
-- every signed-in user.
create or replace function public.shares_lin_with(person uuid) returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1
    from public.lins_of(public.current_person_id()) as mine(lin_id)
    join public.lins_of(person) as theirs(lin_id) using (lin_id)
  );
$$;
revoke execute on function public.shares_lin_with(uuid) from anon, public;
grant execute on function public.shares_lin_with(uuid) to authenticated;

drop view public.people_public;
create view public.people_public with (security_barrier = true) as
select id, display_name, grad_year, claimed_at, photo_path,
  case when show_professional or id = public.current_person_id() or public.is_admin() then major end major,
  case when show_location or id = public.current_person_id() or public.is_admin() then hometown end hometown,
  case when show_bio_interests or id = public.current_person_id() or public.is_admin() then bio end bio,
  case when show_socials or id = public.current_person_id() or public.is_admin() then instagram end instagram,
  case when show_linkedin or id = public.current_person_id() or public.is_admin() or public.shares_lin_with(id) then linkedin end linkedin,
  show_location, show_bio_interests, show_socials, show_professional, show_linkedin,
  hidden, created_at, updated_at
from public.people
where public.is_admin() or not hidden;
revoke all on public.people_public from anon, public;
grant select on public.people_public to authenticated;

-- "select p.*" is frozen at creation, so the view must be recreated to carry
-- the new column (see ..._contact_view_all_columns.sql).
create or replace view public.people_with_contact with (security_barrier = true) as
select p.* from public.people p
where public.is_admin() or p.id = public.current_person_id();

create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)),
 -- Everyone in the requested lin shares it with a viewer who is a member of it;
 -- a viewer from outside still shares a lin with a node they meet elsewhere.
 viewer_in_lin as (select lin in (select public.lins_of(public.current_person_id())) as yes),
 nodes as (
 select p.id,m.is_founder,(p.hidden) placeholder,
 case when p.hidden then null else p.display_name end display_name,
 case when p.hidden then null else p.grad_year end grad_year,
 case when p.hidden then null else p.photo_path end photo_path,
 case when p.hidden or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.major end major,
 case when p.hidden or not coalesce(p.show_location or p.id=public.current_person_id() or public.is_admin(), false) then null else p.hometown end hometown,
 case when p.hidden or not coalesce(p.show_bio_interests or p.id=public.current_person_id() or public.is_admin(), false) then null else p.bio end bio,
 case when p.hidden or not coalesce(p.show_socials or p.id=public.current_person_id() or public.is_admin(), false) then null else p.instagram end instagram,
 case when p.hidden or not coalesce(p.show_linkedin or p.id=public.current_person_id() or public.is_admin() or (select yes from viewer_in_lin) or public.shares_lin_with(p.id), false) then null else p.linkedin end linkedin,
 case when p.hidden then null else p.claimed_at is not null end claimed
 from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id) order by l.created_at)
 from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;
