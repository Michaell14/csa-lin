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
