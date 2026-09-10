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

select plan(17);

-- a duplicate of Child One (04): a second big (03) and the same little (06)
insert into public.people (id, display_name, grad_year, penn_email) values
  ('00000000-0000-0000-0000-000000000008', 'Child 1 dup', 2022, 'child1dup@upenn.edu');
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008', 'confirmed'),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006', 'confirmed');
update public.people set penn_email = null where id = '00000000-0000-0000-0000-000000000004';

-- the duplicate has signed in: this is the case the old guard rejected
update public.people
  set auth_user_id = 'dddddddd-0000-0000-0000-000000000008', claimed_at = now()
  where id = '00000000-0000-0000-0000-000000000008';

-- member cannot merge
select tests.login('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008') $$,
  '42501', null, 'member cannot merge');
select tests.logout();

-- admin merges
select tests.login('00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008') $$,
  'admin merges duplicate into survivor');
select is((select count(*) from public.links where big_id = '00000000-0000-0000-0000-000000000008'
                                               or little_id = '00000000-0000-0000-0000-000000000008'), 0::bigint,
  'no links reference the duplicate');
select is((select count(*) from public.links where little_id = '00000000-0000-0000-0000-000000000004'), 2::bigint,
  'survivor now has both bigs (02 and 03)');
select is((select count(*) from public.links where big_id = '00000000-0000-0000-0000-000000000004'
                                               and little_id = '00000000-0000-0000-0000-000000000006'), 1::bigint,
  'duplicate 04->06 pair collapsed to one link');
select is((select merged_into from public.people where id = '00000000-0000-0000-0000-000000000008'),
  '00000000-0000-0000-0000-000000000004'::uuid, 'duplicate points at survivor');
select is((select hidden from public.people where id = '00000000-0000-0000-0000-000000000008'), true, 'duplicate is hidden');
select is((select penn_email from public.people_with_contact where id = '00000000-0000-0000-0000-000000000004'),
  'child1dup@upenn.edu', 'survivor inherited the penn_email');
select is((select auth_user_id from public.people_with_contact where id = '00000000-0000-0000-0000-000000000004'),
  'dddddddd-0000-0000-0000-000000000008'::uuid, 'survivor inherited the auth user');
select isnt((select claimed_at from public.people where id = '00000000-0000-0000-0000-000000000004'),
  null, 'survivor is now claimed');
select is((select auth_user_id from public.people_with_contact where id = '00000000-0000-0000-0000-000000000008'),
  null, 'duplicate no longer holds the auth user');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004') $$,
  '22023', null, 'cannot merge a person into themselves');

-- both-claimed merge is refused rather than silently orphaning a sign-in
select tests.logout();
insert into public.people (id, display_name, grad_year, penn_email, auth_user_id, claimed_at) values
  ('00000000-0000-0000-0000-000000000009', 'Claimed dup', 2022, 'claimeddup@upenn.edu',
   'dddddddd-0000-0000-0000-000000000009', now());
select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000009') $$,
  '22023', 'both people are claimed; clear one sign-in identity first', 'both-claimed merge is refused');

-- the merge exemption cannot be used to rewrite a claimed penn_email
select throws_ok(
  $$ update public.people set merged_into = '00000000-0000-0000-0000-000000000002', penn_email = 'attacker@upenn.edu'
     where id = '00000000-0000-0000-0000-000000000004' $$,
  '42501', 'penn_email is locked after claim', 'admin cannot smuggle a penn_email change through merged_into');

-- last admin guard
select throws_ok(
  $$ delete from public.admins where person_id = '00000000-0000-0000-0000-000000000001' $$,
  '23514', 'cannot remove the last admin', 'sole admin cannot be removed');
insert into public.admins (person_id, granted_by) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ delete from public.admins where person_id = '00000000-0000-0000-0000-000000000001' $$,
  'admin can be removed once another exists');
select is((select count(*) from public.admins), 1::bigint, 'one admin remains');
select tests.logout();

select * from finish();
rollback;
