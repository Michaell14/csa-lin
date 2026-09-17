-- A requester may withdraw their own pending removal request before review.
create policy link_removal_delete_own_pending on public.link_removal_requests
  for delete to authenticated
  using (status = 'pending' and requested_by = public.current_person_id());

grant delete on public.link_removal_requests to authenticated;
