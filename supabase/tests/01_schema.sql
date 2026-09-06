begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.login(pid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', gen_random_uuid(), 'person_id', pid)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select plan(14);

select has_table('public', 'people', 'people table exists');
select has_table('public', 'lins', 'lins table exists');
select has_table('public', 'links', 'links table exists');
select has_table('public', 'admins', 'admins table exists');
select has_enum('public', 'link_status', 'link_status enum exists');

select col_is_unique('public', 'people', 'penn_email', 'penn_email is unique');
select col_is_unique('public', 'people', 'personal_email', 'personal_email is unique');
select col_is_unique('public', 'lins', 'name', 'lin name is unique');

-- emails must be stored lowercase
select throws_ok(
  $$ insert into public.people (display_name, grad_year, penn_email) values ('X', 2025, 'Mixed@Upenn.edu') $$,
  '23514', null, 'uppercase penn_email is rejected');

-- self-link rejected
insert into public.people (id, display_name, grad_year) values ('00000000-0000-0000-0000-000000000001', 'A', 2020);
insert into public.people (id, display_name, grad_year) values ('00000000-0000-0000-0000-000000000002', 'B', 2021);
select throws_ok(
  $$ insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'self link is rejected');

-- duplicate pair rejected
insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') $$,
  '23505', null, 'duplicate link pair is rejected');

-- link defaults to pending
select is((select status::text from public.links limit 1), 'pending', 'new link defaults to pending');

-- lin color must be a hex color
select throws_ok(
  $$ insert into public.lins (name, color, founder_id) values ('L', 'blue', '00000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'non-hex lin color is rejected');

-- updated_at bumps on update
update public.people set display_name = 'A2' where id = '00000000-0000-0000-0000-000000000001';
select ok((select updated_at > created_at from public.people where id = '00000000-0000-0000-0000-000000000001'),
  'updated_at moves forward on update');

select * from finish();
rollback;
