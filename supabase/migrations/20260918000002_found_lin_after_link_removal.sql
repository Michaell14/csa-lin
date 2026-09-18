-- A confirmed link can be the little's only path into any lin. After its
-- removal, make that little the founder of the now-disconnected branch.
-- A second big in another lin still provides membership, so no lin is made.
create function public.found_lin_after_link_removal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  little uuid;
begin
  perform pg_advisory_xact_lock(20260915000001);

  -- A statement trigger sees the complete result of a bulk deletion instead
  -- of founding a lin between individual rows of the same DELETE.
  for little in
    select distinct little_id from deleted_links where status = 'confirmed'
  loop
    if not exists (select 1 from public.lins_of(little)) then
      perform public.found_lin(little);
    end if;
  end loop;
  return null;
end $$;

create trigger links_found_after_removal
  after delete on public.links
  referencing old table as deleted_links
  for each statement execute function public.found_lin_after_link_removal();

revoke execute on function public.found_lin_after_link_removal() from public, anon, authenticated;
