begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated;
create or replace function tests.login(pid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', gen_random_uuid(), 'person_id', pid)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select plan(10);

select ok(public.is_penn_email('alice@upenn.edu'), 'plain upenn.edu is Penn');
select ok(public.is_penn_email('bob@seas.upenn.edu'), 'subdomain is Penn');
select ok(public.is_penn_email('Carol@Wharton.UPenn.EDU'), 'case-insensitive');
select ok(not public.is_penn_email('dave@gmail.com'), 'gmail is not Penn');
select ok(not public.is_penn_email('eve@notupenn.edu'), 'lookalike domain is not Penn');
select ok(not public.is_penn_email('frank@upenn.edu.evil.com'), 'suffix trick is not Penn');

insert into public.people (id, display_name, grad_year) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 2020),
  ('00000000-0000-0000-0000-000000000002', 'Member', 2021);
insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000001');

select is(public.current_person_id(), null, 'no JWT means no person');

select tests.login('00000000-0000-0000-0000-000000000002');
select is(public.current_person_id(), '00000000-0000-0000-0000-000000000002'::uuid, 'person_id claim is read');
select ok(not public.is_admin(), 'member is not admin');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000001');
select ok(public.is_admin(), 'admin row makes is_admin true');
select tests.logout();

select * from finish();
rollback;
