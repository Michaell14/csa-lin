-- Traverse all lins together and count the same people as lin_members: every
-- founder (including a hidden placeholder) and visible descendants. UNION
-- deduplicates people reached by multiple paths and prevents cycles.
create function public.lin_member_counts()
returns table (lin_id uuid, member_count bigint)
language sql stable security invoker
set search_path = public
as $$
  with recursive members (lin_id, person_id) as (
    select id, founder_id from public.lins
    union
    select m.lin_id, link.little_id
    from members m
    join public.links link
      on link.big_id = m.person_id and link.status = 'confirmed'
  )
  select l.id,
    count(*) filter (where m.person_id = l.founder_id
      or (p.id is not null and p.hidden = false and p.merged_into is null))
  from public.lins l
  join members m on m.lin_id = l.id
  left join public.people p on p.id = m.person_id
  group by l.id;
$$;

revoke all on function public.lin_member_counts() from public, anon;
grant execute on function public.lin_member_counts() to authenticated;
