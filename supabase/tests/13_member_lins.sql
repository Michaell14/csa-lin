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
-- The other party confirms the pending link between two people.
create or replace function tests.confirm(big uuid, little uuid, who uuid) returns void language sql as $$
  update public.links set status = 'confirmed', confirmed_by = who, confirmed_at = now()
  where big_id = big and little_id = little;
$$;

truncate public.changelog, public.notifications, public.people, public.lins, public.links, public.admins restart identity cascade;
insert into public.people (id, display_name, grad_year, auth_user_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin',     2019, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', 'Ada Wong',  2020, 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003', 'Ben Ito',   2021, 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004', 'Cal Ruiz',  2022, 'aaaaaaaa-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005', 'Dee Park',  2022, 'aaaaaaaa-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000006', 'Eve Chen',  2023, 'aaaaaaaa-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-000000000007', 'Sam Lee',   2021, 'aaaaaaaa-0000-0000-0000-000000000007'),
  ('00000000-0000-0000-0000-000000000008', 'Sam Lee',   2021, 'aaaaaaaa-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000009', 'Zed Ahmed', 2018, 'aaaaaaaa-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000010', 'Kim Tran',  2020, 'aaaaaaaa-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000011', 'Lee Fong',  2021, 'aaaaaaaa-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000012', 'Pia Nair',  2023, 'aaaaaaaa-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-000000000013', 'Quinn Ho',  2023, 'aaaaaaaa-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000014', 'Rae Diaz',  2020, 'aaaaaaaa-0000-0000-0000-000000000014'),
  ('00000000-0000-0000-0000-000000000015', 'Tai Sun',   2021, 'aaaaaaaa-0000-0000-0000-000000000015'),
  ('00000000-0000-0000-0000-000000000016', 'Uma Bell',  2019, 'aaaaaaaa-0000-0000-0000-000000000016'),
  ('00000000-0000-0000-0000-000000000017', 'Vic Cole',  2019, 'aaaaaaaa-0000-0000-0000-000000000017'),
  ('00000000-0000-0000-0000-000000000018', 'Wes Dorn',  2020, 'aaaaaaaa-0000-0000-0000-000000000018'),
  ('00000000-0000-0000-0000-000000000019', 'Xia Eng',   2021, 'aaaaaaaa-0000-0000-0000-000000000019');
insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000001');

select plan(34);

