-- Link academic years are no longer maintained; member class years provide
-- the relevant context. Replace functions that read the column before dropping it.

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
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id) order by l.created_at) from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;

create or replace function public.guard_links_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;
  if new.big_id      is distinct from old.big_id
  or new.little_id   is distinct from old.little_id
  or new.proposed_by is distinct from old.proposed_by
  or new.created_at  is distinct from old.created_at then
    raise exception 'not allowed to change link parties' using errcode = '42501';
  end if;
  return new;
end $$;

alter table public.links drop column academic_year;
