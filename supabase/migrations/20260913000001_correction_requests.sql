create type public.correction_kind as enum ('profile', 'relationship', 'missing_person');
create type public.correction_status as enum ('pending', 'resolved', 'dismissed');

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null default auth.uid(),
  person_id uuid references public.people(id),
  kind public.correction_kind not null,
  details text not null check (length(trim(details)) between 10 and 2000),
  status public.correction_status not null default 'pending',
  resolved_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint correction_target check (kind = 'missing_person' or person_id is not null)
);

alter table public.correction_requests enable row level security;
create policy correction_insert on public.correction_requests for insert to authenticated
  with check (reporter_user_id = auth.uid() and status = 'pending' and resolved_by is null and resolved_at is null);
create policy correction_select_own_or_admin on public.correction_requests for select to authenticated
  using (reporter_user_id = auth.uid() or public.is_admin());
-- Only a pending report is exposed for update, so an admin acting from a stale
-- queue cannot overwrite a decision another admin has already recorded.
create policy correction_update_admin on public.correction_requests for update to authenticated
  using (public.is_admin() and status = 'pending') with check (public.is_admin());

