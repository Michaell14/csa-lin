# CSA Lin Tree — Backend (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the complete Supabase backend for the CSA lin tree: schema, graph queries, row-level security, changelog, auth hook, storage policies, and admin actions, so that a frontend can be built against it with no server code of its own.

**Architecture:** Everything lives in Postgres inside a Supabase project. Tables hold people, lins, links, admins, and a changelog. Business rules (cycle prevention, protected columns, last-admin guard, merging) are triggers and functions. Authorization is row-level security keyed on a `person_id` claim that a custom access token hook stamps into every JWT. Tests are pgTAP files run with `supabase test db` against the local stack.

**Tech Stack:** Supabase CLI 2.67+, Postgres 15 (Supabase local via Docker), pgTAP, plpgsql. No application code in this plan; the Next.js frontend is a separate plan.

**Spec:** `docs/superpowers/specs/2026-09-06-csa-lin-design.md`

## Global Constraints

- All emails stored lowercase. A Penn email is any address whose domain is `upenn.edu` or a subdomain of it (for example `seas.upenn.edu`).
- A link is directed big → little. `big_id <> little_id`. `(big_id, little_id)` is unique. Confirmed links must never form a cycle.
- Lin membership is derived: founder plus everyone reachable from the founder over confirmed links. It is never stored.
- No row in `people` is ever deleted from the app. Hidden or merged instead.
- Once `claimed_at` is set, `penn_email` cannot change through the app (any role).
- Members may change on their own row only: `display_name`, `grad_year`, `personal_email`, `photo_path`, `major`, `hometown`, `bio`, `instagram`, `linkedin`.
- Storage bucket `photos`: private, 2 MB cap, `image/jpeg`, `image/png`, `image/webp` only. Member writes only under a folder named by their own person id.
- Roles: `anon` gets nothing. `authenticated` is gated entirely by RLS policies. Admin status is a row in `admins`, checked live (never cached in the JWT).
- Migration files are named `supabase/migrations/2026090600000N_<name>.sql`. Test files are `supabase/tests/0N_<name>.sql`.
- Every migration is applied with `supabase db reset` and every test run with `supabase test db`. Both need the local stack running (`supabase start`), which needs Docker Desktop running.

---

## Prerequisites for whoever executes this

1. Start Docker Desktop and wait until `docker info` succeeds.
2. Working directory is the repo root: `/Users/michaelli/Documents/projects/csa-lin`.
3. `supabase --version` prints 2.67 or newer.

## Test file preamble (used in every test file)

Every pgTAP test file in this plan starts with this exact block and ends with `select * from finish(); rollback;`. It runs the whole file in one transaction, so fixtures never leak between files. `tests.login(person_id)` simulates an authenticated user whose JWT carries that `person_id` claim (pass `null` for a viewer with no profile). `tests.logout()` returns to the `postgres` superuser.

```sql
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
```

## Fixture graph (used by several test files)

Fixed UUIDs so assertions are readable. Two lins that share one descendant.

```
Lin A (founder 01, 2020)          Lin B (founder 11, 2020)
  01 → 02 (2021)                    11 → 12 (2021)
  01 → 03 (2021)                    12 → 06
  02 → 04 (2022)
  03 → 05 (2022)
  04 → 06 (2023)   ← 06 "Shared Kid" has two bigs: 04 (Lin A) and 12 (Lin B)
  05 → 07 (2023)   ← 07 is hidden
Admin: 01
```

```sql
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
```

---

### Task 1: Initialize the Supabase project and prove the test runner works

**Files:**
- Create: `supabase/config.toml` (generated, then edited)
- Create: `supabase/tests/00_smoke.sql`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running local stack at `http://127.0.0.1:54321` (API) and `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (DB); the `supabase test db` command as the test runner for every later task.

- [ ] **Step 1: Initialize the project**

Run:
```bash
supabase init
```
Expected: creates `supabase/config.toml` and an empty `supabase/migrations/` directory. If it prints a prompt about IDE settings, answer no.

- [ ] **Step 2: Enable local email/password sign-in so the auth hook can be exercised without Google**

Open `supabase/config.toml`. Find the `[auth.email]` section and make sure these three keys read exactly:

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```

Leave everything else as generated. Do not enable the auth hook yet; that happens in Task 7 once the function exists.

- [ ] **Step 3: Add Supabase local files to .gitignore**

Append to `.gitignore`:
```
supabase/.branches/
supabase/.temp/
```

- [ ] **Step 4: Write the smoke test**

Create `supabase/tests/00_smoke.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select ok(true, 'pgTAP runs');
select * from finish();
rollback;
```

- [ ] **Step 5: Start the stack and run the test**

Run:
```bash
supabase start
supabase test db
```
Expected: `supabase start` prints the API URL, DB URL, anon key, and service_role key. `supabase test db` prints `supabase/tests/00_smoke.sql .. ok` and `All tests successful.`

- [ ] **Step 6: Commit**

```bash
git add supabase .gitignore
git commit -m "chore: init supabase project with pgTAP smoke test"
```

---

### Task 2: Core schema

**Files:**
- Create: `supabase/migrations/20260906000001_schema.sql`
- Create: `supabase/tests/01_schema.sql`

**Interfaces:**
- Produces tables `public.people`, `public.lins`, `public.links`, `public.admins`; enum `public.link_status ('pending','confirmed')`; trigger function `public.set_updated_at()`.

- [ ] **Step 1: Write the failing schema test**

