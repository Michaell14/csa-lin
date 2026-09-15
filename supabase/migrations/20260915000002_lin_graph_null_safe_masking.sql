-- Security fix: make lin_graph's field-masking null-safe.
--
-- The masking CASEs read `not (show_X or id=current_person_id() or is_admin())`.
-- For a signed-in viewer with no profile row, current_person_id() is null, so
-- `id = current_person_id()` is NULL. With an opted-out member (show_X = false)
-- and a non-admin viewer, the predicate is `false or NULL or false` = NULL,
-- `not NULL` = NULL, and `CASE WHEN NULL` falls through to ELSE — leaking the
-- real value. coalesce(..., false) treats the unknown as "not visible" so the
-- viewer is correctly excluded. (people_public in 20260913000005 uses the
-- opposite `CASE WHEN <positive> THEN value END` shape and is already null-safe.)
create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)), nodes as (
 select p.id,m.is_founder,(p.hidden or p.merged_into is not null) placeholder,case when p.hidden or p.merged_into is not null then null else p.display_name end display_name,p.grad_year,
 case when p.hidden or p.merged_into is not null then null else p.photo_path end photo_path,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.major end major,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_location or p.id=public.current_person_id() or public.is_admin(), false) then null else p.hometown end hometown,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_bio_interests or p.id=public.current_person_id() or public.is_admin(), false) then null else p.bio end bio,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_socials or p.id=public.current_person_id() or public.is_admin(), false) then null else p.instagram end instagram,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.linkedin end linkedin,
 case when p.hidden or p.merged_into is not null then null else p.claimed_at is not null end claimed from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id,'academic_year',l.academic_year) order by l.created_at) from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;
