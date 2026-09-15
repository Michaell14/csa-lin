begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

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

truncate public.notifications, public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id, personal_auth_user_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020, 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('00000000-0000-0000-0000-000000000002', 'Member', 2021, 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', 'Other', 2022, 'aaaaaaaa-0000-0000-0000-000000000003', null);
insert into public.admins(person_id) values ('00000000-0000-0000-0000-000000000001');

select plan(12);
select lives_ok($$ update public.people set preferred_name = repeat('x',80), pronouns = repeat('x',50), school = repeat('x',100), current_city = repeat('x',100), interests = repeat('x',300), csa_role = repeat('x',100) where id = '00000000-0000-0000-0000-000000000002' $$, 'rich profile boundaries are accepted');
select throws_ok($$ update public.people set preferred_name = repeat('x',81) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'preferred name limit enforced');
select throws_ok($$ update public.people set pronouns = repeat('x',51) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'pronouns limit enforced');
select throws_ok($$ update public.people set school = repeat('x',101) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'school limit enforced');
select throws_ok($$ update public.people set current_city = repeat('x',101) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'city limit enforced');
select throws_ok($$ update public.people set interests = repeat('x',301) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'interests limit enforced');
select throws_ok($$ update public.people set csa_role = repeat('x',101) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'CSA role limit enforced');
select ok(has_column_privilege('authenticated', 'public.people', 'preferred_name', 'select'), 'authenticated viewers can read rich public columns');
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok($$ update public.people set preferred_name = 'M' where id = '00000000-0000-0000-0000-000000000002' $$, 'member updates own rich profile');
select is((select count(*) from public.people_with_contact), 1::bigint, 'contact view remains restricted to own row');
select tests.logout();
insert into public.links(big_id, little_id, status, proposed_by) values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'pending', '00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.notifications where kind = 'link_request'), 2::bigint, 'both linked authentication identities receive the request');
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
delete from public.links where status = 'pending';
select is((select min(message) from public.notifications where kind = 'link_declined'), 'Your family-link request was rejected by an administrator.', 'admin rejection is labelled accurately');
select * from finish();
rollback;
