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

truncate public.lin_milestones, public.changelog, public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id, major, show_professional) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020, 'aaaaaaaa-0000-0000-0000-000000000001', 'History', false),
  ('00000000-0000-0000-0000-000000000002', 'Member', 2021, 'aaaaaaaa-0000-0000-0000-000000000002', 'CIS', false);
insert into public.admins(person_id) values ('00000000-0000-0000-0000-000000000001');
insert into public.lins(id, name, color, founder_id) values ('00000000-0000-0000-0000-0000000000a1', 'Lin A', '#000000', '00000000-0000-0000-0000-000000000002');
-- Give the member every optional field and opt every category out, so masking is exercised on all four visibility flags.
update public.people set hometown='Philadelphia', bio='Loves hiking', instagram='member_ig', linkedin='https://www.linkedin.com/in/member',
  show_location=false, show_bio_interests=false, show_socials=false where id='00000000-0000-0000-0000-000000000002';

select plan(26);
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*) from public.lin_milestones), 0::bigint, 'authenticated members can read milestones');
select throws_ok($$ insert into public.lin_milestones(lin_id,title,event_date) values ('00000000-0000-0000-0000-0000000000a1','Launch','2026-09-14') $$, '42501', null, 'non-admin cannot create milestones');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'major'), 'CIS', 'profile owner sees opted-out professional data in graph');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'hometown'), 'Philadelphia', 'profile owner sees opted-out location in graph');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'bio'), 'Loves hiking', 'profile owner sees opted-out bio in graph');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'instagram'), 'member_ig', 'profile owner sees opted-out socials in graph');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), 'https://www.linkedin.com/in/member', 'profile owner sees opted-out linkedin in graph');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.lin_milestones(id,lin_id,title,event_date,created_by) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','Launch','2026-09-14','00000000-0000-0000-0000-000000000002') $$, 'admin creates a milestone');
select is((select created_by from public.lin_milestones where title='Launch'), '00000000-0000-0000-0000-000000000001'::uuid, 'database binds milestone attribution to actor');
select throws_ok($$ insert into public.lin_milestones(lin_id,title,event_date) values ('00000000-0000-0000-0000-0000000000a1',' ','2026-09-14') $$, '23514', null, 'trimmed title minimum is enforced');
select throws_ok($$ insert into public.lin_milestones(lin_id,title,event_date) values ('00000000-0000-0000-0000-0000000000a1',repeat('x',121),'2026-09-14') $$, '23514', null, 'title maximum is enforced');
select lives_ok($$ update public.lin_milestones set title='Launch revised', description='Updated details' where id='00000000-0000-0000-0000-0000000000c1' $$, 'admin updates a milestone');
select lives_ok($$ delete from public.lin_milestones where id='00000000-0000-0000-0000-0000000000c1' $$, 'admin deletes a milestone');
select is((select count(*) from public.changelog where table_name='lin_milestones' and action='insert'), 1::bigint, 'milestone creation is audited');
select is((select count(*) from public.changelog where table_name='lin_milestones' and action='update'), 1::bigint, 'milestone update is audited');
select is((select count(*) from public.changelog where table_name='lin_milestones' and action='delete'), 1::bigint, 'milestone deletion is audited');
select is((select count(*) from public.changelog where table_name='lin_milestones' and row_id='00000000-0000-0000-0000-0000000000c1' and actor_id='00000000-0000-0000-0000-000000000001'), 3::bigint, 'all milestone audit rows identify the row and actor');
select ok((select before is null and after->>'title'='Launch' from public.changelog where table_name='lin_milestones' and action='insert'), 'insert audit stores only the after snapshot');
select ok((select before->>'title'='Launch' and after->>'title'='Launch revised' and after->>'description'='Updated details' from public.changelog where table_name='lin_milestones' and action='update'), 'update audit stores changed before and after snapshots');
select ok((select before->>'title'='Launch revised' and after is null from public.changelog where table_name='lin_milestones' and action='delete'), 'delete audit stores only the before snapshot');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'major'), 'CIS', 'admin sees opted-out professional data in graph');
select tests.logout();

select tests.login(null, 'aaaaaaaa-0000-0000-0000-000000000099');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'major'), null, 'profileless viewer does not see opted-out professional data');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'hometown'), null, 'profileless viewer does not see opted-out location');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'bio'), null, 'profileless viewer does not see opted-out bio');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'instagram'), null, 'profileless viewer does not see opted-out socials');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), null, 'profileless viewer does not see opted-out linkedin');
select * from finish();
rollback;
