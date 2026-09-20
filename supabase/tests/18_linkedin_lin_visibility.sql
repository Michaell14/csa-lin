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

truncate public.changelog, public.people, public.lins, public.links, public.admins restart identity cascade;
-- Owner (1) founds Lin A with Linmate (2) as their little. Outsider (3) founds
-- Lin B on their own. Admin (4) is in no lin.
insert into public.people (id, display_name, grad_year, auth_user_id, major, linkedin) values
  ('00000000-0000-0000-0000-000000000001', 'Owner',    2021, 'aaaaaaaa-0000-0000-0000-000000000001', 'CIS', 'https://www.linkedin.com/in/owner'),
  ('00000000-0000-0000-0000-000000000002', 'Linmate',  2022, 'aaaaaaaa-0000-0000-0000-000000000002', null, null),
  ('00000000-0000-0000-0000-000000000003', 'Outsider', 2022, 'aaaaaaaa-0000-0000-0000-000000000003', null, null),
  ('00000000-0000-0000-0000-000000000004', 'Admin',    2020, 'aaaaaaaa-0000-0000-0000-000000000004', null, null);
insert into public.admins(person_id) values ('00000000-0000-0000-0000-000000000004');
insert into public.lins(id, name, color, founder_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Lin A', '#000000', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000b1', 'Lin B', '#111111', '00000000-0000-0000-0000-000000000003');
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'confirmed');

select plan(17);

select is((select show_linkedin from public.people where id = '00000000-0000-0000-0000-000000000001'), false, 'LinkedIn is lin-only by default');
select is((select show_professional from public.people where id = '00000000-0000-0000-0000-000000000001'), true, 'major is visible to all Penn users by default');
select is_empty(
  $$ select column_name from information_schema.columns where table_schema = 'public' and table_name = 'people'
     except
     select column_name from information_schema.columns where table_schema = 'public' and table_name = 'people_with_contact' $$,
  'people_with_contact exposes show_linkedin');

-- Owner and admin always see it.
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'https://www.linkedin.com/in/owner', 'owner sees own lin-only linkedin');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), 'https://www.linkedin.com/in/owner', 'owner sees own lin-only linkedin in graph');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'https://www.linkedin.com/in/owner', 'admin sees lin-only linkedin');
select tests.logout();

-- A member of the same lin sees it; someone outside every shared lin does not.
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select ok(public.shares_lin_with('00000000-0000-0000-0000-000000000001'), 'linmate shares a lin with owner');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'https://www.linkedin.com/in/owner', 'linmate sees lin-only linkedin');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), 'https://www.linkedin.com/in/owner', 'linmate sees lin-only linkedin in graph');
select is((select major from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'CIS', 'major stays visible with LinkedIn lin-only');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
select ok(not public.shares_lin_with('00000000-0000-0000-0000-000000000001'), 'outsider shares no lin with owner');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), null, 'outsider does not see lin-only linkedin');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), null, 'outsider does not see lin-only linkedin in graph');
select tests.logout();

-- Opting in opens it to every signed-in Penn user, including one with no profile.
update public.people set show_linkedin = true where id = '00000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'https://www.linkedin.com/in/owner', 'outsider sees opted-in linkedin');
select tests.logout();
select tests.login(null, 'aaaaaaaa-0000-0000-0000-000000000099');
select is((public.lin_graph('00000000-0000-0000-0000-0000000000a1')->'people'->0->>'linkedin'), 'https://www.linkedin.com/in/owner', 'profileless viewer sees opted-in linkedin in graph');
select tests.logout();

-- Turning major off no longer hides LinkedIn, and vice versa.
update public.people set show_professional = false where id = '00000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
select is((select major from public.people_public where id = '00000000-0000-0000-0000-000000000001'), null, 'major hidden by show_professional');
select is((select linkedin from public.people_public where id = '00000000-0000-0000-0000-000000000001'), 'https://www.linkedin.com/in/owner', 'linkedin unaffected by show_professional');
select tests.logout();

select * from finish();
rollback;
