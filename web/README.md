# CSA Lin Tree — Web app

Next.js app for browsing and maintaining the lin trees. All data access goes
straight to Supabase from the browser with the anon key; the database's
row-level security decides what each signed-in person may read or write.

## Run locally

1. Start the backend from the repo root: `supabase start && supabase db reset`
   (seeds two lins and two dev logins).
2. `cd web && cp .env.example .env.local`, then paste the `ANON_KEY` printed
   by `supabase status` into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`, open http://localhost:3000.
4. Sign in with the dev form: `alice@upenn.edu` / `password123` (admin) or
   `bob@upenn.edu` / `password123` (member). The dev form only appears when
   `NEXT_PUBLIC_DEV_LOGIN=true`.

Commands: `npm test` (Vitest), `npm run test:e2e` (Playwright; requires the
local Supabase stack), `npm run lint`, `npm run build`,
`npm run gen:types` (regenerate `src/lib/database.types.ts` after a migration).

Pull requests run unit tests, lint, a production build, database tests, and the
desktop/mobile student journeys in `.github/workflows/ci.yml`. See
`../docs/release-checklist.md` before deploying.

## Where things are

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Main screen: lin tabs, search, graph, side panel; `?lin=&person=` in the URL |
| `src/app/admin/page.tsx` | Admin tabs (redirects non-admins) |
| `src/app/login`, `src/app/auth/callback` | Landing page with Google sign-in, and the OAuth code exchange |
| `src/components/landing/*` | Landing page sections and the decorative hero tree |
| `src/app/globals.css` | Design tokens (`@theme`) and sticker component classes; see `../designs/README.md` |
| `src/middleware.ts` | Sends signed-out visitors to `/login` |
| `src/lib/viewer.tsx` | Who is signed in: `personId` from the JWT, `isAdmin` from `rpc('is_admin')` |
| `src/lib/api/*` | Every Supabase query, one file per area |
| `src/lib/graph/*` | Pure layout: dagre for x, grad year for y; React Flow element builder |
| `src/components/graph/*` | The canvas and the name-pill node |
| `src/components/panel/*` | Side panel: profile view, editor, link requests |
| `src/components/admin/*` | Admin tabs |

The graph for a lin is one call: `rpc('lin_graph', { lin })`. See
`../supabase/README.md` for the contract.

House rule: never interpolate anything into a Supabase `.or()` / `.filter()` string
that did not come from the database or the signed-in user's JWT. Ids from the URL
go through `assertUuid` in `src/lib/ids.ts` first.

Two more rules the database enforces, so the app has to follow them:

- Never `select('*')` from `people`. The email and auth columns are not
  selectable there; `PUBLIC_PERSON_COLUMNS` in `src/lib/api/people.ts` is the
  allowed list. Use the `people_with_contact` view (own row for members, all
  rows for admins) when those columns are needed.
- Social links are validated in `src/lib/profileFields.ts` and rendered only
  when they pass; the same rules are check constraints on `people`. Photos go
  through `uploadOwnPhoto`, which re-encodes the image (dropping EXIF) and
  stores it at `<person id>/avatar.<ext>`, the only path the policies allow.

## Deploy to Vercel (one time)

1. Push the repo to GitHub. In Vercel, "Add New Project", pick the repo, and
   set **Root Directory** to `web`.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL` (the hosted project URL,
   `https://<ref>.supabase.co`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from the
   Supabase dashboard, Settings → API). Do **not** set `NEXT_PUBLIC_DEV_LOGIN`.
3. Deploy. Note the site URL, e.g. `https://csa-lins.vercel.app`.
4. In Supabase, Authentication → URL Configuration: set **Site URL** to that
   URL and add `https://csa-lins.vercel.app/auth/callback` to **Redirect URLs**
   (also add `http://localhost:3000/auth/callback` for local Google testing).
5. In Google Cloud Console, the OAuth client's authorized redirect URI is the
   Supabase callback `https://<ref>.supabase.co/auth/v1/callback` (not the
   Vercel URL). Paste its client id/secret into Supabase → Authentication →
   Providers → Google.
6. Sign in with a Penn Google account that an admin has added. Non-Penn
   accounts see "Please sign in with your Penn Google account."

## Gotchas

- If everyone lands as a viewer with no profile after deploy, the auth hook is
  not enabled on the hosted project; see the backend README, production step 5.
- Photos are served through one-hour signed URLs; a stale tab shows broken
  images until reload.
- `npm run gen:types` needs the local stack running.
