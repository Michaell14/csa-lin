-- Graph traversal over confirmed links, plus cycle prevention.

create or replace function public.ancestors_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  with recursive up as (
    select l.big_id as id
    from public.links l
    where l.little_id = p and l.status = 'confirmed'
    union
    select l.big_id
    from public.links l
    join up on l.little_id = up.id
    where l.status = 'confirmed'
  )
  select id from up;
$$;

create or replace function public.descendants_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  with recursive down as (
    select l.little_id as id
    from public.links l
    where l.big_id = p and l.status = 'confirmed'
    union
    select l.little_id
    from public.links l
    join down on l.big_id = down.id
    where l.status = 'confirmed'
  )
  select id from down;
$$;

-- Founder is always returned (even if hidden) so the UI can draw a placeholder root.
create or replace function public.lin_members(lin uuid)
returns table (person_id uuid, is_founder boolean)
language sql stable
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
  where l.id = lin
    and p.hidden = false
    and p.merged_into is null;
$$;

create or replace function public.lins_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  select l.id
  from public.lins l
  where l.founder_id = p
     or l.founder_id in (select public.ancestors_of(p));
$$;

create or replace function public.prevent_link_cycle() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.little_id = new.big_id
     or new.little_id in (select public.ancestors_of(new.big_id)) then
    raise exception 'link would create a cycle' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger links_no_cycle
  before insert or update of big_id, little_id, status on public.links
  for each row execute function public.prevent_link_cycle();
