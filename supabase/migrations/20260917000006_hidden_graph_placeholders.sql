-- Keep hidden descendants in the lin's topology, while masking their identity.
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
  where l.id = lin and p.merged_into is null;
$$;

revoke all on function public.lin_members(uuid) from public, anon;
grant execute on function public.lin_members(uuid) to authenticated;

create or replace function public.lin_graph(lin uuid) returns jsonb
language sql stable security definer set search_path=public as $$
with members as (select person_id,is_founder from public.lin_members(lin)), nodes as (
 select p.id,m.is_founder,(p.hidden or p.merged_into is not null) placeholder,
 case when p.hidden or p.merged_into is not null then null else p.display_name end display_name,
 case when p.hidden or p.merged_into is not null then null else p.grad_year end grad_year,
 case when p.hidden or p.merged_into is not null then null else p.photo_path end photo_path,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.major end major,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_location or p.id=public.current_person_id() or public.is_admin(), false) then null else p.hometown end hometown,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_bio_interests or p.id=public.current_person_id() or public.is_admin(), false) then null else p.bio end bio,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_socials or p.id=public.current_person_id() or public.is_admin(), false) then null else p.instagram end instagram,
 case when p.hidden or p.merged_into is not null or not coalesce(p.show_professional or p.id=public.current_person_id() or public.is_admin(), false) then null else p.linkedin end linkedin,
 case when p.hidden or p.merged_into is not null then null else p.claimed_at is not null end claimed
 from members m join public.people p on p.id=m.person_id)
select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(n) order by n.grad_year,n.display_name) from nodes n),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'big_id',l.big_id,'little_id',l.little_id) order by l.created_at)
 from public.links l where l.status='confirmed' and l.big_id in(select person_id from members) and l.little_id in(select person_id from members)),'[]'::jsonb)); $$;

-- Keep sidebar counts in step with the graph, including anonymous placeholders.
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
      or (p.id is not null and p.merged_into is null))
  from public.lins l
  join members m on m.lin_id = l.id
  left join public.people p on p.id = m.person_id
  group by l.id;
$$;
