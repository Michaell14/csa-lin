# Auth, email delivery, and deployment setup

This is the handoff guide for recreating a CSA Lins deployment. It records the
settings that live **outside Git** as well as the code that depends on them.
Each Supabase project has its own database, Auth settings, users, and SMTP
configuration. Each Vercel project has its own environment variables and
domains. A Git push or Vercel deployment does **not** configure Supabase Auth,
Resend, Google, or DNS.

## What signs people in

| Person | UI path | Server-side rule |
| --- | --- | --- |
| Penn Google account (`@upenn.edu` or a subdomain such as `@sas.upenn.edu`) | Sign in with Penn Google | A verified Penn email may sign in. If `people.penn_email` matches, the access-token hook claims that profile; otherwise the person is a signed-in viewer without a profile. |
| Nursing mailbox (`@nursing.upenn.edu`) | Email code link under the Google button | Supabase Email OTP sends a six-digit code. The before-user-created hook permits an Email-provider account only for this exact domain; the access-token hook checks the verified email again at sign-in. A profile is optional for signing in, but its `penn_email` must match to claim it. |
| Personal email after graduation | Google sign-in | Only a **previously claimed** profile with that exact `personal_email` may use it. The account is bound to `personal_auth_user_id` on first use. Typing a personal email into the profile does not turn on email-code sign-in for it. |

The app has no Microsoft/Outlook OAuth integration. Nursing students read the
code in Outlook but authenticate with Supabase Email OTP. The browser checks
the Nursing domain for a useful error; the database hooks enforce it even for
direct API calls. The local password form is development-only and relies on a
server-controlled flag on the seeded Auth users. See
[`NursingEmailSignIn.tsx`](../web/src/components/landing/NursingEmailSignIn.tsx),
[`custom_access_token_hook`](../supabase/migrations/20260917000008_email_code_sign_in.sql),
and [`before_user_created_nursing_email`](../supabase/migrations/20260917000009_nursing_email_signups.sql).

## Values to collect and who owns them

| Value | Where to find/create it | Where it goes |
| --- | --- | --- |
| Supabase project ref and project URL | Supabase project dashboard / Settings | CLI linking, Google callback, Vercel `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase publishable/anon key | Supabase Settings → API Keys | Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Google OAuth web client ID and secret | Google Cloud / Google Auth Platform → Clients | Supabase Google provider settings; **not** Vercel |
| Resend verified sending domain | Resend → Domains | DNS records at the authoritative DNS host; Supabase SMTP sender address must be under this domain |
| Resend API key | Resend → API Keys | Supabase custom SMTP **password**; never commit it |
| Vercel domain target | Vercel project → Domains | The website's DNS CNAME |

The browser may receive the Supabase project URL and publishable/anon key.
Never put the Supabase secret/service-role key, the Google client secret, or a
Resend API key in a `NEXT_PUBLIC_` variable or in Git. A fresh Supabase
project needs a fresh set of dashboard settings even when it uses the same
repository and Google/Resend accounts.

## Bring up a hosted project

1. **Database.** Create a Supabase project. From this repository, sign into
   the CLI, link the **intended** project, and inspect pending migrations
   before pushing them:

   ```bash
   supabase login
   supabase link --project-ref <PROJECT_REF>
   supabase migration list --linked
   supabase db push --linked --dry-run --skip-vault
   supabase db push --linked --skip-vault
   ```

   `--skip-vault` keeps this schema operation from updating Vault secrets.
   Repeat separately for each hosted Supabase project. Never run
   `supabase/seed.sql` on a hosted project. The migrations create the Postgres
   hook functions; they do **not** enable those hooks in hosted Auth settings.
   For an existing deployment, let the updated Vercel app deploy before
   applying a migration that drops columns queried by the old app.

2. **Vercel.** Import the GitHub repository into Vercel and set Root Directory
   to `web` (the repository root will deploy a 404). Set
   `NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co` and that
   project's `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do not set
   `NEXT_PUBLIC_DEV_LOGIN` in production. Leave
   `NEXT_PUBLIC_NURSING_EMAIL_LOGIN_ENABLED` unset or `false` until email
   delivery and the two Auth hooks below pass a real test; then set it to
   `true` and redeploy. This flag is a UI rollout switch, not a security rule.

