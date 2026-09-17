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
create or replace function tests.member_update_blocked(request_id uuid) returns boolean
language plpgsql security invoker as $$
declare updated_rows integer;
begin
  update public.link_removal_requests set status = 'approved' where id = request_id;
  get diagnostics updated_rows = row_count;
  return updated_rows = 0;
exception when insufficient_privilege then
  return true;
end $$;

truncate public.changelog, public.notifications, public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id, personal_auth_user_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020, 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('00000000-0000-0000-0000-000000000002', 'Big', 2021, 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', 'Little', 2022, 'aaaaaaaa-0000-0000-0000-000000000003', null),
  ('00000000-0000-0000-0000-000000000004', 'Outsider', 2023, 'aaaaaaaa-0000-0000-0000-000000000004', null),
  ('00000000-0000-0000-0000-000000000005', 'Second little', 2023, 'aaaaaaaa-0000-0000-0000-000000000005', null);
insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000001');
insert into public.links (id, big_id, little_id, status, proposed_by) values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'confirmed', null),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'pending', '00000000-0000-0000-0000-000000000002');

select plan(33);

-- Only a party to a confirmed link may request its removal.
select tests.login('00000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$ insert into public.link_removal_requests (link_id, requested_by) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004') $$,
  '42501', null, 'an outsider cannot request removal');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.link_removal_requests (link_id, requested_by) values ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002') $$,
  'P0001', null, 'a pending link cannot be removed through the review workflow');
select lives_ok(
  $$ insert into public.link_removal_requests (id, link_id, big_id, little_id, requested_by)
     values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
       '00000000-0000-0000-0000-000000000002') $$,
  'a party can request removal of a confirmed link');
select is((select big_id from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000002'::uuid, 'the trigger snapshots the actual big despite forged input');
select is((select little_id from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000003'::uuid, 'the trigger snapshots the actual little despite forged input');
select throws_ok(
  $$ insert into public.link_removal_requests (link_id, requested_by) values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') $$,
  '23505', null, 'only one pending removal request is allowed per link');
select ok(tests.member_update_blocked('dddddddd-0000-0000-0000-000000000001'),
  'a member cannot update a removal request, whether denied or filtered by RLS');
select throws_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000001', true) $$,
  '42501', null, 'members cannot call the decision RPC');
delete from public.links where id = 'cccccccc-0000-0000-0000-000000000001';
select tests.logout();
select is((select count(*) from public.links where id = 'cccccccc-0000-0000-0000-000000000001'),
  1::bigint, 'a member cannot delete a confirmed link directly');
select is((select count(*) from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000001' and status = 'pending'),
  1::bigint, 'a blocked deletion leaves the request pending');

-- A rejection preserves the link, closes the request, and notifies both sign-in identities.
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000001', false) $$,
  'an admin can reject a removal request');
select tests.logout();
select is((select status::text from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000001'),
  'rejected', 'rejection closes the request');
select is((select reviewed_by from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000001'::uuid, 'the decision records its administrator');
select is((select count(*) from public.links where id = 'cccccccc-0000-0000-0000-000000000001'),
  1::bigint, 'rejection preserves the confirmed link');
select is((select count(*) from public.notifications where kind = 'link_removal_rejected' and recipient_user_id in
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002')),
  2::bigint, 'rejection notifies both the requester’s sign-in identities');
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000001', true) $$,
  'P0001', null, 'an already rejected request cannot be approved later');
select tests.logout();

-- The other party may submit a new request after rejection; approval removes the link.
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok(
  $$ insert into public.link_removal_requests (id, link_id, requested_by) values
     ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003') $$,
  'a new removal request is allowed after rejection');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000002', true) $$,
  'an admin can approve a pending removal request');
select tests.logout();
select is((select count(*) from public.links where id = 'cccccccc-0000-0000-0000-000000000001'),
  0::bigint, 'approval deletes the confirmed link');
select is((select status::text from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000002'),
  'approved', 'approval closes the request');
select is((select link_id from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000002'),
  null::uuid, 'the request survives deletion with its link reference cleared');
select is((select count(*) from public.notifications where kind = 'link_removal_approved' and recipient_user_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  1::bigint, 'approval notifies the requester');
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000002', false) $$,
  'P0001', null, 'an already approved request cannot be rejected later');
select tests.logout();

-- Direct admin deletion uses the same close-and-notify path.
update public.links set status = 'confirmed' where id = 'cccccccc-0000-0000-0000-000000000002';
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.link_removal_requests (id, link_id, requested_by) values
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ delete from public.links where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  'an admin can directly delete a confirmed link');
select tests.logout();
select is((select status::text from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000003'),
  'approved', 'direct admin deletion approves its pending removal request');
select is((select count(*) from public.notifications where kind = 'link_removal_approved' and recipient_user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  1::bigint, 'direct admin deletion notifies the requester’s second identity');

-- Only the requester may withdraw a pending request, without deleting the link.
insert into public.links (id, big_id, little_id, status) values
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'confirmed');
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into public.link_removal_requests (id, link_id, requested_by) values
     ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002') $$,
  'a member can request removal of another confirmed link');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
delete from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000004';
select tests.logout();
select is((select count(*) from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000004'),
  1::bigint, 'the other person in the link cannot withdraw the request');
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
delete from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000004';
select tests.logout();
select is((select count(*) from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000004'),
  0::bigint, 'the requester can withdraw while review is pending');
select is((select count(*) from public.links where id = 'cccccccc-0000-0000-0000-000000000003'),
  1::bigint, 'withdrawing leaves the confirmed link intact');
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into public.link_removal_requests (id, link_id, requested_by) values
     ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002') $$,
  'a withdrawn request does not prevent a new request');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.resolve_link_removal_request('dddddddd-0000-0000-0000-000000000005', false) $$,
  'an admin can still decide a resubmitted request');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
delete from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000005';
select tests.logout();
select is((select status::text from public.link_removal_requests where id = 'dddddddd-0000-0000-0000-000000000005'),
  'rejected', 'a reviewed request cannot be withdrawn');

select * from finish();
rollback;
