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

select plan(43);

-- NOTE: Postgres does not allow UPDATE/DELETE ... RETURNING inside a subquery, so
-- "touched zero rows" is asserted by running the statement and then checking state.

-- ===== viewer (Penn account, no profile) =====
select tests.login(null);
select is((select count(*) from public.people), 8::bigint, 'viewer sees the 8 non-hidden people');
select is((select count(*) from public.people where id = '00000000-0000-0000-0000-000000000007'), 0::bigint, 'viewer cannot see hidden person');
select throws_ok(
  $$ select penn_email from public.people $$,
  '42501', null, 'viewer cannot read penn_email from people');
select is((select count(*) from public.people_with_contact), 0::bigint, 'viewer sees no rows in people_with_contact');
select is((select count(*) from public.lins), 2::bigint, 'viewer sees lins');
select is((select count(*) from public.links), 8::bigint, 'viewer sees all confirmed links');
select throws_ok(
  $$ insert into public.people (display_name, grad_year) values ('Nope', 2030) $$,
  '42501', null, 'viewer cannot insert people');
update public.people set bio = 'x' where id = '00000000-0000-0000-0000-000000000002';
select is((select bio from public.people_public where id = '00000000-0000-0000-0000-000000000002'), null,
  'viewer update touches no rows');
select tests.logout();

-- ===== member Big One (02) =====
-- Big One signs in on a personal address as well as the Penn one.
update public.people
  set personal_email = 'big1@gmail.com', personal_auth_user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
  where id = '00000000-0000-0000-0000-000000000002';
select tests.login('00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ update public.people set bio = 'hello', major = 'CIS' where id = '00000000-0000-0000-0000-000000000002' $$,
  'member edits own bio and major');
select is((select bio from public.people_public where id = '00000000-0000-0000-0000-000000000002'), 'hello', 'own edit persisted');
select throws_ok(
  $$ select penn_email from public.people where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot read penn_email even on own row of people');
select throws_ok(
  $$ select personal_email, auth_user_id from public.people $$,
  '42501', null, 'member cannot read personal_email or auth_user_id from people');
select is((select count(*) from public.people_with_contact), 1::bigint, 'people_with_contact shows a member only their own row');
select is((select penn_email from public.people_with_contact where id = '00000000-0000-0000-0000-000000000002'),
  'big1@upenn.edu', 'member reads own penn_email through people_with_contact');
update public.people set bio = 'x' where id = '00000000-0000-0000-0000-000000000003';
select is((select bio from public.people_public where id = '00000000-0000-0000-0000-000000000003'), null,
  'member cannot edit someone else');
select throws_ok(
  $$ update public.people set penn_email = 'other@upenn.edu' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot change own penn_email');
select throws_ok(
  $$ update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot hide self');
select throws_ok(
  $$ update public.people set created_at = '1900-01-01' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot change own created_at');
select throws_ok(
  $$ update public.people set personal_auth_user_id = gen_random_uuid() where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot set own personal binding');
-- personal_email is theirs to edit, and the binding the trigger drops along with
-- it must not come back as a protected-column rejection.
select lives_ok(
  $$ update public.people set personal_email = 'big1.new@gmail.com' where id = '00000000-0000-0000-0000-000000000002' $$,
  'member changes own personal_email while bound to a personal sign-in');
select tests.logout();
select is((select personal_auth_user_id from public.people where id = '00000000-0000-0000-0000-000000000002'),
  null, 'and that change dropped the binding the old address left behind');
select tests.login('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.lins (name, color, founder_id) values ('Lin C', '#000000', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot create lins');
select throws_ok(
  $$ insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot self-promote');

-- member proposes a link where they are the big
select lives_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'pending', '00000000-0000-0000-0000-000000000002') $$,
  'member proposes pending link as big');
select throws_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'confirmed', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot insert a confirmed link');
select throws_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'pending', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot propose a link between two other people');
-- proposer cannot accept their own proposal
update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000002'
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005';
select is((select status::text from public.links
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005'), 'pending',
  'proposer cannot confirm own proposal');
select tests.logout();

-- ===== member Big Two (03), not a party to the pending link =====
select tests.login('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.links where status = 'pending'), 0::bigint, 'unrelated member cannot see pending link');
select tests.logout();

-- ===== member Child Two (05), the other party =====
select tests.login('00000000-0000-0000-0000-000000000005');
select is((select count(*) from public.links where status = 'pending'), 1::bigint, 'other party sees the pending link');
select throws_ok(
  $$ update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000005',
       little_id = '00000000-0000-0000-0000-000000000006'
     where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005' $$,
  '42501', null, 'other party cannot rewrite who the link is between');
select lives_ok(
  $$ update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000005', confirmed_at = now()
     where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005' $$,
  'other party confirms the link');
select is((select status::text from public.links
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005'), 'confirmed',
  'link is now confirmed');
-- confirmed links now require an admin-reviewed removal request
delete from public.links
  where big_id = '00000000-0000-0000-0000-000000000003' and little_id = '00000000-0000-0000-0000-000000000005';
select is((select count(*) from public.links
  where big_id = '00000000-0000-0000-0000-000000000003' and little_id = '00000000-0000-0000-0000-000000000005'), 1::bigint,
  'member cannot directly remove a confirmed link they are part of');
delete from public.links
  where big_id = '00000000-0000-0000-0000-000000000001' and little_id = '00000000-0000-0000-0000-000000000002';
select is((select count(*) from public.links
  where big_id = '00000000-0000-0000-0000-000000000001' and little_id = '00000000-0000-0000-0000-000000000002'), 1::bigint,
  'member cannot remove a link they are not part of');
select tests.logout();

-- ===== admin Founder A (01) =====
select tests.login('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.people), 9::bigint, 'admin sees hidden people too');
select throws_ok(
  $$ select penn_email from public.people $$,
  '42501', null, 'admin also reads contact columns only through the view');
select is((select count(*) from public.people_with_contact where penn_email is not null), 9::bigint,
  'admin reads every penn_email through people_with_contact');
select lives_ok(
  $$ insert into public.people (display_name, grad_year, penn_email) values ('New Kid', 2026, 'newkid@upenn.edu') $$,
  'admin creates a person');
select lives_ok(
  $$ update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000005' $$,
  'admin hides a person');
select lives_ok(
  $$ insert into public.links (big_id, little_id, status) values
     ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'confirmed') $$,
  'admin inserts a confirmed link directly');
select lives_ok(
  $$ insert into public.admins (person_id, granted_by) values
     ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001') $$,
  'admin promotes another admin');
select tests.logout();

-- ===== penn_email lock after claim (applies to admins too) =====
update public.people set claimed_at = now(), auth_user_id = gen_random_uuid()
  where id = '00000000-0000-0000-0000-000000000003';
select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.people set penn_email = 'fixed@upenn.edu' where id = '00000000-0000-0000-0000-000000000003' $$,
  '42501', 'penn_email is locked after claim', 'admin cannot change penn_email once claimed');
select lives_ok(
  $$ update public.people set penn_email = 'fixed@upenn.edu' where id = '00000000-0000-0000-0000-000000000004' $$,
  'admin can fix penn_email on an unclaimed profile');
select tests.logout();

select * from finish();
rollback;
