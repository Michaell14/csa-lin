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
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'new@nursing.upenn.edu', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'unverified@upenn.edu', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'personal@gmail.com', now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'existing@upenn.edu', now());
insert into public.people (display_name, grad_year, penn_email)
  values ('Existing Name', 2027, 'existing@upenn.edu');

select plan(15);
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select public.create_my_profile('New Member', 2028) $$,
  'verified Penn account can create its profile');
select tests.logout();
select is((select count(*) from public.people where penn_email = 'new@nursing.upenn.edu'),
  1::bigint, 'profile uses the verified account email');
select is((select display_name from public.people where penn_email = 'new@nursing.upenn.edu'),
  'New Member', 'profile stores the supplied name');
select is((select grad_year from public.people where penn_email = 'new@nursing.upenn.edu'),
  2028, 'profile stores the required class year');
select is(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'authentication_method', 'otp',
    'claims', jsonb_build_object('email', 'new@nursing.upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id')::uuid,
  (select id from public.people where penn_email = 'new@nursing.upenn.edu'),
  'refreshing the session supplies the new person id');

select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select public.create_my_profile('Different Name', 2029) $$,
  'repeat submission reuses the existing profile');
select tests.logout();
select is((select count(*) from public.people where penn_email = 'new@nursing.upenn.edu'),
  1::bigint, 'repeat submission does not create a duplicate');
select is((select grad_year from public.people where penn_email = 'new@nursing.upenn.edu'),
  2028, 'repeat submission does not overwrite profile fields');

select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok($$ select public.create_my_profile('New Member', null) $$,
  '22023', null, 'class year is required');
select tests.logout();

select tests.login('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok($$ select public.create_my_profile('Unverified', 2028) $$,
  '42501', null, 'unverified email cannot create a profile');
select tests.logout();
select tests.login('aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok($$ select public.create_my_profile('Personal', 2028) $$,
  '42501', null, 'unlinked personal email cannot create a profile');
select tests.logout();

select tests.login('aaaaaaaa-0000-0000-0000-000000000004');
select lives_ok($$ select public.create_my_profile('Other Name', 2030) $$,
  'pre-added matching profile is reused');
select tests.logout();
select is((select display_name from public.people where penn_email = 'existing@upenn.edu'),
  'Existing Name', 'pre-added profile name is preserved for the auth hook to claim');
select is(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000004',
    'authentication_method', 'oauth',
    'claims', jsonb_build_object('email', 'existing@upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id')::uuid,
  (select id from public.people where penn_email = 'existing@upenn.edu'),
  'session refresh returns the pre-added profile id');
select is((select auth_user_id from public.people where penn_email = 'existing@upenn.edu'),
  'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
  'session refresh binds the pre-added profile to its signed-in user');

select * from finish();
rollback;
