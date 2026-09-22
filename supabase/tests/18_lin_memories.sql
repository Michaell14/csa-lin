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

-- A row the USING clause hides is filtered out, not rejected: the statement runs
-- and touches nothing. Counting the affected rows is how those cases get asserted,
-- since there is no exception to catch. Security invoker, so RLS applies as the
-- signed-in test role.
create or replace function tests.rows_affected(stmt text) returns int language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
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


select plan(24);
select is((select file_size_limit from storage.buckets where id = 'lin-memories'), 26214400::bigint, '25 MB upload limit on memories');
select tests.login('00000000-0000-0000-0000-000000000002');
select ok(public.can_access_lin_memories('00000000-0000-0000-0000-0000000000a1'), 'descendant can access memories');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg')$$, 'member can upload');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg'],'Dinner')$$, 'member can publish uploaded media');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,created_at) values ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['invalid'],now())$$, '42501', null, 'cannot forge posting date');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg')$$, 'member can upload private media');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption,private_to_lin) values ('00000000-0000-0000-0000-000000000097','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg'],'Lin only',true)$$, 'member can publish a lin-only memory');
-- A memory can carry up to five objects, every one of which must exist. Row
-- security runs before table constraints, so the six-item case lists six real
-- objects to reach the constraint, and the missing-object case lists one that
-- was never uploaded to reach the policy.
select lives_ok($$insert into storage.objects(bucket_id,name) values
  ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000056.jpg')$$, 'member can upload six objects');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000056.jpg'],'Six')$$, '23514', null, 'six items are rejected');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000057.jpg'],'Missing')$$, '42501', null, 'a memory cannot list an object that was never uploaded');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg'],'Twice')$$, '23514', null, 'the same object cannot appear twice');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm'],'Five')$$, 'member can publish a five-item memory');
-- A stored object belongs to one memory: publishing claims each path, so a
-- second memory naming one of them is rejected. The ledger is closed to
-- authenticated, so counting it happens signed out.
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000049','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg'],'Stolen')$$, '23505', null, 'a second memory cannot claim an object another memory holds');
select tests.logout();
select is((select count(*) from public.lin_memory_media),7::bigint,'every published path is claimed once');
select tests.login('00000000-0000-0000-0000-000000000002');
-- An upload whose publish never landed, or whose row was deleted while storage
-- cleanup failed, is readable by its uploader only.
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000096.jpg')$$, 'member can upload media before publishing');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),9::bigint,'uploader can read their own unpublished media');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.lin_memories),3::bigint,'fellow member can read public and private memories');
select is(tests.rows_affected('delete from public.lin_memories'),0,'fellow member cannot delete');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),7::bigint,'fellow member reads every published object and no unpublished one');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000011');
select is((select count(*) from public.lin_memories),2::bigint,'other lin can read public but not private memories');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),6::bigint,'other lin can read public but not private media');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000011/00000000-0000-0000-0000-000000000098.jpg')$$,'42501',null,'other lin cannot upload');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002');
select is(tests.rows_affected('delete from public.lin_memories'),3,'author can delete own posts');
select tests.logout();
select is((select count(*) from public.lin_memory_media),0::bigint,'deleting a memory frees every path it held');
select * from finish();
rollback;
