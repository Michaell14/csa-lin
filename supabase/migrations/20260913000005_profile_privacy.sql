alter table public.people add column show_location boolean not null default true, add column show_bio_interests boolean not null default true, add column show_socials boolean not null default true, add column show_professional boolean not null default true;
revoke select (hometown, current_city, bio, interests, instagram, linkedin, major, school, csa_role) on public.people from authenticated;
grant select (show_location, show_bio_interests, show_socials, show_professional) on public.people to authenticated;
create view public.people_public with (security_barrier=true) as select id,display_name,preferred_name,pronouns,grad_year,claimed_at,photo_path,
case when show_professional or id=public.current_person_id() or public.is_admin() then major end major, case when show_professional or id=public.current_person_id() or public.is_admin() then school end school, case when show_professional or id=public.current_person_id() or public.is_admin() then csa_role end csa_role,
case when show_location or id=public.current_person_id() or public.is_admin() then hometown end hometown, case when show_location or id=public.current_person_id() or public.is_admin() then current_city end current_city,
case when show_bio_interests or id=public.current_person_id() or public.is_admin() then bio end bio, case when show_bio_interests or id=public.current_person_id() or public.is_admin() then interests end interests,
case when show_socials or id=public.current_person_id() or public.is_admin() then instagram end instagram, case when show_professional or id=public.current_person_id() or public.is_admin() then linkedin end linkedin,
show_location,show_bio_interests,show_socials,show_professional,hidden,merged_into,created_at,updated_at from public.people where public.is_admin() or (not hidden and merged_into is null);
revoke all on public.people_public from anon,public; grant select on public.people_public to authenticated;

create or replace function public.lin_graph(lin uuid) returns jsonb language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)), nodes as (
 select p.id,m.is_founder,(p.hidden or p.merged_into is not null) placeholder,case when p.hidden or p.merged_into is not null then null else p.display_name end display_name,p.grad_year,
 case when p.hidden or p.merged_into is not null then null else p.photo_path end photo_path,
 case when p.hidden or p.merged_into is not null or not p.show_professional then null else p.major end major,
 case when p.hidden or p.merged_into is not null or not p.show_location then null else p.hometown end hometown,
 case when p.hidden or p.merged_into is not null or not p.show_bio_interests then null else p.bio end bio,
 case when p.hidden or p.merged_into is not null or not p.show_socials then null else p.instagram end instagram,
 case when p.hidden or p.merged_into is not null or not p.show_professional then null else p.linkedin end linkedin,
 case when p.hidden or p.merged_into is not null then null else p.claimed_at is not null end claimed from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id,'academic_year',l.academic_year) order by l.created_at) from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;
revoke execute on function public.lin_graph(uuid) from anon,public; grant execute on function public.lin_graph(uuid) to authenticated;
