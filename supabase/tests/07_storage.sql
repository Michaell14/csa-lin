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

select plan(20);

select is((select count(*) from storage.buckets where id = 'photos'), 1::bigint, 'photos bucket exists');
select is((select public from storage.buckets where id = 'photos'), false, 'photos bucket is private');
select is((select file_size_limit from storage.buckets where id = 'photos'), 2097152::bigint, '2 MB limit');

-- objects that already exist: a visible person's (03) and a hidden person's (07) avatar
insert into storage.objects (bucket_id, name) values
  ('photos', '00000000-0000-0000-0000-000000000003/avatar.jpg'),
  ('photos', '00000000-0000-0000-0000-000000000007/avatar.jpg');

-- ===== member Big One (02) =====
select tests.login('00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000002/avatar.jpg') $$,
  'member uploads own avatar');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000004/avatar.jpg') $$,
  '42501', null, 'member cannot upload into someone else''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000002/other.jpg') $$,
  '42501', null, 'member cannot upload anything but avatar.<ext> in own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000002/sub/avatar.jpg') $$,
  '42501', null, 'member cannot nest folders');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000002/avatar.svg') $$,
  '42501', null, 'member cannot upload a non-image extension');
select is((select count(*) from storage.objects where name like '00000000-0000-0000-0000-000000000003/%'), 1::bigint,
  'member can read a visible person''s photo');
select is((select count(*) from storage.objects where name like '00000000-0000-0000-0000-000000000007/%'), 0::bigint,
  'member cannot read a hidden person''s photo');
select is((select count(*) from storage.objects where bucket_id = 'photos'), 2::bigint,
  'listing shows only own and visible people''s photos');
delete from storage.objects where name = '00000000-0000-0000-0000-000000000003/avatar.jpg';
select tests.logout();
select is((select count(*) from storage.objects where name = '00000000-0000-0000-0000-000000000003/avatar.jpg'), 1::bigint,
  'member cannot delete someone else''s photo');
select tests.login('00000000-0000-0000-0000-000000000002');

-- the uploader always sends upsert: true, so replacing an avatar in place goes
-- through the UPDATE policy rather than the INSERT one
select lives_ok(
  $$ update storage.objects set updated_at = now()
     where name = '00000000-0000-0000-0000-000000000002/avatar.jpg' $$,
  'member replaces own avatar in place');
select throws_ok(
  $$ update storage.objects set updated_at = now()
     where name = '00000000-0000-0000-0000-000000000003/avatar.jpg' $$,
  '42501', null, 'member cannot overwrite someone else''s avatar');
select throws_ok(
  $$ update storage.objects set name = '00000000-0000-0000-0000-000000000004/avatar.jpg'
     where name = '00000000-0000-0000-0000-000000000002/avatar.jpg' $$,
  '42501', null, 'member cannot rename own avatar into another folder');
select throws_ok(
  $$ update storage.objects set name = '00000000-0000-0000-0000-000000000002/other.jpg'
     where name = '00000000-0000-0000-0000-000000000002/avatar.jpg' $$,
  '42501', null, 'member cannot rename own avatar off the avatar path shape');

select lives_ok(
  $$ delete from storage.objects where name = '00000000-0000-0000-0000-000000000002/avatar.jpg' $$,
  'member deletes own photo');
select tests.logout();

-- ===== admin Founder A (01) =====
select tests.login('00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000004/avatar.png') $$,
  'admin uploads into any person''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', 'loose.jpg') $$,
  '42501', null, 'admin still cannot write outside the avatar path shape');
select is((select count(*) from storage.objects where name like '00000000-0000-0000-0000-000000000007/%'), 1::bigint,
  'admin can read a hidden person''s photo');
select tests.logout();

select * from finish();
rollback;
