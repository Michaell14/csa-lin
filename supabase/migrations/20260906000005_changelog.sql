-- Append-only audit log populated by triggers.

create type public.changelog_action as enum ('insert', 'update', 'delete');

create table public.changelog (
  id          bigserial primary key,
  actor_id    uuid references public.people(id),
  table_name  text not null,
  row_id      uuid not null,
  action      public.changelog_action not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index changelog_created_idx on public.changelog (created_at desc);

alter table public.changelog enable row level security;
create policy changelog_select_admin on public.changelog
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: only the security-definer trigger writes.

create or replace function public.log_change() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  rid uuid := coalesce(
    (new_j ->> 'id')::uuid, (old_j ->> 'id')::uuid,
    (new_j ->> 'person_id')::uuid, (old_j ->> 'person_id')::uuid);
begin
  insert into public.changelog (actor_id, table_name, row_id, action, before, after)
  values (public.current_person_id(), tg_table_name, rid,
          lower(tg_op)::public.changelog_action, old_j, new_j);
  return coalesce(new, old);
end $$;

create trigger people_log after insert or update or delete on public.people
  for each row execute function public.log_change();
create trigger lins_log after insert or update or delete on public.lins
  for each row execute function public.log_change();
create trigger links_log after insert or update or delete on public.links
  for each row execute function public.log_change();
create trigger admins_log after insert or update or delete on public.admins
  for each row execute function public.log_change();
