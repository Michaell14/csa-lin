begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;
grant usage on schema tests to anon;

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

select plan(11);

-- as a plain member
select tests.login('00000000-0000-0000-0000-000000000002');

select is(jsonb_array_length(public.lin_graph('00000000-0000-0000-0000-0000000000a1') -> 'people'), 6,
  'Lin A graph has 6 people (hidden one excluded)');
select is(jsonb_array_length(public.lin_graph('00000000-0000-0000-0000-0000000000a1') -> 'links'), 5,
  'Lin A graph has 5 edges (edge to hidden person and cross-lin edge excluded)');
select ok(not (public.lin_graph('00000000-0000-0000-0000-0000000000a1') -> 'people') @> '[{"id":"00000000-0000-0000-0000-000000000007"}]',
  'hidden person is not a node');
select ok((public.lin_graph('00000000-0000-0000-0000-0000000000a1') -> 'people') @> '[{"id":"00000000-0000-0000-0000-000000000001","is_founder":true,"placeholder":false}]',
  'founder node is flagged');
select is(jsonb_array_length(public.lin_graph('00000000-0000-0000-0000-0000000000b1') -> 'people'), 3,
  'Lin B graph has 3 people');
select is(jsonb_array_length(public.lin_graph('00000000-0000-0000-0000-0000000000b1') -> 'links'), 2,
  'Lin B graph has 2 edges');
select ok(not exists (
  select 1 from jsonb_array_elements(public.lin_graph('00000000-0000-0000-0000-0000000000a1') -> 'people') e
  where e ? 'penn_email' or e ? 'auth_user_id'),
  'graph nodes carry no email or auth columns');
select is(jsonb_array_length(public.lin_graph('ffffffff-0000-0000-0000-000000000000') -> 'people'), 0,
  'unknown lin returns an empty graph');
select tests.logout();

-- hidden founder becomes a placeholder
update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000011';
select tests.login('00000000-0000-0000-0000-000000000002');
select ok((public.lin_graph('00000000-0000-0000-0000-0000000000b1') -> 'people') @> '[{"id":"00000000-0000-0000-0000-000000000011","is_founder":true,"placeholder":true,"display_name":null}]',
  'hidden founder is a nameless placeholder node');
select is(jsonb_array_length(public.lin_graph('00000000-0000-0000-0000-0000000000b1') -> 'links'), 2,
  'edges from the placeholder founder are kept');
select tests.logout();

-- anon cannot call it
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('role', 'anon', true);
select throws_ok(
  $$ select public.lin_graph('00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'anon cannot execute lin_graph');
select tests.logout();

select * from finish();
rollback;