3. **Site domain and redirects.** In Vercel add `lins.upenncsa.com` to the
   project. Put the **exact** CNAME name/target Vercel displays into the
   authoritative DNS zone for `upenncsa.com`; the target is Vercel-specific
   and can change. Vercel should report a valid configuration. In Supabase
   Authentication → URL Configuration, set Site URL to
   `https://lins.upenncsa.com` and allow
   `https://lins.upenncsa.com/auth/callback` under Redirect URLs. If the
   `*.vercel.app` address should also work, add its exact `/auth/callback`
   URL too. The app sends `window.location.origin + '/auth/callback'` to
   Supabase; changing Site URL does not by itself disable an allowed Vercel
   address. Add `http://localhost:3000/auth/callback` only if you will test
   hosted Google Auth from a local web server.

4. **Google.** Create a Google OAuth client of type **Web application** in
   Google Auth Platform. Use only the `openid`, `userinfo.email`, and
   `userinfo.profile` sign-in scopes. Add the app origins you use (for example,
   `https://lins.upenncsa.com` and the Vercel origin) as Authorized JavaScript
   origins. The Authorized redirect URI is the **Supabase** callback,
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`, **not** the Vercel or
   Penn domain callback. Each separate Supabase project needs its own callback
   URI on the Google client, or a separate Google client. Put the client ID
   and secret in Supabase Authentication → Providers → Google and enable the
   provider. Ensure the Google consent app's audience/publishing state allows
   the Penn accounts you intend to test; an app still in testing may require
   explicit test users.

5. **Auth hooks.** In Supabase Authentication → Hooks, enable both Postgres
   hooks after the migrations are present:

   - **Customize Access Token (JWT) Claims** →
     `public.custom_access_token_hook`. It verifies the email against
     `auth.users`, checks that it is confirmed, claims matching profiles,
     rejects disallowed email methods, and adds `person_id` to the JWT.
   - **Before User Created** → `public.before_user_created_nursing_email`.
     It blocks new non-Nursing Email-provider users while leaving Google
     account creation possible.

   The functions' execute grants for `supabase_auth_admin` are in the
   migrations. If the access-token hook is missing or disabled, people may
   authenticate but appear as profileless viewers. Penn domain matching also
   accepts school subdomains such as `engineering.upenn.edu` through
   `public.is_penn_email`; the Nursing **email-code** path is intentionally
   narrower and accepts only `@nursing.upenn.edu`.

6. **First admin and existing people.** Add a `people` row with the admin's
   exact lowercase Penn email, then add that person's ID to `public.admins`.
   The SQL and two-step explanation are in
   [`supabase/README.md`](../supabase/README.md#production-setup-one-time).
   When the admin signs in with that address, the access-token hook claims
   the row. Creating an Auth user alone does not create a `people` row or
   grant admin access. If a matching person row already exists, use its ID
   instead of inserting a duplicate.

## Resend: domain, DNS, and SMTP

Resend is an **outbound mail sender** for Supabase Auth, not an identity
provider and not the site host. The setup used a sending subdomain such as
`auth.upenncsa.com`; `lins.upenncsa.com` is the website. Verify the actual
configured domain in Resend before copying settings to another account.

1. In Resend → Domains, add and verify the sending subdomain. Resend shows
   the DNS records required for that specific domain and region. Copy the
   **full, untruncated** record names and values from Resend. The usual set
   includes a DKIM TXT record and sending/SPF records (which may be CNAMEs);
   use the types Resend shows rather than guessing from an old screenshot.
   DMARC may be shown separately and is optional for initial verification.
   The Resend sending records are different from the Vercel `lins` CNAME.

2. Add those records at whichever provider is actually authoritative for
   `upenncsa.com`. In the A2 Hosting/cPanel setup we used **Zone Editor →
   Manage** for `upenncsa.com`. Each row asks for **Name**, **TTL**, **Type**,
   and **Record**: Name is the record's host, TTL can be the offered default,
   Type must match Resend (`TXT` or `CNAME`), and Record is the exact Resend
   content/target. cPanel can append `upenncsa.com` to a short name; check the
   saved row to ensure, for example, `send.auth.upenncsa.com` did not become
   `send.auth.upenncsa.com.upenncsa.com`. A fully qualified name ending in a
   dot is another way to make the intended host explicit if cPanel accepts it.
   Do not replace the root domain's existing MX or website records to set up
   **outbound** Resend mail. If Resend cannot verify after DNS propagation,
   check the domain's nameservers: edits in A2 matter only if A2 hosts the
   authoritative zone. Then use Resend's verification/check action.

3. Create a Resend API key with permission to send from the verified domain.
   In **each** Supabase project's Authentication → Emails → SMTP Settings,
   enable custom SMTP and enter:

   | Supabase SMTP field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` (implicit TLS) or `587` (STARTTLS); use the one accepted by the dashboard and network |
   | Username | `resend` |
   | Password | The Resend API key, not the Resend account password |
   | Sender email / From | An address at the verified sending subdomain, for example `no-reply@auth.upenncsa.com` |
   | Sender name | `CSA Lins` |

   Supabase's default sender is for limited testing and may send only to
   project-team addresses; regular Nursing students need working custom
   SMTP. The Resend SMTP key remains in Supabase, not Vercel. If the key is
   rotated, update every Supabase project that uses it.