Create `supabase/tests/01_schema.sql` (starts with the preamble from the top of this plan):
```sql
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

select plan(14);

select has_table('public', 'people', 'people table exists');
select has_table('public', 'lins', 'lins table exists');
select has_table('public', 'links', 'links table exists');
select has_table('public', 'admins', 'admins table exists');
select has_enum('public', 'link_status', 'link_status enum exists');

select col_is_unique('public', 'people', 'penn_email', 'penn_email is unique');
select col_is_unique('public', 'people', 'personal_email', 'personal_email is unique');
select col_is_unique('public', 'lins', 'name', 'lin name is unique');

-- emails must be stored lowercase
select throws_ok(
  $$ insert into public.people (display_name, grad_year, penn_email) values ('X', 2025, 'Mixed@Upenn.edu') $$,
  '23514', null, 'uppercase penn_email is rejected');

-- self-link rejected
insert into public.people (id, display_name, grad_year) values ('00000000-0000-0000-0000-000000000001', 'A', 2020);
insert into public.people (id, display_name, grad_year) values ('00000000-0000-0000-0000-000000000002', 'B', 2021);
select throws_ok(
  $$ insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'self link is rejected');

-- duplicate pair rejected
insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.links (big_id, little_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') $$,
  '23505', null, 'duplicate link pair is rejected');

-- link defaults to pending
select is((select status::text from public.links limit 1), 'pending', 'new link defaults to pending');

-- lin color must be a hex color
select throws_ok(
  $$ insert into public.lins (name, color, founder_id) values ('L', 'blue', '00000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'non-hex lin color is rejected');

-- updated_at bumps on update
update public.people set display_name = 'A2' where id = '00000000-0000-0000-0000-000000000001';
select ok((select updated_at > created_at from public.people where id = '00000000-0000-0000-0000-000000000001'),
  'updated_at moves forward on update');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `01_schema.sql` fails with "people table exists" not ok (and more).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000001_schema.sql`:
```sql
-- Core tables for the CSA lin tree.
create extension if not exists pgcrypto;

create type public.link_status as enum ('pending', 'confirmed');

create table public.people (
  id              uuid primary key default gen_random_uuid(),
  display_name    text not null check (length(trim(display_name)) > 0),
  grad_year       int  not null check (grad_year between 1900 and 2200),
  penn_email      text unique,
  personal_email  text unique,
  auth_user_id    uuid unique,
  claimed_at      timestamptz,
  photo_path      text,
  major           text,
  hometown        text,
  bio             text,
  instagram       text,
  linkedin        text,
  hidden          boolean not null default false,
  merged_into     uuid references public.people(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint people_penn_email_lower     check (penn_email     is null or penn_email     = lower(penn_email)),
  constraint people_personal_email_lower check (personal_email is null or personal_email = lower(personal_email)),
  constraint people_not_merged_into_self check (merged_into is null or merged_into <> id)
);

create table public.lins (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  founder_id  uuid not null references public.people(id),
  created_at  timestamptz not null default now()
);

create table public.links (
  id             uuid primary key default gen_random_uuid(),
  big_id         uuid not null references public.people(id),
  little_id      uuid not null references public.people(id),
  academic_year  text,
  status         public.link_status not null default 'pending',
  proposed_by    uuid references public.people(id),
  confirmed_by   uuid references public.people(id),
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz,
  constraint links_not_self  check (big_id <> little_id),
  constraint links_unique_pair unique (big_id, little_id)
);
create index links_little_idx on public.links (little_id);
create index links_big_idx    on public.links (big_id);

create table public.admins (
  person_id   uuid primary key references public.people(id),
  granted_by  uuid references public.people(id),
  granted_at  timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end $$;

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();
```

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: both test files pass. `01_schema.sql .. ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000001_schema.sql supabase/tests/01_schema.sql
git commit -m "feat(db): core schema for people, lins, links, admins"
```

---

### Task 3: Graph queries and cycle prevention

**Files:**
- Create: `supabase/migrations/20260906000002_graph.sql`
- Create: `supabase/tests/02_graph.sql`

**Interfaces:**
- Produces:
  - `public.ancestors_of(p uuid) returns setof uuid` — every big, grand-big, etc. over confirmed links.
  - `public.descendants_of(p uuid) returns setof uuid` — every little, grand-little, etc. over confirmed links.
  - `public.lin_members(lin uuid) returns table (person_id uuid, is_founder boolean)` — founder (always, even if hidden) plus non-hidden, non-merged descendants.
  - `public.lins_of(p uuid) returns setof uuid` — ids of every lin whose founder is `p` or an ancestor of `p`.
  - Trigger `links_no_cycle` on `public.links` raising SQLSTATE `23514` with message `link would create a cycle`.

- [ ] **Step 1: Write the failing graph test**

Create `supabase/tests/02_graph.sql`. Begin with the preamble, then insert the fixture graph, then:
```sql
select plan(9);

select is(
  (select count(*) from public.ancestors_of('00000000-0000-0000-0000-000000000006')), 5::bigint,
  'Shared Kid has 5 ancestors across both lins');

select set_eq(
  $$ select * from public.ancestors_of('00000000-0000-0000-0000-000000000006') $$,
  $$ values ('00000000-0000-0000-0000-000000000004'::uuid), ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000012'),
            ('00000000-0000-0000-0000-000000000011') $$,
  'ancestors of Shared Kid are exactly 04, 02, 01, 12, 11');

select is(
  (select count(*) from public.descendants_of('00000000-0000-0000-0000-000000000001')), 6::bigint,
  'Founder A has 6 descendants (including the hidden one)');

select set_eq(
  $$ select person_id from public.lin_members('00000000-0000-0000-0000-0000000000a1') $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'),
            ('00000000-0000-0000-0000-000000000005'), ('00000000-0000-0000-0000-000000000006') $$,
  'Lin A members exclude the hidden person');

select is(
  (select is_founder from public.lin_members('00000000-0000-0000-0000-0000000000a1')
    where person_id = '00000000-0000-0000-0000-000000000001'), true,
  'founder row is flagged');

select set_eq(
  $$ select person_id from public.lin_members('00000000-0000-0000-0000-0000000000b1') $$,
  $$ values ('00000000-0000-0000-0000-000000000011'::uuid), ('00000000-0000-0000-0000-000000000012'),
            ('00000000-0000-0000-0000-000000000006') $$,
  'Lin B contains the shared descendant');

select set_eq(
  $$ select * from public.lins_of('00000000-0000-0000-0000-000000000006') $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1') $$,
  'Shared Kid belongs to both lins');

-- hidden founder still comes back
update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000011';
select is(
  (select count(*) from public.lin_members('00000000-0000-0000-0000-0000000000b1')
    where person_id = '00000000-0000-0000-0000-000000000011'), 1::bigint,
  'hidden founder is still returned by lin_members');

select throws_ok(
  $$ insert into public.links (big_id, little_id, status)
     values ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'confirmed') $$,
  '23514', 'link would create a cycle', 'descendant cannot become big of an ancestor');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `02_graph.sql` fails because `ancestors_of` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000002_graph.sql`:
