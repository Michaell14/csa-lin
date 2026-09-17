-- A suggestion about a profile or relationship must come from someone in at
-- least one of the same lins as the target person. lins_of derives membership
-- from confirmed links and includes a lin's founder.
drop policy correction_insert on public.correction_requests;
create policy correction_insert on public.correction_requests for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and status = 'pending'
    and resolved_by is null
    and resolved_at is null
    and kind in ('profile', 'relationship')
    and person_id is not null
    and exists (
      select 1
      from public.lins_of(public.current_person_id()) as mine(lin_id)
      join public.lins_of(person_id) as theirs(lin_id) using (lin_id)
    )
  );
