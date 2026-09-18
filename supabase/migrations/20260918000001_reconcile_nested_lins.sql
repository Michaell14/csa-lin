-- A lin founded below another lin's founder is redundant: everyone in the
-- lower lin is already in the upper one. Distinct big branches remain distinct
-- lins, including for their shared descendants.

-- Keep a generated name in step when its founder moves up the chain. A name
-- edited by a founder or admin is preserved.
create function public.available_lin_name(root uuid, excluded_lin uuid)
returns text language plpgsql stable set search_path = public as $$
declare
  base text;
  candidate text;
begin
  select display_name || '''s Lin' into base from public.people where id = root;
  if base is null then raise exception 'no person % to found a lin', root; end if;
  for n in 1..100 loop
    candidate := case when n = 1 then base else base || ' ' || n end;
    if not exists (select 1 from public.lins where name = candidate and id is distinct from excluded_lin) then
      return candidate;
    end if;
  end loop;
  raise exception 'no free name for %', base;
end $$;

create or replace function public.ensure_lin_for_link() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  root uuid;
  carried public.lins%rowtype;
  old_base text;
  generated_name boolean;
begin
  if new.status <> 'confirmed' or
     (tg_op = 'UPDATE' and old.status = 'confirmed'
      and old.big_id = new.big_id and old.little_id = new.little_id) then
    return new;
  end if;

  -- Serialise both founding and reconciliation. In particular, two links
  -- confirmed at once must not each keep a newly nested lin.
  perform pg_advisory_xact_lock(20260915000001);

  -- A person can have several bigs, hence several top roots. Each root needs
  -- its own lin; sharing a descendant does not merge the big branches.
  for root in
    with chain as (
      select new.big_id as id
      union
      select public.ancestors_of(new.big_id)
    )
    select c.id from chain c join public.people p on p.id = c.id
    where not exists (
      select 1 from public.links l
      where l.little_id = c.id and l.status = 'confirmed'
    )
    order by p.grad_year, p.display_name, p.id
  loop
    if exists (select 1 from public.lins where founder_id = root) then
      continue;
    end if;

    -- Carry the little's existing lin up to the first root that needs one.
    -- If every root already has a lin, it is removed as redundant below.
    select * into carried from public.lins
    where founder_id = new.little_id
    order by created_at, id limit 1;
    if found then
      select display_name || '''s Lin' into old_base
      from public.people where id = carried.founder_id;
      generated_name := carried.name = old_base
        or (left(carried.name, length(old_base) + 1) = old_base || ' '
            and substring(carried.name from length(old_base) + 2) ~ '^[2-9][0-9]*$');
      update public.lins
      set founder_id = root,
          name = case when generated_name then public.available_lin_name(root, carried.id)
                      else carried.name end
      where id = carried.id;
    else
      perform public.found_lin(root);
    end if;
  end loop;

  -- Remove only lins nested along the same big → little path. If two founders
  -- reach the same person through different bigs, neither is an ancestor of
  -- the other and both lins stay.
  delete from public.lins child
  where exists (
    select 1 from public.lins parent
    where parent.id <> child.id
      and parent.founder_id in (select public.ancestors_of(child.founder_id))
  );
  return new;
end $$;

drop trigger links_found_lin on public.links;
create trigger links_found_lin
  after insert or update of status, big_id, little_id on public.links
  for each row execute function public.ensure_lin_for_link();

-- Reconcile rows created under the earlier policy. Keep the oldest row for
-- duplicate founders, then remove lins nested below another founder.
with ranked as (
  select id, row_number() over (partition by founder_id order by created_at, id) as rank
  from public.lins
)
delete from public.lins l using ranked r where l.id = r.id and r.rank > 1;

delete from public.lins child
where exists (
  select 1 from public.lins parent
  where parent.id <> child.id
    and parent.founder_id in (select public.ancestors_of(child.founder_id))
);

create unique index lins_one_per_founder on public.lins(founder_id);

-- Admin creation/reassignment must obey the same rule. The link trigger runs
-- its internal lin writes at trigger depth > 1 and reconciles before commit.
create function public.guard_lin_structure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'authenticated' or pg_trigger_depth() > 1
     or (tg_op = 'UPDATE' and new.founder_id is not distinct from old.founder_id) then
    return new;
  end if;
  -- BEFORE triggers run before RLS checks. Preserve the existing permission
  -- error for members and avoid revealing the shape of other people's lins.
  if public.is_admin() is not true then
    raise exception 'Only an admin can create or reassign a lin'
      using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(20260915000001);
  if exists (
    select 1 from public.lins l
    where l.id is distinct from new.id
      and (l.founder_id = new.founder_id
        or l.founder_id in (select public.ancestors_of(new.founder_id))
        or l.founder_id in (select public.descendants_of(new.founder_id)))
  ) then
    raise exception 'This founder is already on another lin''s big/little path'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger lins_guard_structure
  before insert or update of founder_id on public.lins
  for each row execute function public.guard_lin_structure();

revoke execute on function public.available_lin_name(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.guard_lin_structure() from public, anon, authenticated;