```sql
-- Graph traversal over confirmed links, plus cycle prevention.

create or replace function public.ancestors_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  with recursive up as (
    select l.big_id as id
    from public.links l
    where l.little_id = p and l.status = 'confirmed'
    union
    select l.big_id
    from public.links l
    join up on l.little_id = up.id
    where l.status = 'confirmed'
  )
  select id from up;
$$;

create or replace function public.descendants_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  with recursive down as (
    select l.little_id as id
    from public.links l
    where l.big_id = p and l.status = 'confirmed'
    union
    select l.little_id
    from public.links l
    join down on l.big_id = down.id
    where l.status = 'confirmed'
  )
  select id from down;
$$;

-- Founder is always returned (even if hidden) so the UI can draw a placeholder root.
create or replace function public.lin_members(lin uuid)
returns table (person_id uuid, is_founder boolean)
language sql stable
set search_path = public
as $$
  select l.founder_id, true
  from public.lins l
  where l.id = lin
  union
  select d.id, false
  from public.lins l
  cross join lateral public.descendants_of(l.founder_id) as d(id)
  join public.people p on p.id = d.id
  where l.id = lin
    and p.hidden = false
    and p.merged_into is null;
$$;

create or replace function public.lins_of(p uuid)
returns setof uuid
language sql stable
set search_path = public
as $$
  select l.id
  from public.lins l
  where l.founder_id = p
     or l.founder_id in (select public.ancestors_of(p));
$$;

create or replace function public.prevent_link_cycle() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.little_id = new.big_id
     or new.little_id in (select public.ancestors_of(new.big_id)) then
    raise exception 'link would create a cycle' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger links_no_cycle
  before insert or update of big_id, little_id, status on public.links
  for each row execute function public.prevent_link_cycle();
```

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all three files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000002_graph.sql supabase/tests/02_graph.sql
git commit -m "feat(db): ancestry queries, lin membership, cycle prevention"
```

---

### Task 4: Auth helper functions

**Files:**
- Create: `supabase/migrations/20260906000003_auth_helpers.sql`
- Create: `supabase/tests/03_auth_helpers.sql`

**Interfaces:**
- Produces:
  - `public.is_penn_email(email text) returns boolean` — true for `x@upenn.edu` and any subdomain, case-insensitive.
  - `public.current_person_id() returns uuid` — the `person_id` claim from the current JWT, or null.
  - `public.is_admin() returns boolean` — true if `current_person_id()` has a row in `admins`. Security definer so policies can call it without recursion.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/03_auth_helpers.sql`. Begin with the preamble, then:
```sql
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `03_auth_helpers.sql` fails because `is_penn_email` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000003_auth_helpers.sql`:
```sql
-- Helpers used by RLS policies and the auth hook.

create or replace function public.is_penn_email(email text) returns boolean
language sql immutable
as $$
  select lower(email) ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*upenn\.edu$';
$$;

-- The auth hook (Task 7) stamps person_id into the JWT. Null for viewers.
create or replace function public.current_person_id() returns uuid
language sql stable
as $$
  select nullif(nullif(auth.jwt() ->> 'person_id', ''), 'null')::uuid;
$$;

-- security definer so it can read admins regardless of policies on that table.
create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.person_id = public.current_person_id()
  );
$$;

revoke execute on function public.is_admin() from anon;
```

Note on `current_person_id`: with no JWT at all, `auth.jwt()` is SQL null and the whole expression is null. A JSON `null` claim comes back from `->>` as SQL null. The two `nullif` calls guard the remaining odd cases (empty string, literal text `null`) so the cast to uuid never throws.

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000003_auth_helpers.sql supabase/tests/03_auth_helpers.sql
git commit -m "feat(db): is_penn_email, current_person_id, is_admin helpers"
```

---

### Task 5: Row-level security and protected-column guards

**Files:**
- Create: `supabase/migrations/20260906000004_rls.sql`
- Create: `supabase/tests/04_rls.sql`

**Interfaces:**
- Consumes: `public.current_person_id()`, `public.is_admin()` from Task 4.
- Produces: RLS enabled on `people`, `lins`, `links`, `admins` with the policies listed in the spec; trigger functions `public.guard_people_update()` and `public.guard_links_update()` which raise SQLSTATE `42501` when a non-admin touches a protected column, and raise `42501` with message `penn_email is locked after claim` for anyone using the app once a row is claimed.

- [ ] **Step 1: Write the failing RLS test**

Create `supabase/tests/04_rls.sql`. Begin with the preamble, insert the fixture graph, then:
```sql
select plan(31);

-- NOTE: Postgres does not allow UPDATE/DELETE ... RETURNING inside a subquery, so
-- "touched zero rows" is asserted by running the statement and then checking state.

-- ===== viewer (Penn account, no profile) =====
select tests.login(null);
select is((select count(*) from public.people), 8::bigint, 'viewer sees the 8 non-hidden people');
select is((select count(*) from public.people where id = '00000000-0000-0000-0000-000000000007'), 0::bigint, 'viewer cannot see hidden person');
select is((select count(*) from public.lins), 2::bigint, 'viewer sees lins');
select is((select count(*) from public.links), 8::bigint, 'viewer sees all confirmed links');
select throws_ok(
  $$ insert into public.people (display_name, grad_year) values ('Nope', 2030) $$,
  '42501', null, 'viewer cannot insert people');
update public.people set bio = 'x' where id = '00000000-0000-0000-0000-000000000002';
select is((select bio from public.people where id = '00000000-0000-0000-0000-000000000002'), null,
  'viewer update touches no rows');
select tests.logout();

-- ===== member Big One (02) =====
select tests.login('00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ update public.people set bio = 'hello', major = 'CIS' where id = '00000000-0000-0000-0000-000000000002' $$,
  'member edits own bio and major');
select is((select bio from public.people where id = '00000000-0000-0000-0000-000000000002'), 'hello', 'own edit persisted');
update public.people set bio = 'x' where id = '00000000-0000-0000-0000-000000000003';
select is((select bio from public.people where id = '00000000-0000-0000-0000-000000000003'), null,
  'member cannot edit someone else');
