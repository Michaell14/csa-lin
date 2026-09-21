begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;

create or replace function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', uid, 'person_id', null)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

truncate public.people, public.lins, public.links, public.admins restart identity cascade;

select plan(11);

select is(public.canonical_penn_email('Student@SEAS.UPENN.EDU'),
  'student@engineering.upenn.edu', 'legacy SEAS email uses the Engineering canonical domain');
select is(public.canonical_penn_email('student@engineering.upenn.edu'),
  'student@engineering.upenn.edu', 'Engineering email is already canonical');
select is(public.canonical_penn_email('student@wharton.upenn.edu'),
  'student@wharton.upenn.edu', 'other Penn subdomains are unchanged');

insert into public.people (display_name, grad_year, penn_email)
values ('New Engineer', 2028, 'new@seas.upenn.edu');
select is((select penn_email from public.people where display_name = 'New Engineer'),
  'new@engineering.upenn.edu', 'new SEAS addresses are stored with the Engineering domain');

-- Reproduce a profile created before this migration without rewriting it.
alter table public.people disable trigger people_canonicalize_penn_email;
insert into public.people (id, display_name, grad_year, penn_email)
values ('00000000-0000-0000-0000-000000000001', 'Legacy Engineer', 2027, 'legacy@seas.upenn.edu');
alter table public.people enable trigger people_canonicalize_penn_email;

insert into auth.users (id, email, email_confirmed_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'legacy@engineering.upenn.edu', now());

select is(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'authentication_method', 'oauth',
    'claims', jsonb_build_object('email', 'legacy@engineering.upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id')::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Engineering login resolves a legacy SEAS profile');
select is((select auth_user_id from public.people where id = '00000000-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'the alias login binds the existing profile');
select is((select count(*) from public.people where display_name = 'Legacy Engineer'),
  1::bigint, 'alias login does not create a second person');

-- The same Google identity remains attached if Penn changes its primary email.
update auth.users set email = 'legacy@seas.upenn.edu'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'authentication_method', 'oauth',
    'claims', jsonb_build_object('email', 'legacy@seas.upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id')::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'the same identity also resolves through its SEAS address');

select throws_ok(
  $$ insert into public.people (display_name, grad_year, penn_email)
     values ('Duplicate Engineer', 2027, 'legacy@engineering.upenn.edu') $$,
  '23505', null, 'canonical uniqueness prevents separate alias profiles');

insert into auth.users (id, email, email_confirmed_at)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'setup@seas.upenn.edu', now());
select tests.login('aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok($$ select public.create_my_profile('Setup Engineer', 2029) $$,
  'self-service setup accepts a SEAS login');
select tests.logout();
select is((select penn_email from public.people where display_name = 'Setup Engineer'),
  'setup@engineering.upenn.edu', 'self-service setup stores the Engineering address');

select * from finish();
rollback;
