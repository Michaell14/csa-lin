-- Members request removal of a confirmed relationship; an administrator decides.
create type public.link_removal_status as enum ('pending', 'approved', 'rejected');

create table public.link_removal_requests (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.links(id) on delete set null,
  big_id uuid not null references public.people(id),
  little_id uuid not null references public.people(id),
  requested_by uuid not null references public.people(id),
  requester_user_id uuid not null default auth.uid(),
  status public.link_removal_status not null default 'pending',
  reviewed_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint pending_removal_has_link check (status <> 'pending' or link_id is not null)
);
create unique index link_removal_one_pending_per_link
  on public.link_removal_requests(link_id) where status = 'pending';
create index link_removal_requests_created_idx on public.link_removal_requests(created_at)
  where status = 'pending';

-- Snapshot both parties from the actual confirmed link; callers cannot forge them.
create function public.prepare_link_removal_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare existing public.links%rowtype;
begin
  select * into existing from public.links where id = new.link_id and status = 'confirmed' for update;
  if not found then raise exception 'The confirmed link no longer exists'; end if;
  new.created_at := now();
  new.big_id := existing.big_id;
  new.little_id := existing.little_id;
  return new;
end $$;
create trigger link_removal_prepare before insert on public.link_removal_requests
  for each row execute function public.prepare_link_removal_request();

alter table public.link_removal_requests enable row level security;
create policy link_removal_select on public.link_removal_requests
  for select to authenticated using (public.is_admin() or requested_by = public.current_person_id());
create policy link_removal_insert on public.link_removal_requests
  for insert to authenticated with check (
    requested_by = public.current_person_id() and requester_user_id = auth.uid()
    and requested_by in (big_id, little_id) and status = 'pending'
    and reviewed_by is null and reviewed_at is null
  );
-- There are no client update/delete policies. Admin decisions use the RPC below.
grant select, insert on public.link_removal_requests to authenticated;

-- This also closes a pending request when an admin removes the link directly.
create function public.close_link_removal_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'confirmed' then
    update public.link_removal_requests
       set status = 'approved', reviewed_by = public.current_person_id(), reviewed_at = now()
     where link_id = old.id and status = 'pending';
  end if;
  return old;
end $$;
create trigger link_removal_on_delete before delete on public.links
  for each row execute function public.close_link_removal_on_delete();

create function public.notify_link_removal_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications(recipient_user_id, kind, message)
    select recipient,
      case when new.status = 'approved' then 'link_removal_approved'::public.notification_kind
           else 'link_removal_rejected'::public.notification_kind end,
      case when new.status = 'approved' then 'Your link removal request was approved.'
           else 'Your link removal request was rejected.' end
    from (
      select auth_user_id as recipient from public.people where id = new.requested_by
      union
      select personal_auth_user_id from public.people where id = new.requested_by
    ) identities where recipient is not null;
  end if;
  return new;
end $$;
create trigger link_removal_notify after update on public.link_removal_requests
  for each row execute function public.notify_link_removal_decision();

create function public.resolve_link_removal_request(request_id uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare pending public.link_removal_requests%rowtype;
begin
  if auth.role() <> 'authenticated' or not public.is_admin() then
    raise exception 'Only administrators can review link removal requests' using errcode = '42501';
  end if;
  select * into pending from public.link_removal_requests
    where id = request_id and status = 'pending' for update;
  if not found then raise exception 'This removal request is no longer pending'; end if;

  if approve then
    delete from public.links where id = pending.link_id and status = 'confirmed';
    if not found then raise exception 'The confirmed link no longer exists'; end if;
    -- link_removal_on_delete marks the request approved before the FK clears link_id.
  else
    update public.link_removal_requests
       set status = 'rejected', reviewed_by = public.current_person_id(), reviewed_at = now()
     where id = request_id;
  end if;
end $$;
revoke execute on function public.resolve_link_removal_request(uuid, boolean) from public, anon;
grant execute on function public.resolve_link_removal_request(uuid, boolean) to authenticated;

drop policy links_delete on public.links;
create policy links_delete on public.links for delete to authenticated
  using (public.is_admin() or (status = 'pending' and public.current_person_id() in (big_id, little_id)));

create trigger link_removal_log after insert or update or delete on public.link_removal_requests
  for each row execute function public.log_change();

revoke execute on function public.prepare_link_removal_request() from public, anon, authenticated;
revoke execute on function public.close_link_removal_on_delete() from public, anon, authenticated;
revoke execute on function public.notify_link_removal_decision() from public, anon, authenticated;
