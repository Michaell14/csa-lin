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


select plan(15);
select tests.login('00000000-0000-0000-0000-000000000002');
select ok(public.can_access_lin_memories('00000000-0000-0000-0000-0000000000a1'), 'descendant can access memories');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg')$$, 'member can upload');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_path,media_type,caption) values ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg','image','Dinner')$$, 'member can publish uploaded media');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_path,media_type,created_at) values ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','invalid','image',now())$$, '42501', null, 'cannot forge posting date');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg')$$, 'member can upload private media');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_path,media_type,caption,private_to_lin) values ('00000000-0000-0000-0000-000000000097','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg','image','Lin only',true)$$, 'member can publish a lin-only memory');
-- An upload whose publish never landed, or whose row was deleted while storage
-- cleanup failed, is readable by its uploader only.
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000096.jpg')$$, 'member can upload media before publishing');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),3::bigint,'uploader can read their own unpublished media');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.lin_memories),2::bigint,'fellow member can read public and private memories');
select is(tests.rows_affected('delete from public.lin_memories'),0,'fellow member cannot delete');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),2::bigint,'fellow member cannot read unpublished media');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000011');
select is((select count(*) from public.lin_memories),1::bigint,'other lin can read public but not private memories');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),1::bigint,'other lin can read public but not private media');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000011/00000000-0000-0000-0000-000000000098.jpg')$$,'42501',null,'other lin cannot upload');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002');
select is(tests.rows_affected('delete from public.lin_memories'),2,'author can delete own posts');
select tests.logout();
select * from finish();
rollback;
