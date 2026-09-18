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

truncate public.notifications, public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id, personal_auth_user_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020, 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('00000000-0000-0000-0000-000000000002', 'Member', 2021, 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', 'Other', 2022, 'aaaaaaaa-0000-0000-0000-000000000003', null);
insert into public.admins(person_id) values ('00000000-0000-0000-0000-000000000001');

select plan(11);
select lives_ok($$ update public.people set major = repeat('x',100), hometown = repeat('x',100), bio = repeat('x',1000) where id = '00000000-0000-0000-0000-000000000002' $$, 'retained profile boundaries are accepted');
select throws_ok($$ update public.people set major = repeat('x',101) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'major limit enforced');
select throws_ok($$ update public.people set hometown = repeat('x',101) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'hometown limit enforced');
select throws_ok($$ update public.people set bio = repeat('x',1001) where id = '00000000-0000-0000-0000-000000000002' $$, '23514', null, 'bio limit enforced');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'people'
  and column_name in ('preferred_name', 'pronouns', 'school', 'csa_role', 'current_city', 'interests')),
  0::bigint, 'removed profile columns are absent from people');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('people_public', 'people_with_contact')
  and column_name in ('preferred_name', 'pronouns', 'school', 'csa_role', 'current_city', 'interests')),
  0::bigint, 'removed profile columns are absent from both views');
select ok(has_column_privilege('authenticated', 'public.people', 'display_name', 'select'), 'authenticated viewers can read the public name');
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok($$ update public.people set major = 'Math' where id = '00000000-0000-0000-0000-000000000002' $$, 'member updates own retained profile');
select is((select count(*) from public.people_with_contact), 1::bigint, 'contact view remains restricted to own row');
select tests.logout();
insert into public.links(big_id, little_id, status, proposed_by) values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'pending', '00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.notifications where kind = 'link_request'), 2::bigint, 'both linked authentication identities receive the request');
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
delete from public.links where status = 'pending';
select tests.logout();
select is((select min(message) from public.notifications where kind = 'link_declined'), 'Your family-link request was rejected by an administrator.', 'admin rejection is labelled accurately');
select * from finish();
rollback;
