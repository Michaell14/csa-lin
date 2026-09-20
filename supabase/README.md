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

The web app lives in `../web`; see `web/README.md` to run it against this stack.

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
| `..._admin_actions.sql` | historical merge function (removed in `..._remove_merge_people.sql`), last-admin guard |
| `..._review_fixes.sql` | `lin_graph` (one-call lin nodes+edges for the UI); historical merge and cycle-check hardening |
| `..._column_privacy.sql` | column-level SELECT grant on `people`; `people_with_contact` view for the email/auth columns |
| `..._auth_hook_confirmed_email.sql` | the hook also requires a confirmed `auth.users` email that matches the claim |
| `..._profile_field_checks.sql` | shape and length checks on instagram, linkedin, name, major, hometown, bio |
| `..._photo_policies.sql` | `photo_path` must be `<own id>/avatar.<ext>`; photo reads limited to visible people; writes limited to that one object |
| `..._personal_email_binding.sql` | `people.personal_auth_user_id`: the personal-email sign-in is bound on first use and must match after |
| `..._email_code_sign_in.sql` | permits Email-provider sign-in only for `@nursing.upenn.edu` while preserving Google sign-in for everyone else |
| `..._nursing_email_signups.sql` | blocks creation of non-Nursing Email-provider users; Google signups remain allowed |
| `..._member_lins.sql` | `links_found_lin`: a link becoming confirmed founds a lin at the top of its chain (or hands the little's lin up to it); founders may rename and recolour their own lin |
| `..._remove_link_academic_year.sql` | removes the unused link academic-year column and its graph output |
| `..._lin_member_counts.sql` | returns every lin's member count in one sidebar request |
| `..._corrections_shared_lin.sql` | limits profile and relationship corrections to people sharing a lin with the submitter |
| `..._remove_milestones.sql` | deletes milestone records and their changelog entries, then drops the feature table |
| `..._link_removal_notification_kinds.sql` / `..._link_removal_requests.sql` | member removal requests, admin review, notifications, and confirmed-link deletion policy |
| `..._hidden_graph_placeholders.sql` | preserves links through hidden members while masking their profiles and class years |
| `..._withdraw_link_removal_requests.sql` | lets the requester withdraw a pending link removal request before admin review |
| `..._reconcile_nested_lins.sql` | keeps one lin per founder and absorbs lins nested on the same big/little path |
| `..._found_lin_after_link_removal.sql` | founds a lin for the little when removing a confirmed link leaves them without one |
| `..._simplify_profiles.sql` | drops unused profile fields and rebuilds the privacy views without them |
| `..._remove_merge_people.sql` / `..._drop_merged_into.sql` | removes the merge RPC and its unused profile column, updating graph, auth, storage, and privacy rules |

Key idea: the JWT carries `person_id`. Every "can this user edit that row" rule
compares against it. Admin status is a row in `admins`, checked live.

Lins are normally founded when a link is confirmed. When the big is not in a lin yet, the `links_found_lin`
trigger inserts one founded by the person at the top of the big's chain, named
`<display name>'s Lin` (numbered if taken) in the least-used palette colour. A
lin the little had founded is handed up to that top instead of being nested in
a new one. The founder can change the name and colour; admins can also create
a lin manually, change its founder, or delete it. Removing a confirmed link
automatically founds a new lin for the little if they have no other path into a
lin; manual creation remains available for other exceptions.

Contact columns (`penn_email`, `personal_email`, `auth_user_id`) are not
selectable on `people` at all, by anyone. Read them from the
`people_with_contact` view: a member gets their own row, an admin gets every
row. Writes still go to `people`.

Frontend contract for drawing a lin: call `select public.lin_graph('<lin id>')`.
It returns `{"people": [...], "links": [...]}` with hidden members represented
as anonymous placeholders (including a hidden founder). Their class years and
profile fields are masked, but their confirmed links remain so descendants stay
connected. Every edge connects two returned nodes. Pending link requests are
not in it; read those from `links` directly (RLS shows you only your own).

## Adding a migration

```bash
supabase migration new describe_the_change
# edit the new file in supabase/migrations/
supabase db reset && supabase test db
```

Write a pgTAP test in `supabase/tests/` for any new rule. Copy the preamble
(`tests.login` / `tests.logout`) from an existing test file.

## Production setup (one time)

For the complete hosted Google, Nursing OTP, Resend, DNS, and redirect setup,
including settings that migrations do not deploy, see
[`docs/auth-email-deployment.md`](../docs/auth-email-deployment.md).

1. Create a project at https://supabase.com (free tier). Note the project ref.
2. Push the schema:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. Authentication → Providers → Google: enable it and paste a Google OAuth
   client id/secret (create one in Google Cloud Console; authorized redirect
   URI is `https://<project-ref>.supabase.co/auth/v1/callback`).
4. For Nursing email-code sign-in, enable Email sign-ups in Authentication →
   Sign In / Providers → Email and **keep email confirmation enabled**. Configure
   a custom SMTP sender in Authentication → Emails → SMTP Settings; Supabase's
   built-in mail sender cannot deliver production codes to ordinary members.
   In Authentication → Email Templates, set both **Magic Link** (returning users)
   and **Confirm sign up** (first-time users) to the contents of
   `supabase/templates/sign_in_code.html`. Both must contain `{{ .Token }}`
   instead of a confirmation link, or the page's code field will have no code
   to enter. Use "Your CSA Lins sign-in code" as the subject. The local stack
   uses that template automatically and delivers to Mailpit (`supabase status`).
   Test both a new and a returning `@nursing.upenn.edu` address before announcing
   this flow. The app and access-token hook reject other email-code/password
   sign-ins; other Penn addresses continue to use Google. A Nursing member's
   `people.penn_email` must exactly match their Nursing mailbox to claim a profile.
   The local seed's password users have a server-controlled development flag;
   do not copy seeded auth users to production.
5. Authentication → Hooks: enable "Customize Access Token (JWT) Claims" and pick
   `public.custom_access_token_hook`. Enable "Before User Created" and pick
   `public.before_user_created_nursing_email` as well. Both exist because step 2
   pushed the migrations. The latter prevents non-Nursing email accounts from
   being created even through direct API calls.
6. Make the first admin. In Studio → SQL editor:
   ```sql
   insert into public.people (display_name, grad_year, penn_email)
   values ('Your Name', 2026, 'you@upenn.edu') returning id;
   insert into public.admins (person_id) values ('<that id>');
   ```
   `returning id` prints the new person's uuid (one row, one column); paste that
   uuid in place of `<that id>`. Or do both in one statement:
   ```sql
   with me as (
     insert into public.people (display_name, grad_year, penn_email)
     values ('Your Name', 2026, 'you@upenn.edu')
     returning id
   )
   insert into public.admins (person_id) select id from me;
   ```
   Use the lowercase Penn address you will sign in with; the auth hook
   matches on it to claim the profile.
   Then sign in with that Penn account; the hook claims the profile.

Do not run `supabase/seed.sql` in production. `db push` does not run it.

## Gotchas

- Free-tier projects pause after ~1 week idle. They resume on first request.
- If sign-in starts failing after a config change, re-check step 5; a
  disabled hook means nobody gets a `person_id` and everyone is a viewer.
- Changing a claimed person's Penn email is blocked by design. Set a personal
  email instead.
- Normally nobody needs to create lins. A confirmed link founds one automatically;
  the admin Lins tab can create one manually for a disconnected branch, as well
  as correct names, colours and founders, or delete one. Lins
  from before `..._member_lins.sql` keep their founders; a new confirmed link
  under a chain that has no lin founds it at the chain's top, not at whoever
  confirmed. `lin_palette()` in that migration mirrors `PALETTE` in
  `web/src/lib/graph/colors.ts`; a web test fails if the two drift.
- `supabase/config.toml` is local-only: it enables Email sign-ups with
  confirmation, and the seeded dev users are already confirmed. Never run
  `supabase config push`; production auth settings live in the dashboard.
- The `service_role` key bypasses every policy and every guard trigger. It must
  never be shipped to a browser or committed. The frontend uses the `anon` key
  plus the signed-in user's JWT.
- If `supabase db push` fails on `..._storage.sql` with
  `42501: must be owner of table objects`, run that one file from the dashboard
  SQL editor; the storage tables are owned by a different role on hosted projects.
- `authenticated` holds a column-list SELECT grant on `people`, not a table
  grant. When you add a non-sensitive column to `people`, add it to the grant in
  `..._column_privacy.sql` (a new migration) or the app gets
  `permission denied for table people` when it selects it. `select('*')` on
  `people` no longer works for anyone; use `people_with_contact` where the
  email/auth columns are wanted. Since `..._profile_privacy.sql` the grant no
  longer covers the profile columns either (major, hometown, bio,
  instagram, linkedin); read those through
  `people_public`. A PostgREST embed such as `people!<fk>(...)` reads the
  table, not the view, so it must name only granted columns too.
- `people_with_contact` and `people_public` are `select p.*`-style views, and a
  view freezes its column list at creation: the `*` is expanded once and never
  revisited. So any migration that adds a column to `people` must also
  `create or replace` every such view (see
  `..._contact_view_all_columns.sql`), or the column is silently missing from
  the view and the app reads `undefined` through it. `..._profile_privacy.sql`
  added the `show_*` privacy columns without recreating `people_with_contact`,
  which is exactly how the profile editor's privacy toggles came back blank.
  After changing a view, run `npm run gen:types` in `web/`.
- If opening a profile shows `Could not find the table 'public.people_public'
  in the schema cache`, the database the app points at has not had
  `..._profile_privacy.sql` applied. That migration creates the `people_public`
  view every profile read goes through, and PostgREST reports a relation it
  cannot find as a schema-cache miss. Compare local and remote with
  `supabase migration list`, then `supabase db push` (hosted project) or
  `supabase db reset` (a local stack started before the migration existed).
  If the view exists and the error persists, reload the cache from the SQL
  editor: `notify pgrst, 'reload schema';`.
- The auth hook refuses any sign-in whose `auth.users` email is unconfirmed or
  differs from the token's email claim. Google sign-ins arrive confirmed. If
  email/password sign-up is ever enabled in the dashboard, leave "Confirm email"
  on; the hook will reject unconfirmed accounts either way.
- The hook also refuses to issue a `person_id` for a profile whose
  `auth_user_id` is some other Auth user, so an account deleted and recreated
  under the same Penn address cannot inherit the old one's profile. The person
  is locked out until an admin clears the stale binding:
  `update public.people set auth_user_id = null, claimed_at = null where id = '<person id>';`
- Signing in with a personal address works the same way against
  `personal_auth_user_id`, which is a second column because the personal Google
  account is a different `auth.users` row from the Penn one. The first sign-in
  on the address takes the binding; clear it the same way
  (`set personal_auth_user_id = null`) when the mailbox legitimately changes
  hands. Neither column is readable by members: they live behind
  `people_with_contact`.
- A person's photo is exactly one object, `<person id>/avatar.<jpg|jpeg|png|webp>`.
  Both the storage policies and a check constraint on `people.photo_path`
  enforce it, and the app re-encodes uploads client-side so camera metadata
  (including GPS) never reaches the bucket. Non-admins can read photos only of
  people they can see; hidden and merged people's photos are admin-only.
- Profile merging is no longer available to admins or callable through the
  database API. Its unused `merged_into` column has been removed.

### Lin memories

`20260920000001_lin_memories.sql` adds a private `lin-memories` bucket and
member-only posts for the Memories view. Apply this migration before using the
view. Signed-in users can read public memories. Authors can mark a post as
lin-only, in which case only members of that lin and admins can read it. Lin
members and admins can upload; authors and admins can delete.
Posting dates are assigned by the database. Photos are re-encoded without EXIF
at up to 2560px; MP4/WebM videos are stored as uploaded. Each post holds one
photo or video, with a 50 MB upload limit and an optional 2,000-character caption.
The timeline loads 20 posts at a time and uses one-hour signed media URLs.
Run `supabase test db` for the membership and storage policy regression tests.
