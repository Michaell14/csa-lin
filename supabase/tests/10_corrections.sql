begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;

create or replace function tests.login(pid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', gen_random_uuid(), 'person_id', pid)::text,
    true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Correction access keys on auth.uid() rather than on the person_id claim, so
-- unlike the other suites these tests need one stable auth user per reporter
-- instead of a fresh one on every login.
create or replace function tests.login(pid uuid, uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', uid, 'person_id', pid)::text,
    true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- FIXTURE: paste verbatim where a task says "insert the fixture graph"
truncate public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, penn_email, hidden) values
  ('00000000-0000-0000-0000-000000000001', 'Founder A',  2020, 'foundera@upenn.edu',     false),
  ('00000000-0000-0000-0000-000000000002', 'Big One',    2021, 'big1@upenn.edu',         false),
  ('00000000-0000-0000-0000-000000000003', 'Big Two',    2021, 'big2@upenn.edu',         false),
  ('00000000-0000-0000-0000-000000000004', 'Child One',  2022, 'child1@seas.upenn.edu',  false),
  ('00000000-0000-0000-0000-000000000005', 'Child Two',  2022, 'child2@upenn.edu',       false),
  ('00000000-0000-0000-0000-000000000006', 'Shared Kid', 2023, 'shared@upenn.edu',       false),
  ('00000000-0000-0000-0000-000000000007', 'Hidden One', 2023, 'hidden@upenn.edu',       true),
  ('00000000-0000-0000-0000-000000000011', 'Founder B',  2020, 'founderb@upenn.edu',     false),
  ('00000000-0000-0000-0000-000000000012', 'Big Three',  2021, 'big3@upenn.edu',         false);
insert into public.lins (id, name, color, founder_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Lin A', '#6366f1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000b1', 'Lin B', '#14b8a6', '00000000-0000-0000-0000-000000000011');
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'confirmed'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'confirmed'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'confirmed'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'confirmed'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', 'confirmed'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000006', 'confirmed'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', 'confirmed'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 'confirmed');
insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000001');

select plan(15);

-- NOTE: as in 04_rls.sql, a policy that filters an UPDATE makes it touch zero
-- rows rather than raise, so "changed nothing" is asserted by running the
-- statement and then checking state.

-- ===== a reporter owns what they file =====
select tests.login('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01');

select lives_ok(
  $$ insert into public.correction_requests (id, person_id, kind, details)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000004',
             'profile', 'Child One graduated in 2023, not 2022.') $$,
  'reporter can file a correction against a visible profile');

select throws_ok(
  $$ insert into public.correction_requests (reporter_user_id, person_id, kind, details)
     values ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-000000000004',
             'profile', 'Filed under somebody else''s account.') $$,
  '42501', null, 'reporter cannot file a correction as another account');

select throws_ok(
  $$ insert into public.correction_requests (person_id, kind, details, status)
     values ('00000000-0000-0000-0000-000000000004', 'profile',
             'Pre-resolved on the way in.', 'resolved') $$,
  '42501', null, 'reporter cannot file a correction that is already decided');

select throws_ok(
  $$ insert into public.correction_requests (kind, details)
     values ('profile', 'A profile report naming no profile.') $$,
  '23514', null, 'a profile report must name the person it concerns');

select throws_ok(
  $$ insert into public.correction_requests (kind, details) values ('missing_person', 'too short') $$,
  '23514', null, 'a report must carry usable detail');

select is((select count(*) from public.correction_requests), 1::bigint,
  'reporter sees their own report');

-- ===== one member's report is not visible to another =====
select tests.login('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02');

select lives_ok(
  $$ insert into public.correction_requests (id, person_id, kind, details)
     values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000005',
             'relationship', 'Child Two is a little of Big One, not Big Two.') $$,
  'a second member can file their own correction');

select is((select count(*) from public.correction_requests), 1::bigint,
  'a member sees only their own report, not another member''s');

select lives_ok(
  $$ update public.correction_requests set status = 'dismissed'
       where id = '00000000-0000-0000-0000-0000000000c2' $$,
  'a non-admin resolution runs without error');

select is(
  (select status from public.correction_requests where id = '00000000-0000-0000-0000-0000000000c2'),
  'pending'::public.correction_status, 'a non-admin cannot resolve a report');

-- ===== the admin queue =====
select tests.login('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa03');

select is((select count(*) from public.correction_requests), 2::bigint,
  'admin sees every reporter''s report in the queue');

select lives_ok(
  $$ update public.correction_requests
       set status = 'resolved', resolved_by = '00000000-0000-0000-0000-000000000001', resolved_at = now()
       where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'admin can resolve a pending report');

select is(
  (select status from public.correction_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  'resolved'::public.correction_status, 'the admin decision is recorded');

-- A second admin working from a stale queue must not overwrite the decision
-- the first one already recorded.
select lives_ok(
  $$ update public.correction_requests
       set status = 'dismissed', resolved_by = '00000000-0000-0000-0000-000000000001', resolved_at = now()
       where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'a stale admin decision runs without error');

select is(
  (select status from public.correction_requests where id = '00000000-0000-0000-0000-0000000000c1'),
  'resolved'::public.correction_status, 'a stale admin decision cannot overwrite the first');

select tests.logout();

select * from finish();
rollback;
