-- Row-level security and protected-column guards.

alter table public.people enable row level security;
alter table public.lins   enable row level security;
alter table public.links  enable row level security;
alter table public.admins enable row level security;

-- ---------- people ----------
create policy people_select on public.people
  for select to authenticated
  using (public.is_admin() or (hidden = false and merged_into is null));

create policy people_insert_admin on public.people
  for insert to authenticated
  with check (public.is_admin());

create policy people_update_admin on public.people
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy people_update_self on public.people
  for update to authenticated
  using (id = public.current_person_id()) with check (id = public.current_person_id());

-- Members may not touch protected columns. penn_email is locked for everyone once claimed.
-- Bypassed when there is no app JWT (postgres, service_role, auth hook).
create or replace function public.guard_people_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if old.claimed_at is not null and new.penn_email is distinct from old.penn_email then
    raise exception 'penn_email is locked after claim' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.penn_email   is distinct from old.penn_email
  or new.hidden       is distinct from old.hidden
  or new.merged_into  is distinct from old.merged_into
  or new.auth_user_id is distinct from old.auth_user_id
  or new.claimed_at   is distinct from old.claimed_at
  or new.created_at   is distinct from old.created_at then
    raise exception 'not allowed to change protected fields' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger people_guard_update
  before update on public.people
  for each row execute function public.guard_people_update();

-- ---------- lins ----------
create policy lins_select on public.lins
  for select to authenticated using (true);
create policy lins_insert_admin on public.lins
  for insert to authenticated with check (public.is_admin());
create policy lins_update_admin on public.lins
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lins_delete_admin on public.lins
  for delete to authenticated using (public.is_admin());

-- ---------- links ----------
create policy links_select on public.links
  for select to authenticated
  using (
    status = 'confirmed'
    or public.is_admin()
    or public.current_person_id() in (big_id, little_id, proposed_by)
  );

create policy links_insert_admin on public.links
  for insert to authenticated
  with check (public.is_admin());

create policy links_insert_member on public.links
  for insert to authenticated
  with check (
    status = 'pending'
    and proposed_by = public.current_person_id()
    and public.current_person_id() in (big_id, little_id)
    and confirmed_by is null
    and confirmed_at is null
  );

create policy links_update_admin on public.links
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The non-proposing party confirms.
create policy links_update_confirm on public.links
  for update to authenticated
  using (
    status = 'pending'
    and public.current_person_id() in (big_id, little_id)
    and proposed_by is distinct from public.current_person_id()
  )
  with check (
    status = 'confirmed'
    and confirmed_by = public.current_person_id()
  );

create policy links_delete on public.links
  for delete to authenticated
  using (public.is_admin() or public.current_person_id() in (big_id, little_id));

-- Non-admins may only flip status/confirmed_by/confirmed_at; never rewrite the parties.
create or replace function public.guard_links_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;
  if new.big_id        is distinct from old.big_id
  or new.little_id     is distinct from old.little_id
  or new.proposed_by   is distinct from old.proposed_by
  or new.academic_year is distinct from old.academic_year
  or new.created_at    is distinct from old.created_at then
    raise exception 'not allowed to change link parties' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger links_guard_update
  before update on public.links
  for each row execute function public.guard_links_update();

-- ---------- admins ----------
create policy admins_select on public.admins
  for select to authenticated using (true);
create policy admins_insert_admin on public.admins
  for insert to authenticated with check (public.is_admin());
create policy admins_delete_admin on public.admins
  for delete to authenticated using (public.is_admin());