select throws_ok(
  $$ update public.people set penn_email = 'other@upenn.edu' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot change own penn_email');
select throws_ok(
  $$ update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot hide self');
select throws_ok(
  $$ insert into public.lins (name, color, founder_id) values ('Lin C', '#000000', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot create lins');
select throws_ok(
  $$ insert into public.admins (person_id) values ('00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot self-promote');

-- member proposes a link where they are the big
select lives_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'pending', '00000000-0000-0000-0000-000000000002') $$,
  'member proposes pending link as big');
select throws_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'confirmed', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot insert a confirmed link');
select throws_ok(
  $$ insert into public.links (big_id, little_id, status, proposed_by)
     values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'pending', '00000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'member cannot propose a link between two other people');
-- proposer cannot accept their own proposal
update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000002'
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005';
select is((select status::text from public.links
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005'), 'pending',
  'proposer cannot confirm own proposal');
select tests.logout();

-- ===== member Big Two (03), not a party to the pending link =====
select tests.login('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.links where status = 'pending'), 0::bigint, 'unrelated member cannot see pending link');
select tests.logout();

-- ===== member Child Two (05), the other party =====
select tests.login('00000000-0000-0000-0000-000000000005');
select is((select count(*) from public.links where status = 'pending'), 1::bigint, 'other party sees the pending link');
select throws_ok(
  $$ update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000005',
       little_id = '00000000-0000-0000-0000-000000000006'
     where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005' $$,
  '42501', null, 'other party cannot rewrite who the link is between');
select lives_ok(
  $$ update public.links set status = 'confirmed', confirmed_by = '00000000-0000-0000-0000-000000000005', confirmed_at = now()
     where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005' $$,
  'other party confirms the link');
select is((select status::text from public.links
  where big_id = '00000000-0000-0000-0000-000000000002' and little_id = '00000000-0000-0000-0000-000000000005'), 'confirmed',
  'link is now confirmed');
-- member removes a confirmed link they are in
delete from public.links
  where big_id = '00000000-0000-0000-0000-000000000003' and little_id = '00000000-0000-0000-0000-000000000005';
select is((select count(*) from public.links
  where big_id = '00000000-0000-0000-0000-000000000003' and little_id = '00000000-0000-0000-0000-000000000005'), 0::bigint,
  'member removes a confirmed link they are part of');
delete from public.links
  where big_id = '00000000-0000-0000-0000-000000000001' and little_id = '00000000-0000-0000-0000-000000000002';
select is((select count(*) from public.links
  where big_id = '00000000-0000-0000-0000-000000000001' and little_id = '00000000-0000-0000-0000-000000000002'), 1::bigint,
  'member cannot remove a link they are not part of');
select tests.logout();

-- ===== admin Founder A (01) =====
select tests.login('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.people), 9::bigint, 'admin sees hidden people too');
select lives_ok(
  $$ insert into public.people (display_name, grad_year, penn_email) values ('New Kid', 2026, 'newkid@upenn.edu') $$,
  'admin creates a person');
select lives_ok(
  $$ update public.people set hidden = true where id = '00000000-0000-0000-0000-000000000005' $$,
  'admin hides a person');
select lives_ok(
  $$ insert into public.links (big_id, little_id, status) values
     ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'confirmed') $$,
  'admin inserts a confirmed link directly');
select lives_ok(
  $$ insert into public.admins (person_id, granted_by) values
     ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001') $$,
  'admin promotes another admin');
select tests.logout();

-- ===== penn_email lock after claim (applies to admins too) =====
update public.people set claimed_at = now(), auth_user_id = gen_random_uuid()
  where id = '00000000-0000-0000-0000-000000000003';
select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.people set penn_email = 'fixed@upenn.edu' where id = '00000000-0000-0000-0000-000000000003' $$,
  '42501', 'penn_email is locked after claim', 'admin cannot change penn_email once claimed');
select lives_ok(
  $$ update public.people set penn_email = 'fixed@upenn.edu' where id = '00000000-0000-0000-0000-000000000004' $$,
  'admin can fix penn_email on an unclaimed profile');
select tests.logout();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `04_rls.sql` fails. The first failing assertion is "viewer cannot insert people" (no RLS yet, so the insert succeeds).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000004_rls.sql`:
```sql
-- Row-level security and protected-column guards.

alter table public.people enable row level security;
alter table public.lins   enable row level security;
alter table public.links  enable row level security;
alter table public.admins enable row level security;

-- ---------- people ----------
create policy people_select on public.people
  for select to authenticated
  using (public.is_admin() or (hidden = false and merged_into is null));

create policy people_insert_admin on public.people
  for insert to authenticated
  with check (public.is_admin());

create policy people_update_admin on public.people
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy people_update_self on public.people
  for update to authenticated
  using (id = public.current_person_id()) with check (id = public.current_person_id());

-- Members may not touch protected columns. penn_email is locked for everyone once claimed.
-- Bypassed when there is no app JWT (postgres, service_role, auth hook).
create or replace function public.guard_people_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if old.claimed_at is not null and new.penn_email is distinct from old.penn_email then
    raise exception 'penn_email is locked after claim' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.penn_email   is distinct from old.penn_email
  or new.hidden       is distinct from old.hidden
  or new.merged_into  is distinct from old.merged_into
  or new.auth_user_id is distinct from old.auth_user_id
  or new.claimed_at   is distinct from old.claimed_at then
    raise exception 'not allowed to change protected fields' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger people_guard_update
  before update on public.people
  for each row execute function public.guard_people_update();

-- ---------- lins ----------
create policy lins_select on public.lins
  for select to authenticated using (true);
create policy lins_insert_admin on public.lins
  for insert to authenticated with check (public.is_admin());
create policy lins_update_admin on public.lins
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lins_delete_admin on public.lins
  for delete to authenticated using (public.is_admin());

-- ---------- links ----------
create policy links_select on public.links
  for select to authenticated
  using (
    status = 'confirmed'
    or public.is_admin()
    or public.current_person_id() in (big_id, little_id, proposed_by)
  );

create policy links_insert_admin on public.links
  for insert to authenticated
  with check (public.is_admin());

create policy links_insert_member on public.links
  for insert to authenticated
  with check (
    status = 'pending'
    and proposed_by = public.current_person_id()
    and public.current_person_id() in (big_id, little_id)
    and confirmed_by is null
    and confirmed_at is null
  );

create policy links_update_admin on public.links
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- The non-proposing party confirms.
create policy links_update_confirm on public.links
  for update to authenticated
  using (
    status = 'pending'
    and public.current_person_id() in (big_id, little_id)
    and proposed_by is distinct from public.current_person_id()
  )
  with check (
    status = 'confirmed'
    and confirmed_by = public.current_person_id()
  );

create policy links_delete on public.links
  for delete to authenticated
  using (public.is_admin() or public.current_person_id() in (big_id, little_id));

-- Non-admins may only flip status/confirmed_by/confirmed_at; never rewrite the parties.
create or replace function public.guard_links_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;
  if new.big_id        is distinct from old.big_id
  or new.little_id     is distinct from old.little_id
  or new.proposed_by   is distinct from old.proposed_by
  or new.academic_year is distinct from old.academic_year
  or new.created_at    is distinct from old.created_at then
    raise exception 'not allowed to change link parties' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger links_guard_update
  before update on public.links
  for each row execute function public.guard_links_update();

-- ---------- admins ----------
create policy admins_select on public.admins
  for select to authenticated using (true);
create policy admins_insert_admin on public.admins
  for insert to authenticated with check (public.is_admin());
create policy admins_delete_admin on public.admins
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all files pass. If "other party cannot rewrite who the link is between" fails with `42501` from a policy rather than the guard, that is still a pass (same SQLSTATE); the assertion does not pin the message.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000004_rls.sql supabase/tests/04_rls.sql
git commit -m "feat(db): row-level security policies and column guards"
```

---

### Task 6: Changelog

**Files:**
- Create: `supabase/migrations/20260906000005_changelog.sql`
- Create: `supabase/tests/05_changelog.sql`

**Interfaces:**
- Consumes: `public.current_person_id()`.
- Produces: table `public.changelog (id bigserial, actor_id uuid, table_name text, row_id uuid, action changelog_action, before jsonb, after jsonb, created_at timestamptz)`; enum `public.changelog_action ('insert','update','delete')`; trigger function `public.log_change()` attached after insert/update/delete on `people`, `lins`, `links`, `admins`. Select allowed for admins only.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/05_changelog.sql`. Begin with the preamble, insert the fixture graph, then:
```sql
select plan(8);

select has_table('public', 'changelog', 'changelog table exists');

-- fixture inserts (as postgres, no JWT) were logged with null actor
select ok((select count(*) from public.changelog where table_name = 'people' and action = 'insert') >= 9,
  'fixture people inserts were logged');
select is((select count(*) from public.changelog where actor_id is not null), 0::bigint,
  'no actor recorded for postgres-run inserts');

-- admin edit is attributed
select tests.login('00000000-0000-0000-0000-000000000001');
update public.people set major = 'Math' where id = '00000000-0000-0000-0000-000000000002';
select is(
  (select actor_id from public.changelog where table_name = 'people' and action = 'update' order by id desc limit 1),
  '00000000-0000-0000-0000-000000000001'::uuid, 'update is attributed to the admin');
select is(
  (select after ->> 'major' from public.changelog where table_name = 'people' and action = 'update' order by id desc limit 1),
  'Math', 'after snapshot has the new value');
select is(
  (select before ->> 'major' from public.changelog where table_name = 'people' and action = 'update' order by id desc limit 1),
  null, 'before snapshot has the old value');
select ok((select count(*) from public.changelog) > 0, 'admin can read the changelog');
select tests.logout();

-- member cannot read it
select tests.login('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.changelog), 0::bigint, 'member sees no changelog rows');
select tests.logout();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `05_changelog.sql` fails on "changelog table exists".

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000005_changelog.sql`:
```sql
-- Append-only audit log populated by triggers.

create type public.changelog_action as enum ('insert', 'update', 'delete');

create table public.changelog (
  id          bigserial primary key,
  actor_id    uuid references public.people(id),
  table_name  text not null,
  row_id      uuid not null,
  action      public.changelog_action not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index changelog_created_idx on public.changelog (created_at desc);

alter table public.changelog enable row level security;
create policy changelog_select_admin on public.changelog
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: only the security-definer trigger writes.

create or replace function public.log_change() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  rid uuid := coalesce(
    (new_j ->> 'id')::uuid, (old_j ->> 'id')::uuid,
    (new_j ->> 'person_id')::uuid, (old_j ->> 'person_id')::uuid);
begin
  insert into public.changelog (actor_id, table_name, row_id, action, before, after)
  values (public.current_person_id(), tg_table_name, rid,
          lower(tg_op)::public.changelog_action, old_j, new_j);
  return coalesce(new, old);
end $$;

create trigger people_log after insert or update or delete on public.people
  for each row execute function public.log_change();
create trigger lins_log after insert or update or delete on public.lins
  for each row execute function public.log_change();
create trigger links_log after insert or update or delete on public.links
  for each row execute function public.log_change();
create trigger admins_log after insert or update or delete on public.admins
  for each row execute function public.log_change();
```

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all files pass. Note that `04_rls.sql` still passes: its `truncate ... cascade` now also clears `changelog` because of the foreign key.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000005_changelog.sql supabase/tests/05_changelog.sql
git commit -m "feat(db): changelog table with audit triggers"
```

---

### Task 7: Custom access token hook (sign-in gate and auto-claim)

**Files:**
- Create: `supabase/migrations/20260906000006_auth_hook.sql`
- Create: `supabase/tests/06_auth_hook.sql`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `public.is_penn_email(text)`.
- Produces: `public.custom_access_token_hook(event jsonb) returns jsonb`. Input shape (from Supabase Auth): `{"user_id": "<uuid>", "claims": {"email": "...", ...}, ...}`. Output: the same event with `claims.person_id` set (uuid string or null), or `{"error": {"http_code": 403, "message": "Please sign in with your Penn Google account."}}` to reject. Side effect: a Penn email matching an unclaimed profile sets that profile's `auth_user_id` and `claimed_at`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/06_auth_hook.sql`. Begin with the preamble, insert the fixture graph, then:
```sql
select plan(11);

select has_function('public', 'custom_access_token_hook', array['jsonb'], 'hook function exists');

-- 1. Penn email matching an unclaimed profile: claims it and stamps person_id
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-000000000002',
     'claims', jsonb_build_object('email', 'Big1@upenn.edu', 'role', 'authenticated')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000002', 'Penn email resolves to matching profile');
select is((select auth_user_id from public.people where id = '00000000-0000-0000-0000-000000000002'),
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'profile is claimed by that auth user');
select isnt((select claimed_at from public.people where id = '00000000-0000-0000-0000-000000000002'),
  null, 'claimed_at is set');

-- 2. Same person signs in again: person_id still present, claim unchanged
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-000000000002',
     'claims', jsonb_build_object('email', 'big1@upenn.edu')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000002', 'repeat sign-in resolves the same profile');

-- 3. Penn email with no profile: allowed as a viewer, person_id is null
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'stranger@upenn.edu')))
   -> 'claims' -> 'person_id'),
  'null'::jsonb, 'unknown Penn email becomes a viewer');
select ok(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'aaaaaaaa-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'stranger@upenn.edu'))) ? 'error') = false,
  'unknown Penn email is not rejected');

-- 4. Personal email on a claimed profile: accepted
update public.people set personal_email = 'bigtwo@gmail.com', claimed_at = now(), auth_user_id = gen_random_uuid()
  where id = '00000000-0000-0000-0000-000000000003';
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-000000000003',
     'claims', jsonb_build_object('email', 'BigTwo@gmail.com')))
   -> 'claims' ->> 'person_id'),
  '00000000-0000-0000-0000-000000000003', 'personal email on claimed profile resolves');

-- 5. Personal email on an UNclaimed profile: rejected
update public.people set personal_email = 'childone@gmail.com' where id = '00000000-0000-0000-0000-000000000004';
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-000000000004',
     'claims', jsonb_build_object('email', 'childone@gmail.com')))
   -> 'error' ->> 'http_code'),
  '403', 'personal email cannot claim');

-- 6. Unknown non-Penn email: rejected
select is(
  (select public.custom_access_token_hook(jsonb_build_object(
     'user_id', 'bbbbbbbb-0000-0000-0000-0000000000ff',
     'claims', jsonb_build_object('email', 'random@gmail.com')))
   -> 'error' ->> 'message'),
  'Please sign in with your Penn Google account.', 'random gmail is rejected with the spec message');

-- 7. App users cannot call the hook
select tests.login('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.custom_access_token_hook('{"user_id":"aaaaaaaa-0000-0000-0000-000000000001","claims":{"email":"foundera@upenn.edu"}}'::jsonb) $$,
  '42501', null, 'authenticated role cannot execute the hook');
select tests.logout();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `06_auth_hook.sql` fails on "hook function exists".

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000006_auth_hook.sql`:
```sql
-- Custom access token hook: gates sign-in and stamps person_id into the JWT.
-- Runs as supabase_auth_admin; security definer so it can read/write people.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid    uuid  := (event ->> 'user_id')::uuid;
  email  text  := lower(coalesce(claims ->> 'email', ''));
  pid    uuid;
  reject constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with your Penn Google account.'));
begin
  if email = '' then
    return reject;
  end if;

  if public.is_penn_email(email) then
    select id into pid
    from public.people
    where penn_email = email and merged_into is null
    limit 1;

    if pid is not null then
      update public.people
      set auth_user_id = uid, claimed_at = now()
      where id = pid and auth_user_id is null;
    end if;
  else
    select id into pid
    from public.people
    where personal_email = email and claimed_at is not null and merged_into is null
    limit 1;

    if pid is null then
      return reject;
    end if;
  end if;

  claims := claims || jsonb_build_object('person_id', pid);
  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
```

- [ ] **Step 4: Enable the hook in local config**

In `supabase/config.toml`, find or add the `[auth.hook.custom_access_token]` section and set:
```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

- [ ] **Step 5: Apply and run the tests**

Run:
```bash
supabase stop
supabase start
supabase db reset
supabase test db
```
Expected: all files pass. (`stop`/`start` is needed once so the auth service picks up the hook config; `db reset` then applies the new migration. Later tasks can use `db reset` alone.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260906000006_auth_hook.sql supabase/tests/06_auth_hook.sql supabase/config.toml
git commit -m "feat(auth): access token hook gates sign-in and auto-claims profiles"
```

---

### Task 8: Photo storage bucket and policies

**Files:**
- Create: `supabase/migrations/20260906000007_storage.sql`
- Create: `supabase/tests/07_storage.sql`

**Interfaces:**
- Consumes: `public.is_admin()`, `public.current_person_id()`.
- Produces: private bucket `photos` (2 MB cap, jpeg/png/webp). Policies on `storage.objects`: any authenticated user reads; a member writes/updates/deletes only objects whose first path segment equals their person id; admins write anywhere. The frontend will store a photo at `<person_id>/avatar.<ext>` and put that path in `people.photo_path`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/07_storage.sql`. Begin with the preamble, insert the fixture graph, then:
```sql
select plan(7);

select is((select count(*) from storage.buckets where id = 'photos'), 1::bigint, 'photos bucket exists');
select is((select public from storage.buckets where id = 'photos'), false, 'photos bucket is private');
select is((select file_size_limit from storage.buckets where id = 'photos'), 2097152::bigint, '2 MB limit');

select tests.login('00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000002/avatar.jpg') $$,
  'member uploads into own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000003/avatar.jpg') $$,
  '42501', null, 'member cannot upload into someone else''s folder');
select is((select count(*) from storage.objects where bucket_id = 'photos'), 1::bigint, 'member can list photos');
select tests.logout();

select tests.login('00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-000000000003/avatar.jpg') $$,
  'admin uploads into any folder');
select tests.logout();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `07_storage.sql` fails on "photos bucket exists".

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000007_storage.sql`:
```sql
-- Private photo bucket. Path convention: <person_id>/avatar.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );

create policy photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );

