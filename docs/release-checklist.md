# Release checklist

## Before merging

- Confirm every PR in the Graphite stack is approved and CI is green.
- Review new migrations in order and verify generated database types are current.
- Run `npm audit` and assess any production-impacting advisories; do not apply forced upgrades without reviewing breaking changes.
- Test the member and admin journeys locally with a clean `supabase db reset`.

## Supabase production

- Take a database backup and record the restore point.
- Link the intended project and inspect `supabase db push --dry-run` before applying migrations.
- Run `supabase db push`; never run `supabase/seed.sql` in production.
- Confirm Google auth, both Auth hooks, confirmed Email sign-ups for Nursing
  codes, custom SMTP, both code templates, and allowed redirect URLs. See
  [auth and email deployment](auth-email-deployment.md).
- Confirm the `photos` bucket remains private and that no service-role key is exposed to Vercel.
- Create or verify at least two admins so the organization is not dependent on one account.

## Vercel

- Set the root directory to `web`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; do not set `NEXT_PUBLIC_DEV_LOGIN`.
- Deploy a preview and test sign-in, lin switching, search, profile privacy, link requests, reports, notifications, PNG export, and the admin queue.
- Verify the mobile layout and keyboard-only navigation.

## After release

- Run a production smoke test with both a member and an admin Penn account.
- Check browser console errors, Supabase logs, failed auth events, and Vercel function/build logs.
- Verify hidden profiles and private fields are not returned by network responses.
- Record the deployed commit and migration version, then announce the release and rollback owner.
