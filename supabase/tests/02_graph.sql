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

select plan(9);

select is(
  (select count(*) from public.ancestors_of('00000000-0000-0000-0000-000000000006')), 5::bigint,
  'Shared Kid has 5 ancestors across both lins');

select set_eq(
  $$ select * from public.ancestors_of('00000000-0000-0000-0000-000000000006') $$,
  $$ values ('00000000-0000-0000-0000-000000000004'::uuid), ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000012'),
            ('00000000-0000-0000-0000-000000000011') $$,
  'ancestors of Shared Kid are exactly 04, 02, 01, 12, 11');

select is(
  (select count(*) from public.descendants_of('00000000-0000-0000-0000-000000000001')), 6::bigint,
  'Founder A has 6 descendants (including the hidden one)');

select set_eq(
  $$ select person_id from public.lin_members('00000000-0000-0000-0000-0000000000a1') $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'),
            ('00000000-0000-0000-0000-000000000005'), ('00000000-0000-0000-0000-000000000006'),
            ('00000000-0000-0000-0000-000000000007') $$,
  'Lin A members include the hidden person for graph continuity');

select is(
  (select is_founder from public.lin_members('00000000-0000-0000-0000-0000000000a1')
    where person_id = '00000000-0000-0000-0000-000000000001'), true,
  'founder row is flagged');

select set_eq(
  $$ select person_id from public.lin_members('00000000-0000-0000-0000-0000000000b1') $$,
  $$ values ('00000000-0000-0000-0000-000000000011'::uuid), ('00000000-0000-0000-0000-000000000012'),
            ('00000000-0000-0000-0000-000000000006') $$,
  'Lin B contains the shared descendant');

select set_eq(
  $$ select * from public.lins_of('00000000-0000-0000-0000-000000000006') $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1') $$,
  'Shared Kid belongs to both lins');

-- hidden founder still comes back
update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000011';
select is(
  (select count(*) from public.lin_members('00000000-0000-0000-0000-0000000000b1')
    where person_id = '00000000-0000-0000-0000-000000000011'), 1::bigint,
  'hidden founder is still returned by lin_members');

select throws_ok(
  $$ insert into public.links (big_id, little_id, status)
     values ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'confirmed') $$,
  '23514', 'link would create a cycle', 'descendant cannot become big of an ancestor');

select * from finish();
rollback;