create policy photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );
```

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000007_storage.sql supabase/tests/07_storage.sql
git commit -m "feat(storage): private photos bucket with per-person write policies"
```

---

### Task 9: Merge duplicates and last-admin guard

**Files:**
- Create: `supabase/migrations/20260906000008_admin_actions.sql`
- Create: `supabase/tests/08_admin_actions.sql`

**Interfaces:**
- Consumes: `public.is_admin()`, cycle trigger from Task 3.
- Produces:
  - `public.merge_people(survivor uuid, duplicate uuid) returns void` — admin only (raises `42501` otherwise). Moves every link from `duplicate` to `survivor`, dropping any that would duplicate an existing pair or self-link; moves lin founderships; copies `penn_email`, `personal_email`, `auth_user_id`, `claimed_at` onto the survivor where the survivor's are null; clears them on the duplicate; sets `duplicate.merged_into = survivor` and `duplicate.hidden = true`; removes the duplicate from `admins`.
  - Trigger `admins_keep_one` on delete from `public.admins`, raising `23514` with message `cannot remove the last admin`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/08_admin_actions.sql`. Begin with the preamble, insert the fixture graph, then:
```sql
select plan(12);

-- a duplicate of Child One (04): a second big (03) and the same little (06)
insert into public.people (id, display_name, grad_year, penn_email) values
  ('00000000-0000-0000-0000-000000000008', 'Child 1 dup', 2022, 'child1dup@upenn.edu');
