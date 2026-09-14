-- Review follow-ups for milestones and profile privacy.
create or replace function public.set_milestone_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := public.current_person_id();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
create trigger lin_milestones_set_creator before insert or update on public.lin_milestones
  for each row execute function public.set_milestone_creator();

drop policy milestones_insert_admin on public.lin_milestones;
create policy milestones_insert_admin on public.lin_milestones for insert to authenticated
  with check (public.is_admin() and created_by = public.current_person_id());

create trigger lin_milestones_log after insert or update or delete on public.lin_milestones
  for each row execute function public.log_change();

create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)), nodes as (
 select p.id,m.is_founder,(p.hidden or p.merged_into is not null) placeholder,case when p.hidden or p.merged_into is not null then null else p.display_name end display_name,p.grad_year,
 case when p.hidden or p.merged_into is not null then null else p.photo_path end photo_path,
 case when p.hidden or p.merged_into is not null or not (p.show_professional or p.id=public.current_person_id() or public.is_admin()) then null else p.major end major,
 case when p.hidden or p.merged_into is not null or not (p.show_location or p.id=public.current_person_id() or public.is_admin()) then null else p.hometown end hometown,
 case when p.hidden or p.merged_into is not null or not (p.show_bio_interests or p.id=public.current_person_id() or public.is_admin()) then null else p.bio end bio,
 case when p.hidden or p.merged_into is not null or not (p.show_socials or p.id=public.current_person_id() or public.is_admin()) then null else p.instagram end instagram,
 case when p.hidden or p.merged_into is not null or not (p.show_professional or p.id=public.current_person_id() or public.is_admin()) then null else p.linkedin end linkedin,
 case when p.hidden or p.merged_into is not null then null else p.claimed_at is not null end claimed from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id,'academic_year',l.academic_year) order by l.created_at) from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;
