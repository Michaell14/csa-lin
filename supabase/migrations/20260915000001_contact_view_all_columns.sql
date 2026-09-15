-- Recreate people_with_contact so it exposes every column of people again.
--
-- The view is "select p.*", and a view freezes its column list at creation: the
-- "*" is expanded once and never revisited. It was last recreated in
-- ..._richer_profiles.sql. ..._profile_privacy.sql then added four columns to
-- people (show_location, show_bio_interests, show_socials, show_professional)
-- without recreating the view, so the view -- the only way a member reads their
-- own row with contact columns -- lost them. The web profile editor reads its
-- privacy toggles from this view and got undefined for all four.
--
-- "create or replace view" appends the missing columns in place, so the grants
-- (grant select ... to authenticated) and the security_barrier carry over.
--
-- Any later migration that adds a column to people must recreate this view too.
create or replace view public.people_with_contact
with (security_barrier = true) as
  select p.*
  from public.people p
  where public.is_admin() or p.id = public.current_person_id();