insert into public.links (big_id, little_id, status) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008', 'confirmed'),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006', 'confirmed');
update public.people set penn_email = null where id = '00000000-0000-0000-0000-000000000004';

-- member cannot merge
select tests.login('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008') $$,
  '42501', null, 'member cannot merge');
select tests.logout();

-- admin merges
select tests.login('00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008') $$,
  'admin merges duplicate into survivor');
select is((select count(*) from public.links where big_id = '00000000-0000-0000-0000-000000000008'
                                               or little_id = '00000000-0000-0000-0000-000000000008'), 0::bigint,
  'no links reference the duplicate');
select is((select count(*) from public.links where little_id = '00000000-0000-0000-0000-000000000004'), 2::bigint,
  'survivor now has both bigs (02 and 03)');
select is((select count(*) from public.links where big_id = '00000000-0000-0000-0000-000000000004'
                                               and little_id = '00000000-0000-0000-0000-000000000006'), 1::bigint,
  'duplicate 04->06 pair collapsed to one link');
select is((select merged_into from public.people where id = '00000000-0000-0000-0000-000000000008'),
  '00000000-0000-0000-0000-000000000004'::uuid, 'duplicate points at survivor');
select is((select hidden from public.people where id = '00000000-0000-0000-0000-000000000008'), true, 'duplicate is hidden');
select is((select penn_email from public.people where id = '00000000-0000-0000-0000-000000000004'),
  'child1dup@upenn.edu', 'survivor inherited the penn_email');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004') $$,
  '22023', null, 'cannot merge a person into themselves');

