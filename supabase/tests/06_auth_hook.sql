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

select plan(14);

-- The hook now checks auth.users: the claim email must match the stored one and be confirmed.
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'big1@upenn.edu',      now()),
  ('aaaaaaaa-0000-0000-0000-0000000000ff', 'stranger@upenn.edu',  now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'bigtwo@gmail.com',    now()),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'childone@gmail.com',  now()),
  ('bbbbbbbb-0000-0000-0000-0000000000ff', 'random@gmail.com',    now()),
  ('cccccccc-0000-0000-0000-000000000001', 'big3@upenn.edu',      null),
  ('cccccccc-0000-0000-0000-000000000002', 'someoneelse@upenn.edu', now());

select has_function('public', 'custom_access_token_hook', array['jsonb'], 'hook function exists');

-- 1. Penn email matching an unclaimed profile: claims it and stamps person_id
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-000000000002',
     'claims', jsonb_build_object('email', 'Big1@upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000002', 'Penn email resolves to matching profile');
select is((select auth_user_id from public.people where id = '00000000-0000-0000-0000-000000000002'),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'profile is claimed by that auth user');
select isnt((select claimed_at from public.people where id = '00000000-0000-0000-0000-000000000002'),
  null, 'claimed_at is set');

-- 2. Same person signs in again: person_id still present, claim unchanged
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-000000000002',
     'claims', jsonb_build_object('email', 'big1@upenn.edu')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000002', 'repeat sign-in resolves the same profile');

-- 3. Penn email with no profile: allowed as a viewer, person_id is null
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'stranger@upenn.edu')))
   -> 'claims' -> 'person_id'),
  'null'::jsonb, 'unknown Penn email becomes a viewer');
select ok(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'stranger@upenn.edu'))) ? 'error') = false,
  'unknown Penn email is not rejected');

-- 4. Personal email on a claimed profile: accepted
update public.people set personal_email = 'bigtwo@gmail.com', claimed_at = now(), auth_user_id = gen_random_uuid()
  where id = '00000000-0000-0000-0000-000000000003';
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-000000000003',
     'claims', jsonb_build_object('email', 'BigTwo@gmail.com')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000003', 'personal email on claimed profile resolves');

-- 5. Personal email on an UNclaimed profile: rejected
update public.people set personal_email = 'childone@gmail.com' where id = '00000000-0000-0000-0000-000000000004';
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-000000000004',
     'claims', jsonb_build_object('email', 'childone@gmail.com')))
   -> 'error' ->> 'http_code'),
  '403', 'personal email cannot claim');

-- 6. Unknown non-Penn email: rejected
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'random@gmail.com')))
   -> 'error' ->> 'message'),
  'Please sign in with your Penn Google account.', 'random gmail is rejected with the spec message');

-- 7. Unconfirmed email: rejected even though it matches an unclaimed profile
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'cccccccc-0000-0000-0000-000000000001',
     'claims', jsonb_build_object('email', 'big3@upenn.edu')))
   -> 'error' ->> 'message'),
  'Please sign in with a verified email address.', 'unconfirmed email is rejected');
select is((select auth_user_id from public.people where id = '00000000-0000-0000-0000-000000000012'),
  null, 'unconfirmed sign-in does not claim the profile');

-- 8. Claim email that does not match the stored user email: rejected
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'cccccccc-0000-0000-0000-000000000002',
     'claims', jsonb_build_object('email', 'big1@upenn.edu')))
   -> 'error' ->> 'http_code'),
  '403', 'email claim must match the auth user');

-- 9. App users cannot call the hook
select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.custom_access_token_hook('{"user_id":"aaaaaaaa-0000-0000-0000-000000000001","claims":{"email":"foundera@upenn.edu"}}'::jsonb) $$,
  '42501', null, 'authenticated role cannot execute the hook');
select tests.logout();

select * from finish();
rollback;
