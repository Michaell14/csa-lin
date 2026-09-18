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

truncate public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, penn_email, auth_user_id, claimed_at) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020, 'admin@upenn.edu', null, null),
  ('00000000-0000-0000-0000-000000000002', 'Member', 2022, 'member@upenn.edu',
   'dddddddd-0000-0000-0000-000000000002', now());
insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000001');

select plan(7);
select is(to_regprocedure('public.merge_people(uuid, uuid)'), null::regprocedure,
  'the old two-argument merge RPC is absent');
select is(to_regprocedure('public.merge_people(uuid, uuid, text)'), null::regprocedure,
  'the three-argument merge RPC is absent');
select is((select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'people' and column_name = 'merged_into'),
  0::bigint, 'the unused merge column is absent');

select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.people set penn_email = 'changed@upenn.edu'
     where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', 'penn_email is locked after claim', 'claimed Penn emails stay locked');

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