-- last admin guard
select throws_ok(
  $$ delete from public.admins where person_id = '00000000-0000-0000-0000-000000000001' $$,
  '23514', 'cannot remove the last admin', 'sole admin cannot be removed');
insert into public.admins (person_id, granted_by) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ delete from public.admins where person_id = '00000000-0000-0000-0000-000000000001' $$,
  'admin can be removed once another exists');
select is((select count(*) from public.admins), 1::bigint, 'one admin remains');
select tests.logout();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
supabase test db
```
Expected: `08_admin_actions.sql` fails because `merge_people` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906000008_admin_actions.sql`:
```sql
-- Admin-only actions that need more than a single row write.

create or replace function public.merge_people(survivor uuid, duplicate uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  dup public.people%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if survivor = duplicate then
    raise exception 'cannot merge a person into themselves' using errcode = '22023';
  end if;

  select * into dup from public.people where id = duplicate;
  if not found then
    raise exception 'duplicate person not found' using errcode = '22023';
  end if;

  -- Re-point links where the duplicate is the big.
  update public.links l
  set big_id = survivor
  where l.big_id = duplicate
    and l.little_id <> survivor
    and not exists (select 1 from public.links x where x.big_id = survivor and x.little_id = l.little_id);
  delete from public.links where big_id = duplicate;

  -- Re-point links where the duplicate is the little.
  update public.links l
  set little_id = survivor
  where l.little_id = duplicate
    and l.big_id <> survivor
    and not exists (select 1 from public.links x where x.little_id = survivor and x.big_id = l.big_id);
  delete from public.links where little_id = duplicate;

  update public.lins set founder_id = survivor where founder_id = duplicate;
  delete from public.admins where person_id = duplicate;

  -- Free the unique columns on the duplicate, then let the survivor inherit anything it lacks.
  update public.people
  set penn_email = null, personal_email = null, auth_user_id = null, claimed_at = null,
      merged_into = survivor, hidden = true
  where id = duplicate;

  update public.people s
  set penn_email     = coalesce(s.penn_email,     dup.penn_email),
      personal_email = coalesce(s.personal_email, dup.personal_email),
      auth_user_id   = coalesce(s.auth_user_id,   dup.auth_user_id),
      claimed_at     = coalesce(s.claimed_at,     dup.claimed_at),
      photo_path     = coalesce(s.photo_path,     dup.photo_path),
      major          = coalesce(s.major,          dup.major),
      hometown       = coalesce(s.hometown,       dup.hometown),
      bio            = coalesce(s.bio,            dup.bio),
      instagram      = coalesce(s.instagram,      dup.instagram),
      linkedin       = coalesce(s.linkedin,       dup.linkedin)
  where s.id = survivor;
end $$;

revoke execute on function public.merge_people(uuid, uuid) from anon, public;
grant execute on function public.merge_people(uuid, uuid) to authenticated;

create or replace function public.prevent_last_admin_removal() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (select count(*) from public.admins) <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger admins_keep_one
  before delete on public.admins
  for each row execute function public.prevent_last_admin_removal();
```

Note: the `delete from public.admins where person_id = duplicate` inside `merge_people` will raise if the duplicate is the sole admin. That is correct behavior: promote someone else first.

- [ ] **Step 4: Apply and run the tests**