-- ===== proposing alone founds nothing; confirming founds the lin at the big =====
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'pending', '00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.lins), 0::bigint, 'a pending link founds no lin');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
select tests.confirm('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.lins), 1::bigint, 'confirming the first link founds a lin');
select is((select founder_id from public.lins), '00000000-0000-0000-0000-000000000002'::uuid, 'the big is its founder');
select is((select name from public.lins), 'Ada Wong''s Lin', 'the lin is named after the founder');
select is((select color from public.lins), '#c63d2f', 'the first lin takes the first palette colour');
select tests.logout();
-- The changelog is admin-only, so read it with no app role.
select is((select count(*) from public.changelog where table_name = 'lins' and action = 'insert' and actor_id = '00000000-0000-0000-0000-000000000003'),
  1::bigint, 'the founding is audited to the person who confirmed');

-- ===== links under an existing founder join the lin =====
select tests.login('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'pending', '00000000-0000-0000-0000-000000000003');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004');
select tests.confirm('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'pending', '00000000-0000-0000-0000-000000000002');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005');
select tests.confirm('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005');
select tests.logout();
select is((select count(*) from public.lins), 1::bigint, 'links under a founder found no second lin');
select is((select count(*) from public.lin_members((select id from public.lins))), 4::bigint, 'the new littles are members by derivation');

-- ===== a new big above the founder takes the lin over =====
select tests.login('00000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 'pending', '00000000-0000-0000-0000-000000000009');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
select tests.confirm('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
select tests.logout();
select is((select count(*) from public.lins), 1::bigint, 'a big above the founder founds no second lin');
select is((select founder_id from public.lins), '00000000-0000-0000-0000-000000000009'::uuid, 'the lin grows upward to the new top');
select is((select name from public.lins), 'Ada Wong''s Lin', 'and keeps its name');
select is((select count(*) from public.lins_of('00000000-0000-0000-0000-000000000004')), 1::bigint, 'a descendant is still in exactly one lin');

-- ===== the founder edits name and colour, nothing else =====
select tests.login('00000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009');
select lives_ok(
  $$ update public.lins set name = 'Ahmed Lin', color = '#123abc' where founder_id = '00000000-0000-0000-0000-000000000009' $$,
  'the founder renames and recolours their lin');
select is((select name || ' ' || color from public.lins), 'Ahmed Lin #123abc', 'the edit landed');
select throws_ok(
  $$ update public.lins set founder_id = '00000000-0000-0000-0000-000000000002' where founder_id = '00000000-0000-0000-0000-000000000009' $$,
  '42501', null, 'the founder cannot hand the lin to someone else');
select throws_ok(
  $$ update public.lins set color = 'red' where founder_id = '00000000-0000-0000-0000-000000000009' $$,
  '23514', null, 'the colour must be a hex colour');
select throws_ok(
  $$ update public.lins set name = '   ' where founder_id = '00000000-0000-0000-0000-000000000009' $$,
  '23514', null, 'the name cannot be blank');
select throws_ok(
  $$ update public.lins set name = repeat('x', 121) where founder_id = '00000000-0000-0000-0000-000000000009' $$,
  '23514', null, 'the name is capped at 120 characters');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
update public.lins set name = 'Hijacked' where name = 'Ahmed Lin';
select is((select name from public.lins), 'Ahmed Lin', 'a member who is not the founder cannot edit the lin');
select throws_ok(
  $$ insert into public.lins (name, color, founder_id) values ('Mine', '#000000', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'a member still cannot insert a lin directly');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ update public.lins set founder_id = '00000000-0000-0000-0000-000000000002' where name = 'Ahmed Lin' $$,
  'an admin can still change the founder');
update public.lins set founder_id = '00000000-0000-0000-0000-000000000009' where name = 'Ahmed Lin';
select tests.logout();

-- ===== a chain with no lin yet: the lin lands at the chain's top =====
-- Founded automatically, then removed: a chain from before lins founded themselves.
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', 'confirmed');
delete from public.lins where founder_id = '00000000-0000-0000-0000-000000000010';
select tests.login('00000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000011');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000006', 'pending', '00000000-0000-0000-0000-000000000011');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006');
select tests.confirm('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006');
select tests.logout();
select is((select founder_id from public.lins where founder_id in ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011')),
  '00000000-0000-0000-0000-000000000010'::uuid, 'a link under a lin-less chain founds the lin at the top of the chain');
select is((select name from public.lins where founder_id = '00000000-0000-0000-0000-000000000010'), 'Kim Tran''s Lin', 'named after that top');

-- ===== two founders with the same name =====
select tests.login('00000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000007');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000012', 'pending', '00000000-0000-0000-0000-000000000007');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000012');
select tests.confirm('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000008');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000013', 'pending', '00000000-0000-0000-0000-000000000008');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000013');
select tests.confirm('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000013');
select tests.logout();
select is((select name from public.lins where founder_id = '00000000-0000-0000-0000-000000000007'), 'Sam Lee''s Lin', 'the first Sam Lee gets the plain name');
select is((select name from public.lins where founder_id = '00000000-0000-0000-0000-000000000008'), 'Sam Lee''s Lin 2', 'a taken name gets a number');
select is((select count(distinct color) from public.lins), (select count(*) from public.lins), 'each lin gets a different colour while the palette lasts');

-- ===== a lin that ends up inside another lin is kept =====
select tests.login('00000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007', 'pending', '00000000-0000-0000-0000-000000000006');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000007');
select tests.confirm('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007');
select tests.logout();
select is((select count(*) from public.lins), 4::bigint, 'a founder who gains a big inside another lin keeps their lin');
select is((select founder_id from public.lins where name = 'Sam Lee''s Lin'), '00000000-0000-0000-0000-000000000007'::uuid, 'and stays its founder');
select is((select count(*) from public.lins_of('00000000-0000-0000-0000-000000000012')), 2::bigint, 'their littles are now in both lins');

-- ===== a lin outlives the link that founded it =====
select tests.login('00000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000013');
delete from public.links where big_id = '00000000-0000-0000-0000-000000000008' and little_id = '00000000-0000-0000-0000-000000000013';
select tests.logout();
select is((select count(*) from public.lins where founder_id = '00000000-0000-0000-0000-000000000008'), 1::bigint, 'removing the founding link keeps the lin');

-- ===== an admin-entered confirmed link founds a lin the same way; re-saving a confirmed link does not =====
select tests.login('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000015', 'confirmed');
select is((select name from public.lins where founder_id = '00000000-0000-0000-0000-000000000014'), 'Rae Diaz''s Lin', 'an admin-entered link founds a lin the same way');
update public.links set status = 'confirmed' where big_id = '00000000-0000-0000-0000-000000000014';
select is((select count(*) from public.lins), 5::bigint, 'an update that leaves a link confirmed founds nothing');
select tests.logout();

-- ===== a lin-less chain with two tops founds a lin at each =====
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000018', 'confirmed'),
  ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000018', 'confirmed');
delete from public.lins where founder_id in ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000017');
select tests.login('00000000-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-000000000018');
insert into public.links (big_id, little_id, status, proposed_by) values
  ('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000019', 'pending', '00000000-0000-0000-0000-000000000018');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000019', 'aaaaaaaa-0000-0000-0000-000000000019');
select tests.confirm('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000019');
select tests.logout();
select is((select count(*) from public.lins where founder_id in ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000017')),
  2::bigint, 'a chain with two tops founds a lin at each');
select is((select count(*) from public.lins_of('00000000-0000-0000-0000-000000000019')), 2::bigint, 'the little is in both');

select * from finish();
rollback;
