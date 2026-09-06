-- Local development seed. Never run against production.
-- Dev login: alice@upenn.edu / password123 (admin). bob@upenn.edu / password123 (member).

-- People
insert into public.people (id, display_name, grad_year, penn_email, major, hometown) values
  ('10000000-0000-0000-0000-000000000001', 'Alice Wang',   2022, 'alice@upenn.edu', 'CIS',     'Philadelphia, PA'),
  ('10000000-0000-0000-0000-000000000002', 'Bob Chen',     2023, 'bob@upenn.edu',   'Finance', 'San Jose, CA'),
  ('10000000-0000-0000-0000-000000000003', 'Cathy Liu',    2023, 'cathy@upenn.edu', 'Bio',     'Houston, TX'),
  ('10000000-0000-0000-0000-000000000004', 'Derek Zhang',  2024, 'derek@upenn.edu', 'Econ',    'Queens, NY'),
  ('10000000-0000-0000-0000-000000000005', 'Emily Huang',  2024, 'emily@seas.upenn.edu', 'MEAM', 'Bellevue, WA'),
  ('10000000-0000-0000-0000-000000000006', 'Frank Lin',    2025, 'frank@upenn.edu', null,      null),
  ('10000000-0000-0000-0000-000000000011', 'Grace Wu',     2022, 'grace@upenn.edu', 'Nursing', 'Boston, MA'),
  ('10000000-0000-0000-0000-000000000012', 'Henry Xu',     2023, 'henry@upenn.edu', 'PPE',     'Chicago, IL'),
  ('10000000-0000-0000-0000-000000000013', 'Ivy Zhou',     2024, 'ivy@upenn.edu',   'Psych',   'Irvine, CA');

insert into public.lins (id, name, color, founder_id) values
  ('20000000-0000-0000-0000-00000000000a', 'Wang Lin', '#6366f1', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-00000000000b', 'Wu Lin',   '#14b8a6', '10000000-0000-0000-0000-000000000011');

insert into public.links (big_id, little_id, status, academic_year) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'confirmed', '2021-22'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'confirmed', '2021-22'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'confirmed', '2022-23'),
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'confirmed', '2022-23'),
  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006', 'confirmed', '2023-24'),
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000012', 'confirmed', '2021-22'),
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000013', 'confirmed', '2022-23'),
  ('10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000006', 'confirmed', '2023-24');

insert into public.admins (person_id) values ('10000000-0000-0000-0000-000000000001');

-- Dev auth users (email/password, local only). The access token hook claims the
-- matching profile on first sign-in.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@upenn.edu', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@upenn.edu', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   '{"sub":"a0000000-0000-0000-0000-000000000001","email":"alice@upenn.edu"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   '{"sub":"a0000000-0000-0000-0000-000000000002","email":"bob@upenn.edu"}', 'email', now(), now(), now());
