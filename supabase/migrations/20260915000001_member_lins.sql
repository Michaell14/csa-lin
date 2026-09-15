-- Lins are created by their members, not by admins.
--
-- A lin is a founder plus everyone reachable from them through confirmed
-- big → little links, so the two-party link flow (one person proposes, the
-- other confirms) is already the agreement that a lin exists. What was still
-- an admin job was inserting the `lins` row. The database now does it the
-- moment a link becomes confirmed, whoever confirmed it:
--
--   1. The big already belongs to a lin (as its founder or below one): nothing
--      to do, the little joins by derivation.
--   2. Otherwise the lin belongs at the top of the big's chain: the big, or the
--      ancestors of theirs who have no confirmed big of their own. A lin the
--      little had founded is handed up to that root, so the lin grows upward
--      instead of ending up nested inside a new copy of itself.
--   3. No such lin: a new one is founded by the root, named after them and
--      coloured from the tree palette. The founder can change both.
--
-- The trigger is SECURITY DEFINER so the insert policy on `lins` can stay
-- admin-only: a member cannot conjure a lin with an arbitrary founder, only
-- earn one through a confirmed link. Deleting a lin also stays admin-only, so
-- a lin outlives the link that founded it, and so does one that a later link
-- puts entirely inside another lin (a person can be in several lins).
--
-- Lins that predate this migration keep their founders. A confirmed link
-- below a chain that has no lin yet founds the lin at the chain's top, not at
-- the big who happened to confirm.

-- ---------- naming and colour ----------
-- Mirror of PALETTE in web/src/lib/graph/colors.ts; keep the two in step.
create or replace function public.lin_palette() returns text[]
language sql immutable
set search_path = public
as $$
  select array['#c63d2f', '#d9971f', '#5e8a2e', '#1f8a70', '#4f55c9', '#9b4a9e', '#2a7fa8', '#c4527a'];
$$;

-- The palette colour fewest lins use, earliest in the palette on a tie.
create or replace function public.next_lin_color() returns text
language sql stable
set search_path = public
as $$
  select p.color
  from unnest(public.lin_palette()) with ordinality as p(color, position)
  left join public.lins l on l.color = p.color
  group by p.color, p.position
  order by count(l.id), p.position
  limit 1;
$$;

-- `lins.name` has been unbounded text until now, so a lin an admin named long
-- ago may be longer than the cap the founder editor enforces. NOT VALID applies
-- the cap to every insert and update from here on without scanning what is
-- already there, so one legacy name cannot abort this migration. Unlike
-- `people.display_name`, which 20260910000003 shortened in place, `name` is
-- unique: truncating it could collide with another lin and lose an admin's
-- wording, so the existing rows are left as they are and only edits are capped.
alter table public.lins
  add constraint lins_name_len check (length(name) <= 120) not valid;

-- Inserts a lin founded by `root`, named "<display name>'s Lin" with a number
-- appended while that name is taken: two people can share a display name and
-- `lins.name` is unique, so ON CONFLICT turns that collision into another pass
-- instead of an error.
create or replace function public.found_lin(root uuid) returns uuid
language plpgsql
set search_path = public
as $$
declare
  base    text;
  new_id  uuid;
begin
  select display_name || '''s Lin' into base from public.people where id = root;
  if base is null then
    raise exception 'no person % to found a lin', root;
  end if;
  for n in 1..100 loop
    insert into public.lins (name, color, founder_id)
    values (case when n = 1 then base else base || ' ' || n end, public.next_lin_color(), root)
    on conflict (name) do nothing
    returning id into new_id;
    if new_id is not null then
      return new_id;
    end if;
  end loop;
  raise exception 'no free name for %', base;
end $$;

-- ---------- the trigger ----------
create or replace function public.ensure_lin_for_link() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  root   uuid;
  grown  boolean := false;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then
    return new;
  end if;

  if exists (select 1 from public.lins_of(new.big_id)) then
    return new;
  end if;

  -- Founding is serialised from here to commit, under one lock keyed on this
  -- migration's number (an arbitrary constant, no other lock uses it).
  --
  -- Two links confirmed at once under the same lin-less root both get past the
  -- `lins_of` check above, because neither had inserted anything yet. Holding
  -- the lock means the re-check in the loop below runs only once the winner's
  -- lin is visible, so the lineage ends up with that one lin -- the outcome the
  -- two confirmations already had when they arrived one after the other and the
  -- second returned early at `lins_of`.
  --
  -- The lock covers `next_lin_color` too: it counts the lins that exist, so two
  -- foundings for *different* roots would otherwise both read the counts before
  -- either had inserted, and hand out the same colour while others went unused.
  perform pg_advisory_xact_lock(20260915000001);

  -- The big and their ancestors who have no confirmed big: the top of the
  -- chain. Two bigs with no lin between them are two roots, and two lins.
  for root in
    with chain as (
      select new.big_id as id
      union
      select public.ancestors_of(new.big_id)
    )
    select c.id
    from chain c
    join public.people p on p.id = c.id
    where not exists (
      select 1 from public.links l
      where l.little_id = c.id and l.status = 'confirmed'
    )
    order by p.grad_year, p.display_name, p.id
  loop
    -- A root that already has a lin is left alone: whoever founded it got here
    -- first, and the little joins by derivation exactly as at `lins_of` above.
    -- A lin the little had founded stays founded by them inside it, which the
    -- design already allows.
    if exists (select 1 from public.lins where founder_id = root) then
      continue;
    end if;

    if not grown then
      update public.lins set founder_id = root where founder_id = new.little_id;
      grown := found;
      if grown then
        continue;
      end if;
    end if;
    perform public.found_lin(root);
  end loop;
  return new;
end $$;

create trigger links_found_lin
  after insert or update of status on public.links
  for each row execute function public.ensure_lin_for_link();

-- ---------- founders edit their own lin ----------
create policy lins_update_founder on public.lins
  for update to authenticated
  using (founder_id = public.current_person_id())
  with check (founder_id = public.current_person_id());

-- Name and colour only. Bypassed with no app JWT (postgres, service_role), for
-- admins, and for a change made by another trigger: ensure_lin_for_link hands
-- a lin up its chain from inside the links trigger, where auth.role() is still
-- the confirming member's.
create or replace function public.guard_lins_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated'
     or public.is_admin()
     or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.founder_id is distinct from old.founder_id
  or new.id         is distinct from old.id
  or new.created_at is distinct from old.created_at then
    raise exception 'only an admin can change who founded a lin' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger lins_guard_update
  before update on public.lins
  for each row execute function public.guard_lins_update();

-- Internal helpers: the trigger runs them as the function owner.
revoke execute on function public.lin_palette()          from public, anon, authenticated;
revoke execute on function public.next_lin_color()       from public, anon, authenticated;
revoke execute on function public.found_lin(uuid)        from public, anon, authenticated;
revoke execute on function public.ensure_lin_for_link()  from public, anon, authenticated;
revoke execute on function public.guard_lins_update()    from public, anon, authenticated;
