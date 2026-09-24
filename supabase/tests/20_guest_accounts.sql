begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;

-- A guest session: the hook gives it no person_id and a guest claim.
create or replace function tests.login_guest(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', uid, 'person_id', null, 'guest', true)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

truncate public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, penn_email) values
  ('00000000-0000-0000-0000-000000000001', 'Big', 2024, 'big@upenn.edu'),
  ('00000000-0000-0000-0000-000000000002', 'Little', 2025, 'little@upenn.edu'),
  ('00000000-0000-0000-0000-000000000003', 'Other', 2026, 'other@upenn.edu');
-- Confirming the link founds a lin at the big.
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'confirmed');

insert into public.guest_accounts (email) values ('guest@example.com');
insert into auth.users (id, email, email_confirmed_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'guest@example.com', now()),
  ('dddddddd-0000-0000-0000-000000000002', 'notaguest@example.com', now());

select plan(19);

-- The allowlist
select throws_ok($$ insert into public.guest_accounts (email) values ('someone@upenn.edu') $$,
  '23514', null, 'a Penn address cannot be a guest');
select throws_ok($$ insert into public.guest_accounts (email) values ('Mixed@Example.com') $$,
  '23514', null, 'guest addresses are stored lowercase');
select ok(public.is_guest_email(' GUEST@example.com '), 'guest lookup ignores case and spaces');

-- The access token hook
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000001',
    'authentication_method', 'password',
    'claims', jsonb_build_object('email', 'guest@example.com', 'role', 'authenticated'))) -> 'claims' -> 'person_id',
  'null'::jsonb, 'a guest password sign-in has no person');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000001',
    'authentication_method', 'password',
    'claims', jsonb_build_object('email', 'guest@example.com', 'role', 'authenticated'))) -> 'claims' -> 'guest',
  'true'::jsonb, 'a guest password sign-in carries the guest claim');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000001',
    'authentication_method', 'token_refresh',
    'claims', jsonb_build_object('email', 'guest@example.com', 'role', 'authenticated'))) -> 'claims' -> 'guest',
  'true'::jsonb, 'a guest session refreshes');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000001',
    'authentication_method', 'otp',
    'claims', jsonb_build_object('email', 'guest@example.com'))) -> 'error' ->> 'http_code',
  '403', 'a guest cannot sign in with an email code');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000001',
    'authentication_method', 'recovery',
    'claims', jsonb_build_object('email', 'guest@example.com'))) -> 'error' ->> 'http_code',
  '403', 'a guest cannot sign in with a recovery link');
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'dddddddd-0000-0000-0000-000000000002',
    'authentication_method', 'password',
    'claims', jsonb_build_object('email', 'notaguest@example.com'))) -> 'error' ->> 'http_code',
  '403', 'a password is still refused for addresses not on the list');

-- A guest reads like a member and writes nothing
select tests.login_guest('dddddddd-0000-0000-0000-000000000001');
select is((select count(*) from public.people_public), 3::bigint, 'a guest sees member profiles');
select is(
  (select jsonb_array_length(public.lin_graph((select id from public.lins limit 1)) -> 'people')),
  2, 'a guest can open a lin');
select throws_ok($$ select from public.guest_accounts $$,
  '42501', null, 'a guest cannot read the guest list');
select throws_ok($$ select public.create_my_profile('Guest', 2026) $$,
  '42501', null, 'a guest cannot create a profile');
select throws_ok($$ insert into public.people (display_name, grad_year) values ('Sneaky', 2026) $$,
  '42501', null, 'a guest cannot add people');
select throws_ok($$ insert into public.links (big_id, little_id, status, proposed_by) values
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'pending', null) $$,
  '42501', null, 'a guest cannot propose links');
select throws_ok($$ insert into public.correction_requests (reporter_user_id, kind, person_id, details) values
    ('dddddddd-0000-0000-0000-000000000001', 'profile', '00000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'a guest cannot file corrections');
select is_empty($$ update public.lins set name = 'Renamed' returning id $$, 'a guest cannot rename lins');
select is_empty($$ delete from public.links returning id $$, 'a guest cannot delete links');
select tests.logout();

-- Auth connects as supabase_auth_admin, which keep_guest_credentials holds to
-- the old password and email (checked against a running stack; a test cannot
-- take that role). The SQL editor is not held back, so an admin can reset it.
update auth.users set encrypted_password = 'reset-by-admin'
  where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select encrypted_password from auth.users where id = 'dddddddd-0000-0000-0000-000000000001'),
  'reset-by-admin', 'an admin can reset the guest password from the SQL editor');

select * from finish();
rollback;
