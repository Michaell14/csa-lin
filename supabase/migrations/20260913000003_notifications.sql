create type public.notification_kind as enum ('link_request', 'link_accepted', 'link_declined', 'correction_resolved');
create table public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_user_id uuid not null,
  kind public.notification_kind not null, message text not null,
  person_id uuid references public.people(id) on delete set null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create or replace function public.notify_link_change() returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid; actor_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(auth_user_id, personal_auth_user_id) into recipient from people where id = case when new.proposed_by = new.big_id then new.little_id else new.big_id end;
    select display_name into actor_name from people where id = new.proposed_by;
    if recipient is not null then insert into notifications(recipient_user_id, kind, message, person_id) values(recipient, 'link_request', actor_name || ' sent you a family-link request.', new.proposed_by); end if;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'confirmed' then
    select coalesce(auth_user_id, personal_auth_user_id) into recipient from people where id = new.proposed_by;
    if recipient is not null then insert into notifications(recipient_user_id, kind, message, person_id) values(recipient, 'link_accepted', 'Your family-link request was accepted.', new.confirmed_by); end if;
  elsif tg_op = 'DELETE' and old.status = 'pending' then
    select coalesce(auth_user_id, personal_auth_user_id) into recipient from people where id = old.proposed_by;
    if recipient is not null and old.proposed_by is distinct from current_person_id() then insert into notifications(recipient_user_id, kind, message) values(recipient, 'link_declined', 'Your family-link request was declined.'); end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger links_notify after insert or update or delete on public.links for each row execute function public.notify_link_change();

create or replace function public.notify_correction_resolution() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('resolved', 'dismissed') then
    insert into notifications(recipient_user_id, kind, message, person_id) values(new.reporter_user_id, 'correction_resolved', case when new.status = 'resolved' then 'CSA reviewed and resolved your correction.' else 'CSA reviewed your correction.' end, new.person_id);
  end if; return new;
end $$;
create trigger corrections_notify after update on public.correction_requests for each row execute function public.notify_correction_resolution();
