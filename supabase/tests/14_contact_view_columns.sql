begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.login(pid uuid, uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', uid, 'person_id', pid)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

truncate public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id, show_location) values
  ('00000000-0000-0000-0000-000000000002', 'Member', 2021, 'aaaaaaaa-0000-0000-0000-000000000002', false);

select plan(2);

-- people_with_contact is "select p.*", and a view expands "*" once, at creation.
-- A migration that adds a column to people must recreate the view too, or the
-- column is missing here and the app reads undefined through it.
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'people'
     except
     select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'people_with_contact' $$,
  'people_with_contact exposes every column of people');

-- The privacy toggles are the columns that regressed: a member must read their
-- own value through the view, not undefined.
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select is(
  (select show_location from public.people_with_contact where id = '00000000-0000-0000-0000-000000000002'),
  false, 'member reads own show_location through people_with_contact');
select tests.logout();

select * from finish();
rollback;