## Supabase Email OTP settings and templates

In each hosted project's Authentication → Providers/Sign In → Email, enable
Email sign-ups and **keep Confirm email enabled**. The access-token hook
requires a confirmed `auth.users` email; disabling confirmation breaks the
security assumption. Set the Email OTP length to **6 digits**. The local
`supabase/config.toml` uses `otp_length = 6` and `otp_expiry = 3600`, but
hosted dashboard settings are independent. Check the hosted OTP expiry and
email rate limit there rather than assuming the local values were deployed.
The OTP expiry is about how long an **unused code** works. It is not the
session lifetime; Supabase refreshes sessions separately after sign-in.

In Authentication → Email Templates, set **both** `Confirm sign up` (new
Email-provider user) and `Magic Link`/OTP (returning user) to the contents of
[`supabase/templates/sign_in_code.html`](../supabase/templates/sign_in_code.html).
Use a subject such as **Your CSA Lins sign-in code**. The important variable
is `{{ .Token }}`: this app expects a six-digit code typed into its form. A
template with only `{{ .ConfirmationURL }}` sends a link but gives the user no
code to enter. The web app calls `signInWithOtp` and then `verifyOtp` with
`type: 'email'`; a successful verification creates the session. Its resend
button waits 60 seconds, and Supabase may impose its own send limit.

The repository's `supabase/config.toml` and HTML template configure the
**local** stack only. Local messages appear in Mailpit (`supabase status`
prints its URL), with no Resend account required. Do not run
`supabase config push` from this repo: local Auth settings and seeded dev
password accounts are not the desired hosted configuration. Copy the above
dashboard values to each hosted project instead.

## Prove the setup before enabling the Nursing link

1. On the production domain, sign in through Google with a Penn account
   whose profile exists, and with a Penn account without a profile. The latter
   should be a signed-in viewer, not a failed login.
2. Request a code for a **new** `@nursing.upenn.edu` mailbox and a **returning**
   one. Confirm both the `Confirm sign up` and `Magic Link` templates contain
   a visible six-digit code; enter it on the page. The mailbox can be in
   Outlook. Test with a recipient who is not merely a Supabase project-team
   member, so the default sender cannot mask missing SMTP setup.
3. Check that a Nursing account whose mailbox matches `people.penn_email`
   gets its profile, while one without a person row signs in as a viewer.
   A non-Nursing address must not be able to create an Email-provider account
   or get a usable email-code session. Google remains the path for other
   Penn schools.
4. Test the exact domain users will visit. If also supporting the Vercel URL,
   test it separately; both callback URLs must be allow-listed in that
   Supabase project. Inspect Supabase Auth logs and Resend's sent-email list
   if delivery or verification fails.

Common failure clues: `Unsupported provider` means Google is not enabled in
that Supabase project; `Email address not authorized` often means custom SMTP
is not active; a code email containing only a link means one of the two
templates was missed; `redirect_to is not allowed` means the exact app
`/auth/callback` URL is absent from Supabase's Redirect URLs; and a successful
login without the expected profile points to a missing hook, a Penn email
mismatch, or an existing profile binding to a different Auth user.

## When moving or updating the deployment

Merging to GitHub/Vercel updates the web app, **not** the hosted database or
dashboard Auth configuration. For each Supabase project, pull the merged
repository, link its project ref, review `supabase db push --linked --dry-run
--skip-vault`, and then run the corresponding push. New migrations are
applied once per project. When moving ownership, recreate or transfer the
Vercel project, Supabase project/data, Google OAuth credentials, Resend
account/domain verification, and DNS access as needed; none of those secrets
or dashboard toggles are stored in this repository.

Official references: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[Supabase Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks),
[Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Resend verified domains](https://resend.com/docs/dashboard/domains/introduction),
[Resend SMTP](https://resend.com/docs/send-with-smtp), and
[cPanel Zone Editor](https://docs.cpanel.net/cpanel/domains/zone-editor/122/).