Run:
```bash
supabase db reset
supabase test db
```
Expected: all files pass. If "survivor inherited the penn_email" fails with `penn_email is locked after claim`, the survivor row had `claimed_at` set by an earlier step in the test; it does not in this fixture, so investigate the guard rather than the test.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906000008_admin_actions.sql supabase/tests/08_admin_actions.sql
git commit -m "feat(db): merge_people and last-admin guard"
```

---

### Task 10: Seed data, end-to-end sign-in check, and backend README

**Files:**
- Create: `supabase/seed.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Produces: a local dev dataset with two lins and a dev login (`alice@upenn.edu` / `password123`, who is an admin) so the frontend plan can start immediately. Also documents the production setup for a future maintainer.

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql`:
```sql
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
```

- [ ] **Step 2: Reset and confirm the seed loads and tests still pass**

Run:
```bash
supabase db reset
supabase test db
```
Expected: reset prints `Seeding data from supabase/seed.sql...` with no error. All tests pass (each test file truncates the seeded tables inside its own rolled-back transaction).

- [ ] **Step 3: Verify the hook end to end through the real auth service**

Run (the anon key is printed by `supabase status`):
```bash
ANON=$(supabase status -o env | grep ANON_KEY | cut -d= -f2 | tr -d '"')
curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"alice@upenn.edu","password":"password123"}' \
  | python3 -c 'import sys,json,base64; t=json.load(sys.stdin)["access_token"].split(".")[1]; t+="="*(-len(t)%4); print(json.loads(base64.urlsafe_b64decode(t))["person_id"])'
```
Expected output: `10000000-0000-0000-0000-000000000001`

Then confirm the claim landed:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -tAc \
  "select auth_user_id, claimed_at is not null from public.people where penn_email = 'alice@upenn.edu'"
```
Expected: `a0000000-0000-0000-0000-000000000001|t`

If the curl returns an error mentioning the hook, run `supabase stop && supabase start` so the auth service reloads `config.toml`, then retry.

- [ ] **Step 4: Write the backend README**

Create `supabase/README.md`:
```markdown
# CSA Lin Tree — Backend

Everything server-side is Supabase: Postgres tables, row-level security, a few
SQL functions, an auth hook, and a storage bucket. There is no custom server.

## Local development

Prerequisites: Docker Desktop running, Supabase CLI 2.67+ (`brew install supabase/tap/supabase`).

```bash
supabase start        # boots Postgres, Auth, Storage, Studio on localhost
supabase db reset     # applies supabase/migrations/* then supabase/seed.sql
supabase test db      # runs the pgTAP tests in supabase/tests/
supabase stop
```

Studio (a web UI for the database) is at http://127.0.0.1:54323.

Dev logins (email/password, local only):
- alice@upenn.edu / password123 — admin
- bob@upenn.edu / password123 — member

## How the pieces fit

| Migration | What it adds |
|---|---|
| `..._schema.sql` | `people`, `lins`, `links`, `admins` tables |
| `..._graph.sql` | `ancestors_of`, `descendants_of`, `lin_members`, `lins_of`; cycle-prevention trigger |
| `..._auth_helpers.sql` | `is_penn_email`, `current_person_id`, `is_admin` |
| `..._rls.sql` | every access rule; guards for protected columns |
| `..._changelog.sql` | audit table filled by triggers |
| `..._auth_hook.sql` | `custom_access_token_hook`: rejects non-Penn accounts, auto-claims profiles, adds `person_id` to the JWT |
| `..._storage.sql` | private `photos` bucket, per-person write access |
| `..._admin_actions.sql` | `merge_people`, last-admin guard |

Key idea: the JWT carries `person_id`. Every "can this user edit that row" rule
compares against it. Admin status is a row in `admins`, checked live.

## Adding a migration

```bash
supabase migration new describe_the_change
# edit the new file in supabase/migrations/
supabase db reset && supabase test db
```

Write a pgTAP test in `supabase/tests/` for any new rule. Copy the preamble
(`tests.login` / `tests.logout`) from an existing test file.

## Production setup (one time)

1. Create a project at https://supabase.com (free tier). Note the project ref.
2. Authentication → Providers → Google: enable it and paste a Google OAuth
   client id/secret (create one in Google Cloud Console; authorized redirect
   URI is `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Authentication → Providers → Email: disable sign-ups (Google only in prod).
4. Authentication → Hooks: enable "Customize Access Token (JWT) Claims" and pick
   `public.custom_access_token_hook`. (Run migrations first so it exists.)
5. Push the schema:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
6. Make the first admin. In Studio → SQL editor:
   ```sql
   insert into public.people (display_name, grad_year, penn_email)
   values ('Your Name', 2026, 'you@upenn.edu') returning id;
   insert into public.admins (person_id) values ('<that id>');
   ```
   Then sign in with that Penn Google account; the hook claims the profile.

Do not run `supabase/seed.sql` in production. `db push` does not run it.

## Gotchas

- Free-tier projects pause after ~1 week idle. They resume on first request.
- If Google sign-in starts failing after a config change, re-check step 4; a
  disabled hook means nobody gets a `person_id` and everyone is a viewer.
- Changing a claimed person's Penn email is blocked by design. Set a personal
  email instead.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql supabase/README.md
git commit -m "chore(db): dev seed with local logins and backend README"
```

---

## Self-review against the spec

- **Section 4 auth rules** → Task 7 (hook) and Task 4 (`is_penn_email`). Personal-email-cannot-claim is tested.
- **Section 5 tables and constraints** → Task 2. Cycle trigger → Task 3. Changelog → Task 6.
- **Section 5 derived queries** → Task 3 (`ancestors_of`, `descendants_of`, `lin_members`, `lins_of`). Hidden founder placeholder behavior is tested.
- **Section 6 RLS, every bullet** → Task 5; storage bullet → Task 8. The 2 MB cap and mime list are on the bucket row.
- **Section 7 admin actions needing SQL** (merge, last-admin guard) → Task 9. Hide, CSV bulk add, promote/demote are plain row writes covered by Task 5 policies; their UI is in the frontend plan.
- **Section 9 edge cases**: cycle (Task 3), duplicate merge (Task 9), email typo fix on unclaimed only (Task 5), non-Penn rejection (Task 7), hidden founder (Task 3). Duplicate link request is a unique constraint (Task 2); the "show the existing one" UX is frontend.
- **Section 11 handoff README** → Task 10.
- **Section 12 tests**: RLS per role (Task 5), graph fixture with two-big person and shared descendant (Task 3), auth hook cases (Task 7). Component tests belong to the frontend plan.

Name consistency check: `current_person_id`, `is_admin`, `is_penn_email`, `ancestors_of`, `descendants_of`, `lin_members`, `lins_of`, `merge_people`, `custom_access_token_hook` are spelled identically in every task and in the README table.

Not in this plan (deliberately): the Next.js app, TypeScript type generation, and Vercel deployment. Those are the frontend plan, written after this backend exists.
