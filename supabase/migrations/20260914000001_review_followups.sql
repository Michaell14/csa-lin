-- Review follow-ups for richer profiles and activity notifications.
create or replace function public.notify_link_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recipient_person uuid;
  subject_person uuid;
  actor_name text;
  notification_kind public.notification_kind;
  notification_message text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    recipient_person := case when new.proposed_by = new.big_id then new.little_id else new.big_id end;
    subject_person := new.proposed_by;
    select display_name into actor_name from public.people where id = new.proposed_by;
    notification_kind := 'link_request';
    notification_message := actor_name || ' sent you a family-link request.';
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'confirmed' then
    recipient_person := new.proposed_by;
    subject_person := new.confirmed_by;
    notification_kind := 'link_accepted';
    notification_message := 'Your family-link request was accepted.';
  elsif tg_op = 'DELETE' and old.status = 'pending'
      and old.proposed_by is distinct from public.current_person_id() then
    recipient_person := old.proposed_by;
    notification_kind := 'link_declined';
    notification_message := case when public.is_admin()
      then 'Your family-link request was rejected by an administrator.'
      else 'Your family-link request was declined.' end;
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.notifications(recipient_user_id, kind, message, person_id)
  select recipient, notification_kind, notification_message, subject_person
  from (
    select auth_user_id as recipient from public.people where id = recipient_person
    union
    select personal_auth_user_id from public.people where id = recipient_person
  ) identities
  where recipient is not null;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
