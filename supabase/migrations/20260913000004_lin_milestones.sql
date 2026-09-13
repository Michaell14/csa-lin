create table public.lin_milestones (
  id uuid primary key default gen_random_uuid(),
  lin_id uuid not null references public.lins(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  event_date date not null,
  description text check (description is null or length(description) <= 2000),
  photo_path text,
  created_by uuid references public.people(id),
  created_at timestamptz not null default now()
);
create index lin_milestones_lin_date_idx on public.lin_milestones(lin_id, event_date desc);
alter table public.lin_milestones enable row level security;
create policy milestones_select on public.lin_milestones for select to authenticated using (true);
create policy milestones_insert_admin on public.lin_milestones for insert to authenticated with check (public.is_admin());
create policy milestones_update_admin on public.lin_milestones for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy milestones_delete_admin on public.lin_milestones for delete to authenticated using (public.is_admin());
