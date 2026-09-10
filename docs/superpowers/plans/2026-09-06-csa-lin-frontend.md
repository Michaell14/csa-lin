# CSA Lin Tree — Frontend (Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the web app for the CSA lin tree on top of the finished Supabase backend: Google sign-in, a per-lin graph drawn as grad-year rows of name pills, a profile side panel, self-service profile editing and link requests, and an admin screen.

**Architecture:** A Next.js App Router app in `web/`, talking to Supabase directly from client components with the anon key plus the signed-in user's JWT, so every read and write is governed by the backend's row-level security. A middleware keeps unauthenticated visitors on `/login`. Graph layout is a pure function (dagre for x, grad year for y) rendered with React Flow. All business rules live in the database; the frontend only shapes data and collects input.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), React 19, `@supabase/supabase-js` + `@supabase/ssr`, `@xyflow/react` 12, `@dagrejs/dagre` 1, Vitest + Testing Library (jsdom). Deployed on Vercel with root directory `web`.

**Spec:** `docs/superpowers/specs/2026-09-06-csa-lin-design.md` (sections 4, 7, 8, 9, 11, 12 govern this plan). Backend contracts: `supabase/README.md` and the migrations under `supabase/migrations/`.

## Global Constraints

- The app never uses the `service_role` key. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured. Authorization is the database's job; the UI only hides controls it knows will fail.
- Sign-in is Google OAuth (no `hd` hint: Penn Google accounts live on school subdomains, and the auth hook enforces the domain). A local-only email/password form appears only when `NEXT_PUBLIC_DEV_LOGIN=true`.
- The signed-in viewer's identity is the `person_id` claim in the access token (null for a viewer with no profile). Admin status is `rpc('is_admin')`, never inferred client-side.
- The graph for a lin comes from `rpc('lin_graph', { lin })`, which returns `{"people": [...], "links": [...]}` where each person has `id, is_founder, placeholder, display_name, grad_year, photo_path, major, hometown, bio, instagram, linkedin, claimed` and each link has `id, big_id, little_id, academic_year`. Placeholder people have null `display_name`/profile fields/`claimed` and are drawn as a "Founder" placeholder pill.
- Graph drawing: rows are grad years, founder's year on top; each person is a name pill with a small avatar, bordered in the grad-year color; unclaimed people show a dashed grey avatar; clicking a pill opens the side panel; pan, zoom, and a fit-to-screen control.
- Side panel: right-hand panel at `md` and up, bottom sheet below `md`. Bigs and littles are clickable pills that re-center the graph. If a person is in more than one lin, the panel lists them and switching is one click.
- Photo storage path is `<person_id>/avatar.<ext>` in the private `photos` bucket; images are read through signed URLs (1 hour). Uploads are limited client-side to 2 MB and `image/jpeg`, `image/png`, `image/webp` (the bucket enforces the same).
- Member self-service writes only these columns on their own row: `display_name, grad_year, personal_email, photo_path, major, hometown, bio, instagram, linkedin`.
- Link proposals insert `status = 'pending'`, `proposed_by = me`, and `me` as big or little. Accepting sets `status = 'confirmed'`, `confirmed_by = me`, `confirmed_at = now()`. Declining, withdrawing, and removing all delete the row. Proposing a link that already exists (either status) shows the existing one instead of inserting.
- Admin writes: insert people (name, grad year, Penn email lowercase), edit any person, toggle `hidden`, insert confirmed links, CRUD lins, resolve pending links, insert/delete admins, `rpc('merge_people', { survivor, duplicate })`, read `changelog`.
- Every error from Supabase is shown to the user in plain words next to the control that caused it; nothing is swallowed. The database's own messages (`link would create a cycle`, `penn_email is locked after claim`, `cannot remove the last admin`, `both people are claimed; clear one sign-in identity first`) are shown verbatim.
- Files live under `web/src/`. Tests are colocated as `*.test.ts` / `*.test.tsx` and run with `npm test` (Vitest, jsdom). Pure logic (layout, parsing, JWT decode, CSV) is tested directly; components are tested with Testing Library against props, never against a live Supabase.
- Version floors: `next` 15.x, `react` 19.x, `@supabase/ssr` ≥ 0.6, `@supabase/supabase-js` ≥ 2.45, `@xyflow/react` 12.x, `@dagrejs/dagre` ≥ 1.x (3.x is current; the `graphlib.Graph` + `layout` API used here is unchanged), `vitest` 3.x.

---

## Prerequisites

1. Docker Desktop running; `supabase start` done from the repo root (`supabase status` prints URLs and keys).
2. Node 20+ (`node --version`), npm 10+.
3. Working directory for all app commands is `/Users/michaelli/Documents/projects/csa-lin/web` unless a step says otherwise.

## File structure

```
web/
  .env.example                         committed; names the two public env vars
  .env.local                           NOT committed; real local values
  vitest.config.ts, vitest.setup.ts    test runner (jsdom, RAF/ResizeObserver shims)
  src/middleware.ts                    redirects signed-out users to /login
  src/app/layout.tsx                   ViewerProvider wrapper
  src/app/page.tsx                     main screen: TopBar + LinGraph + SidePanel, URL-synced state
  src/app/login/page.tsx               Google button (+ dev email form)
  src/app/auth/callback/route.ts       OAuth code exchange
  src/app/admin/page.tsx               admin tabs (guarded)
  src/lib/database.types.ts            generated by `supabase gen types`
  src/lib/types.ts                     LinGraph, GraphPerson, GraphLink, Lin, Person, Link
  src/lib/jwt.ts                       decodeJwtPayload, readViewerClaims
  src/lib/viewer.tsx                   ViewerProvider / useViewer (personId, isAdmin, pendingCount)
  src/lib/supabase/{client,server,middleware}.ts
  src/lib/api/{graph,lins,people,links,photos,admin}.ts   thin typed data access
  src/lib/graph/{layout,flow,colors}.ts                  pure layout + React Flow element builders
  src/lib/csv.ts                       parsePeopleCsv
  src/lib/errors.ts                    errorMessage(unknown) -> string
  src/components/TopBar.tsx, LinTabs.tsx, SearchBox.tsx
  src/components/graph/LinGraph.tsx, PersonNode.tsx
  src/components/panel/SidePanel.tsx, ProfileView.tsx, ProfileEditor.tsx, LinkRequests.tsx, AddLinkDialog.tsx
  src/components/admin/{PeopleTable,AddPersonForm,BulkAddForm,LinksAdmin,LinsAdmin,PendingAdmin,AdminsAdmin,MergeForm,ChangelogList}.tsx
```

## Shared test fixture (used by Tasks 3, 4, 5, 7)

`web/src/lib/testFixtures.ts` — created in Task 3. Mirrors the backend fixture: Lin A with a founder, two bigs, two children, and a shared kid who also has a big in Lin B.

```ts
import type { LinGraph, GraphPerson } from '@/lib/types'

const P = (id: string, name: string | null, year: number, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, display_name: name, grad_year: year, is_founder: false, placeholder: false,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null,
  claimed: true, ...extra,
})

export const ID = {
  founder: '00000000-0000-0000-0000-000000000001',
  big1: '00000000-0000-0000-0000-000000000002',
  big2: '00000000-0000-0000-0000-000000000003',
  child1: '00000000-0000-0000-0000-000000000004',
  child2: '00000000-0000-0000-0000-000000000005',
  shared: '00000000-0000-0000-0000-000000000006',
}

export const linAGraph: LinGraph = {
  people: [
    P(ID.founder, 'Founder A', 2020, { is_founder: true }),
    P(ID.big1, 'Big One', 2021),
    P(ID.big2, 'Big Two', 2021, { claimed: false }),
    P(ID.child1, 'Child One', 2022),
    P(ID.child2, 'Child Two', 2022),
    P(ID.shared, 'Shared Kid', 2023),
  ],
  links: [
    { id: 'l1', big_id: ID.founder, little_id: ID.big1, academic_year: '2020-21' },
    { id: 'l2', big_id: ID.founder, little_id: ID.big2, academic_year: '2020-21' },
    { id: 'l3', big_id: ID.big1, little_id: ID.child1, academic_year: '2021-22' },
    { id: 'l4', big_id: ID.big2, little_id: ID.child2, academic_year: '2021-22' },
    { id: 'l5', big_id: ID.child1, little_id: ID.shared, academic_year: '2022-23' },
  ],
}

export const hiddenFounderGraph: LinGraph = {
  people: [
    P(ID.founder, null, 2020, { is_founder: true, placeholder: true, claimed: null }),
    P(ID.big1, 'Big One', 2021),
  ],
  links: [{ id: 'l1', big_id: ID.founder, little_id: ID.big1, academic_year: null }],
}
```

---

### Task 1: Scaffold the Next.js app, test runner, and generated types

**Files:**
- Create: `web/` via `create-next-app`, then `web/vitest.config.ts`, `web/vitest.setup.ts`, `web/.env.example`, `web/.env.local`, `web/src/lib/database.types.ts` (generated), `web/src/lib/wiring.test.tsx`
- Modify: `web/package.json` (scripts, deps), `web/.gitignore`

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom, Testing Library, `@/` alias), `npm run gen:types`, the `Database` type at `@/lib/database.types`, and env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DEV_LOGIN`.

- [ ] **Step 1: Create the app**

From the repo root:
```bash
cd /Users/michaelli/Documents/projects/csa-lin
npx --yes create-next-app@15 web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
Expected: `web/` exists with `src/app/page.tsx`, `package.json` showing `"next": "15.x"`. If it prompts for Turbopack, answer yes.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/michaelli/Documents/projects/csa-lin/web
npm install @supabase/supabase-js @supabase/ssr @xyflow/react @dagrejs/dagre
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Add scripts to `web/package.json`**

In the `"scripts"` object add:
```json
"test": "vitest run",
"test:watch": "vitest",
"gen:types": "cd .. && supabase gen types typescript --local > web/src/lib/database.types.ts"
```

- [ ] **Step 4: Test runner config**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Create `web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'

// jsdom lacks these; React Flow and some layout code expect them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error assigning a stub onto the jsdom global
globalThis.ResizeObserver = ResizeObserverStub
if (!globalThis.DOMMatrixReadOnly) {
  // @ts-expect-error minimal stub
  globalThis.DOMMatrixReadOnly = class { m22 = 1; constructor() {} }
}
```

- [ ] **Step 5: Env files**

Create `web/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key-from-supabase-status
NEXT_PUBLIC_DEV_LOGIN=true
```

Create `web/.env.local` with real local values (from the repo root):
```bash
cd /Users/michaelli/Documents/projects/csa-lin
ANON=$(supabase status -o env | grep '^ANON_KEY' | cut -d= -f2 | tr -d '"')
printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nNEXT_PUBLIC_DEV_LOGIN=true\n' "$ANON" > web/.env.local
cat web/.env.local | cut -c1-60
```
Expected: three lines, the key line starting `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ`.

Append to `web/.gitignore` so the example is committed while local secrets are not:
```
!.env.example
```

- [ ] **Step 6: Generate database types**

```bash
cd /Users/michaelli/Documents/projects/csa-lin/web
npm run gen:types
grep -c "lin_graph" src/lib/database.types.ts
```
Expected: a count of 1 or more (the function is in the generated `Functions` block).

- [ ] **Step 7: Write the wiring test**

Create `web/src/lib/wiring.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { Database } from '@/lib/database.types'

type PeopleRow = Database['public']['Tables']['people']['Row']

describe('test wiring', () => {
  it('renders with Testing Library and resolves the @ alias', () => {
    const sample: Pick<PeopleRow, 'display_name'> = { display_name: 'Alice' }
    render(<p>{sample.display_name}</p>)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run tests, lint, and build**

```bash
npm test
npm run lint
npm run build
```
Expected: `1 passed`; lint clean; build succeeds (the default page still builds).

- [ ] **Step 9: Commit**

From the repo root:
```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "chore(web): scaffold Next.js app with Vitest and generated Supabase types"
```
Verify `.env.local` is not in the commit: `git show --stat HEAD | grep -c env.local` prints 0.

---

### Task 2: Supabase clients, JWT claims, viewer context, login, callback, middleware

**Files:**
- Create: `web/src/lib/jwt.ts`, `web/src/lib/jwt.test.ts`, `web/src/lib/errors.ts`, `web/src/lib/errors.test.ts`, `web/src/lib/supabase/client.ts`, `web/src/lib/supabase/server.ts`, `web/src/lib/supabase/middleware.ts`, `web/src/middleware.ts`, `web/src/lib/viewer.tsx`, `web/src/app/login/page.tsx`, `web/src/app/auth/callback/route.ts`
- Modify: `web/src/app/layout.tsx`, `web/src/app/page.tsx` (temporary placeholder)

**Interfaces:**
- Produces: `readViewerClaims(token) -> { personId, email, sub }`; `errorMessage(e: unknown) -> string`; `createClient()` (browser) and `createClient()` (server, async); `useViewer() -> { loading, authUserId, email, personId, isAdmin, pendingCount, refresh, signOut }`.

- [ ] **Step 1: Write the failing JWT and error tests**

Create `web/src/lib/jwt.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, readViewerClaims } from '@/lib/jwt'

function fakeJwt(payload: Record<string, unknown>) {
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.sig`
}

describe('decodeJwtPayload', () => {
  it('decodes a base64url payload', () => {
    expect(decodeJwtPayload(fakeJwt({ a: 1 }))).toEqual({ a: 1 })
  })
  it('returns null for garbage', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload('a.b.c')).toBeNull()
  })
})

describe('readViewerClaims', () => {
  it('reads person_id, email and sub', () => {
    const t = fakeJwt({ person_id: '00000000-0000-0000-0000-000000000001', email: 'a@upenn.edu', sub: 'u1' })
    expect(readViewerClaims(t)).toEqual({ personId: '00000000-0000-0000-0000-000000000001', email: 'a@upenn.edu', sub: 'u1' })
  })
  it('maps a null person_id claim to null', () => {
    expect(readViewerClaims(fakeJwt({ person_id: null, email: 'v@upenn.edu', sub: 'u2' })).personId).toBeNull()
  })
  it('handles a missing token', () => {
    expect(readViewerClaims(null)).toEqual({ personId: null, email: null, sub: null })
  })
})
```

Create `web/src/lib/errors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { errorMessage } from '@/lib/errors'

describe('errorMessage', () => {
  it('uses a Supabase error message verbatim', () => {
    expect(errorMessage({ message: 'link would create a cycle', code: '23514' })).toBe('link would create a cycle')
  })
  it('uses Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })
  it('falls back for unknown shapes', () => {
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: both files fail to import (`Cannot find module '@/lib/jwt'` and `'@/lib/errors'`).

- [ ] **Step 3: Implement jwt.ts and errors.ts**

Create `web/src/lib/jwt.ts`:
```ts
export type ViewerClaims = { personId: string | null; email: string | null; sub: string | null }

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function readViewerClaims(token: string | null | undefined): ViewerClaims {
  const p = token ? decodeJwtPayload(token) : null
  const pid = p?.person_id
  return {
    personId: typeof pid === 'string' && pid.length > 0 ? pid : null,
    email: typeof p?.email === 'string' ? p.email : null,
    sub: typeof p?.sub === 'string' ? p.sub : null,
  }
}
```

Create `web/src/lib/errors.ts`:
```ts
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: 7 tests passing across 3 files.

- [ ] **Step 5: Supabase clients and middleware**

Create `web/src/lib/supabase/client.ts`:
```ts
'use client'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
export type Supabase = ReturnType<typeof createClient>
```

Create `web/src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
      },
    },
  )
}
```

Create `web/src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = path.startsWith('/login') || path.startsWith('/auth')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return response
}
```

Create `web/src/middleware.ts`:
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 6: Viewer context**

Create `web/src/lib/viewer.tsx`:
```tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readViewerClaims } from '@/lib/jwt'

export type Viewer = {
  loading: boolean
  authUserId: string | null
  email: string | null
  personId: string | null
  isAdmin: boolean
  pendingCount: number
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const ViewerContext = createContext<Viewer | null>(null)

export function ViewerProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<Omit<Viewer, 'refresh' | 'signOut'>>({
    loading: true, authUserId: null, email: null, personId: null, isAdmin: false, pendingCount: 0,
  })

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const claims = readViewerClaims(session?.access_token)
    let isAdmin = false
    let pendingCount = 0
    if (claims.personId) {
      const [{ data: admin }, { count }] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.from('links').select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .or(`big_id.eq.${claims.personId},little_id.eq.${claims.personId}`)
          .neq('proposed_by', claims.personId),
      ])
      isAdmin = admin === true
      pendingCount = count ?? 0
    }
    setState({ loading: false, authUserId: claims.sub, email: claims.email, personId: claims.personId, isAdmin, pendingCount })
  }, [supabase])

  useEffect(() => {
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void refresh() })
    return () => sub.subscription.unsubscribe()
  }, [supabase, refresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const value = useMemo<Viewer>(() => ({ ...state, refresh, signOut }), [state, refresh, signOut])
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer(): Viewer {
  const v = useContext(ViewerContext)
  if (!v) throw new Error('useViewer must be used inside ViewerProvider')
  return v
}
```

Replace `web/src/app/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import './globals.css'
import { ViewerProvider } from '@/lib/viewer'

export const metadata: Metadata = { title: 'CSA Lins', description: 'Big/little family trees of the Penn Chinese Student Association' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <ViewerProvider>{children}</ViewerProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Login page and callback**

Create `web/src/app/login/page.tsx`:
```tsx
'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(params.get('error'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === 'true'

  async function google() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { hd: 'upenn.edu', prompt: 'select_account' } },
    })
    if (error) setError(errorMessage(error))
  }

  async function dev(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(errorMessage(error)); return }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">CSA Lins</h1>
      <p className="text-sm text-neutral-600">Sign in with your Penn Google account to see the lin trees.</p>
      <button onClick={google} className="rounded-md bg-neutral-900 px-4 py-2 text-white">Continue with Google</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {devLogin && (
        <form onSubmit={dev} className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs uppercase text-neutral-500">Local dev login</p>
          <input className="rounded border px-2 py-1" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="rounded border px-2 py-1" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="rounded-md border px-4 py-2">Sign in</button>
        </form>
      )}
    </main>
  )
}
```

Create `web/src/app/auth/callback/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const described = searchParams.get('error_description')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/`)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(described ?? 'Sign-in failed')}`)
}
```

Replace `web/src/app/page.tsx` with a temporary placeholder (Task 6 replaces it):
```tsx
'use client'
import { useViewer } from '@/lib/viewer'

export default function Home() {
  const v = useViewer()
  if (v.loading) return <p className="p-6">Loading…</p>
  return (
    <main className="p-6">
      <p>Signed in as {v.email ?? 'unknown'}. Profile: {v.personId ?? 'none'}. Admin: {String(v.isAdmin)}. Pending: {v.pendingCount}</p>
      <button className="mt-4 rounded border px-3 py-1" onClick={v.signOut}>Sign out</button>
    </main>
  )
}
```

Next 15 requires `useSearchParams` to be inside a Suspense boundary for static rendering; wrap the login page: rename the component above to `LoginForm` and export
```tsx
import { Suspense } from 'react'
export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
```

- [ ] **Step 8: Verify by hand**

```bash
npm run lint && npm run build
npm run dev
```
In a browser: `http://localhost:3000` redirects to `/login`. Use the dev form with `alice@upenn.edu` / `password123`. Expected: lands on `/` showing `Profile: 10000000-0000-0000-0000-000000000001. Admin: true. Pending: 0`. Sign out returns to `/login`. Then sign in as `bob@upenn.edu` / `password123`: `Admin: false`. Try `nobody@gmail.com` with any password: an error is shown, no redirect.

- [ ] **Step 9: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): Supabase clients, JWT viewer claims, login, callback, middleware"
```

---

### Task 3: Types, data access layer, and graph parsing

**Files:**
- Create: `web/src/lib/types.ts`, `web/src/lib/testFixtures.ts` (from the fixture block above), `web/src/lib/api/graph.ts`, `web/src/lib/api/graph.test.ts`, `web/src/lib/api/lins.ts`, `web/src/lib/api/people.ts`, `web/src/lib/api/links.ts`, `web/src/lib/api/links.test.ts`, `web/src/lib/api/photos.ts`, `web/src/lib/api/photos.test.ts`

**Interfaces:**
- Produces (all take a `Supabase` client as first argument, throw on Supabase error):
  - `parseLinGraph(raw: unknown): LinGraph`; `fetchLinGraph(sb, linId)`
  - `fetchLins(sb): Promise<Lin[]>`; `fetchLinsOf(sb, personId): Promise<string[]>`
  - `fetchPerson(sb, id): Promise<Person | null>`; `searchPeople(sb, q, limit=10): Promise<Pick<Person,'id'|'display_name'|'grad_year'|'hidden'>[]>`; `fetchPeopleByIds(sb, ids)`; `updateOwnProfile(sb, id, patch: OwnProfilePatch)`
  - `fetchLinksFor(sb, personId): Promise<Link[]>`; `splitLinks(links, me): { confirmedBigs, confirmedLittles, incoming, outgoing }`; `findLinkBetween(sb, a, b): Promise<Link | null>`; `proposeLink(sb, { bigId, littleId, me })`; `acceptLink(sb, linkId, me)`; `deleteLink(sb, linkId)`
  - `photoExtension(file): string | null`; `validatePhoto(file): string | null` (error text or null); `signedPhotoUrls(sb, paths): Promise<Map<string,string>>`; `uploadOwnPhoto(sb, personId, file): Promise<string>` (returns the stored path)

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/api/graph.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseLinGraph } from '@/lib/api/graph'
import { linAGraph } from '@/lib/testFixtures'

describe('parseLinGraph', () => {
  it('accepts a well-formed payload', () => {
    const g = parseLinGraph(JSON.parse(JSON.stringify(linAGraph)))
    expect(g.people).toHaveLength(6)
    expect(g.links).toHaveLength(5)
  })
  it('defaults missing arrays to empty', () => {
    expect(parseLinGraph({})).toEqual({ people: [], links: [] })
    expect(parseLinGraph(null)).toEqual({ people: [], links: [] })
  })
  it('rejects a person without an id', () => {
    expect(() => parseLinGraph({ people: [{ display_name: 'x' }], links: [] })).toThrow(/person/)
  })
  it('drops links whose endpoints are not in people', () => {
    const g = parseLinGraph({ people: linAGraph.people, links: [...linAGraph.links, { id: 'zz', big_id: 'nope', little_id: linAGraph.people[0].id, academic_year: null }] })
    expect(g.links.map(l => l.id)).not.toContain('zz')
  })
})
```

Create `web/src/lib/api/links.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { splitLinks } from '@/lib/api/links'
import type { Link } from '@/lib/types'

const me = 'me', a = 'a', b = 'b', c = 'c'
const L = (id: string, big: string, little: string, status: 'pending' | 'confirmed', proposed_by: string | null): Link => ({
  id, big_id: big, little_id: little, status, proposed_by, confirmed_by: null, confirmed_at: null, academic_year: null, created_at: '2026-01-01T00:00:00Z',
})

describe('splitLinks', () => {
  const links = [
    L('1', a, me, 'confirmed', null),      // a is my big
    L('2', me, b, 'confirmed', null),      // b is my little
    L('3', c, me, 'pending', c),           // c proposed to be my big -> incoming
    L('4', me, a, 'pending', me),          // I proposed a as my little -> outgoing
  ]
  it('sorts links into the four buckets', () => {
    const s = splitLinks(links, me)
    expect(s.confirmedBigs.map(l => l.id)).toEqual(['1'])
    expect(s.confirmedLittles.map(l => l.id)).toEqual(['2'])
    expect(s.incoming.map(l => l.id)).toEqual(['3'])
    expect(s.outgoing.map(l => l.id)).toEqual(['4'])
  })
})
```

Create `web/src/lib/api/photos.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { photoExtension, validatePhoto } from '@/lib/api/photos'

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type })

describe('validatePhoto', () => {
  it('accepts a small jpeg', () => expect(validatePhoto(file('image/jpeg', 1000))).toBeNull())
  it('rejects a gif', () => expect(validatePhoto(file('image/gif', 1000))).toMatch(/JPEG, PNG, or WebP/))
  it('rejects over 2 MB', () => expect(validatePhoto(file('image/png', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/))
})

describe('photoExtension', () => {
  it('maps mime types to extensions', () => {
    expect(photoExtension(file('image/jpeg', 1))).toBe('jpg')
    expect(photoExtension(file('image/png', 1))).toBe('png')
    expect(photoExtension(file('image/webp', 1))).toBe('webp')
    expect(photoExtension(file('text/plain', 1))).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: three new files fail on missing modules.

- [ ] **Step 3: Types and fixture**

Create `web/src/lib/types.ts`:
```ts
import type { Database } from '@/lib/database.types'

export type Person = Database['public']['Tables']['people']['Row']
export type Link = Database['public']['Tables']['links']['Row']
export type Lin = Pick<Database['public']['Tables']['lins']['Row'], 'id' | 'name' | 'color' | 'founder_id'>
export type ChangelogRow = Database['public']['Tables']['changelog']['Row']

export type GraphPerson = {
  id: string
  is_founder: boolean
  placeholder: boolean
  display_name: string | null
  grad_year: number
  photo_path: string | null
  major: string | null
  hometown: string | null
  bio: string | null
  instagram: string | null
  linkedin: string | null
  claimed: boolean | null
}
export type GraphLink = { id: string; big_id: string; little_id: string; academic_year: string | null }
export type LinGraph = { people: GraphPerson[]; links: GraphLink[] }

export type OwnProfilePatch = Partial<Pick<Person,
  'display_name' | 'grad_year' | 'personal_email' | 'photo_path' | 'major' | 'hometown' | 'bio' | 'instagram' | 'linkedin'>>
```

Create `web/src/lib/testFixtures.ts` with the fixture block from the top of this plan, verbatim.

- [ ] **Step 4: Data access modules**

Create `web/src/lib/api/graph.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'
import type { GraphLink, GraphPerson, LinGraph } from '@/lib/types'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function parseLinGraph(raw: unknown): LinGraph {
  const r = asRecord(raw) ?? {}
  const peopleRaw = Array.isArray(r.people) ? r.people : []
  const linksRaw = Array.isArray(r.links) ? r.links : []
  const people: GraphPerson[] = peopleRaw.map((p, i) => {
    const o = asRecord(p)
    if (!o || typeof o.id !== 'string') throw new Error(`lin_graph person #${i} has no id`)
    return {
      id: o.id,
      is_founder: o.is_founder === true,
      placeholder: o.placeholder === true,
      display_name: typeof o.display_name === 'string' ? o.display_name : null,
      grad_year: typeof o.grad_year === 'number' ? o.grad_year : 0,
      photo_path: typeof o.photo_path === 'string' ? o.photo_path : null,
      major: typeof o.major === 'string' ? o.major : null,
      hometown: typeof o.hometown === 'string' ? o.hometown : null,
      bio: typeof o.bio === 'string' ? o.bio : null,
      instagram: typeof o.instagram === 'string' ? o.instagram : null,
      linkedin: typeof o.linkedin === 'string' ? o.linkedin : null,
      claimed: typeof o.claimed === 'boolean' ? o.claimed : null,
    }
  })
  const ids = new Set(people.map(p => p.id))
  const links: GraphLink[] = linksRaw.flatMap(l => {
    const o = asRecord(l)
    if (!o || typeof o.id !== 'string' || typeof o.big_id !== 'string' || typeof o.little_id !== 'string') return []
    if (!ids.has(o.big_id) || !ids.has(o.little_id)) return []
    return [{ id: o.id, big_id: o.big_id, little_id: o.little_id, academic_year: typeof o.academic_year === 'string' ? o.academic_year : null }]
  })
  return { people, links }
}

export async function fetchLinGraph(sb: Supabase, linId: string): Promise<LinGraph> {
  const { data, error } = await sb.rpc('lin_graph', { lin: linId })
  if (error) throw error
  return parseLinGraph(data)
}
```

Create `web/src/lib/api/lins.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'
import type { Lin } from '@/lib/types'

export async function fetchLins(sb: Supabase): Promise<Lin[]> {
  const { data, error } = await sb.from('lins').select('id, name, color, founder_id').order('name')
  if (error) throw error
  return data
}

export async function fetchLinsOf(sb: Supabase, personId: string): Promise<string[]> {
  const { data, error } = await sb.rpc('lins_of', { p: personId })
  if (error) throw error
  return (data ?? []) as string[]
}
```

Create `web/src/lib/api/people.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'
import type { OwnProfilePatch, Person } from '@/lib/types'

export type PersonHit = Pick<Person, 'id' | 'display_name' | 'grad_year' | 'hidden'>

export async function fetchPerson(sb: Supabase, id: string): Promise<Person | null> {
  const { data, error } = await sb.from('people').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPeopleByIds(sb: Supabase, ids: string[]): Promise<Person[]> {
  if (ids.length === 0) return []
  const { data, error } = await sb.from('people').select('*').in('id', ids)
  if (error) throw error
  return data
}

export async function searchPeople(sb: Supabase, q: string, limit = 10): Promise<PersonHit[]> {
  const term = q.trim()
  if (!term) return []
  const { data, error } = await sb.from('people')
    .select('id, display_name, grad_year, hidden')
    .ilike('display_name', `%${term.replace(/[%_]/g, '')}%`)
    .order('display_name').limit(limit)
  if (error) throw error
  return data
}

export async function updateOwnProfile(sb: Supabase, id: string, patch: OwnProfilePatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}
```

Create `web/src/lib/api/links.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'
import type { Link } from '@/lib/types'

export async function fetchLinksFor(sb: Supabase, personId: string): Promise<Link[]> {
  const { data, error } = await sb.from('links').select('*')
    .or(`big_id.eq.${personId},little_id.eq.${personId}`)
    .order('created_at')
  if (error) throw error
  return data
}

export function splitLinks(links: Link[], me: string) {
  const confirmed = links.filter(l => l.status === 'confirmed')
  const pending = links.filter(l => l.status === 'pending')
  return {
    confirmedBigs: confirmed.filter(l => l.little_id === me),
    confirmedLittles: confirmed.filter(l => l.big_id === me),
    incoming: pending.filter(l => l.proposed_by !== me),
    outgoing: pending.filter(l => l.proposed_by === me),
  }
}

export async function findLinkBetween(sb: Supabase, a: string, b: string): Promise<Link | null> {
  const { data, error } = await sb.from('links').select('*')
    .or(`and(big_id.eq.${a},little_id.eq.${b}),and(big_id.eq.${b},little_id.eq.${a})`)
    .limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function proposeLink(sb: Supabase, args: { bigId: string; littleId: string; me: string }): Promise<Link> {
  const { data, error } = await sb.from('links')
    .insert({ big_id: args.bigId, little_id: args.littleId, status: 'pending', proposed_by: args.me })
    .select('*').single()
  if (error) throw error
  return data
}

export async function acceptLink(sb: Supabase, linkId: string, me: string): Promise<void> {
  const { error } = await sb.from('links')
    .update({ status: 'confirmed', confirmed_by: me, confirmed_at: new Date().toISOString() })
    .eq('id', linkId)
  if (error) throw error
}

export async function deleteLink(sb: Supabase, linkId: string): Promise<void> {
  const { error } = await sb.from('links').delete().eq('id', linkId)
  if (error) throw error
}
```

Create `web/src/lib/api/photos.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'

const MAX_BYTES = 2 * 1024 * 1024
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function photoExtension(file: File): string | null {
  return EXT[file.type] ?? null
}

export function validatePhoto(file: File): string | null {
  if (!photoExtension(file)) return 'Photo must be a JPEG, PNG, or WebP image'
  if (file.size > MAX_BYTES) return 'Photo must be 2 MB or smaller'
  return null
}

export async function signedPhotoUrls(sb: Supabase, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await sb.storage.from('photos').createSignedUrls(unique, 3600)
  if (error) throw error
  const out = new Map<string, string>()
  for (const row of data) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl)
  return out
}

export async function uploadOwnPhoto(sb: Supabase, personId: string, file: File): Promise<string> {
  const problem = validatePhoto(file)
  if (problem) throw new Error(problem)
  const path = `${personId}/avatar.${photoExtension(file)}`
  const { error } = await sb.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}
```

- [ ] **Step 5: Run tests and lint**

```bash
npm test && npm run lint
```
Expected: 16 tests passing across 6 files; lint clean. If TypeScript complains that `sb.rpc('lins_of', { p })` has the wrong argument name, open `src/lib/database.types.ts`, find `lins_of` under `Functions`, and use the exact `Args` key it lists (it is `p` in the backend migration).

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): typed data access layer and lin_graph parsing"
```

---

### Task 4: Pure graph layout, year colors, and React Flow element builder

**Files:**
- Create: `web/src/lib/graph/colors.ts`, `web/src/lib/graph/colors.test.ts`, `web/src/lib/graph/layout.ts`, `web/src/lib/graph/layout.test.ts`, `web/src/lib/graph/flow.ts`, `web/src/lib/graph/flow.test.ts`

**Interfaces:**
- Produces:
  - `yearColor(gradYear: number): string` — deterministic hex from an 8-color palette.
  - `NODE_W = 180`, `NODE_H = 40`; `layoutLin(graph: LinGraph): { nodes: Positioned[]; rows: number[] }` where `Positioned = { id, x, y }` is a top-left corner, `rows` is the ascending list of grad years (row index = position in `rows`).
  - `PersonNodeData = { person: GraphPerson; photoUrl: string | null; selected: boolean; color: string }`; `buildFlowElements(graph, layout, opts: { selectedId: string | null; photoUrls: Map<string,string> }): { nodes: Node<PersonNodeData>[]; edges: Edge[] }`. Node ids are person ids; node `type` is `'person'`; edge ids are link ids; edges run big → little.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/graph/colors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { yearColor } from '@/lib/graph/colors'

describe('yearColor', () => {
  it('is deterministic and hex', () => {
    expect(yearColor(2024)).toBe(yearColor(2024))
    expect(yearColor(2024)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('differs for adjacent years', () => {
    expect(yearColor(2024)).not.toBe(yearColor(2025))
  })
})
```

Create `web/src/lib/graph/layout.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { layoutLin, NODE_H } from '@/lib/graph/layout'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

describe('layoutLin', () => {
  const { nodes, rows } = layoutLin(linAGraph)
  const pos = new Map(nodes.map(n => [n.id, n]))

  it('positions every person exactly once', () => {
    expect(nodes.map(n => n.id).sort()).toEqual(linAGraph.people.map(p => p.id).sort())
  })
  it('lists grad years ascending as rows', () => {
    expect(rows).toEqual([2020, 2021, 2022, 2023])
  })
  it('puts people of the same grad year on the same y', () => {
    expect(pos.get(ID.big1)!.y).toBe(pos.get(ID.big2)!.y)
    expect(pos.get(ID.child1)!.y).toBe(pos.get(ID.child2)!.y)
  })
  it('places each row strictly below the previous', () => {
    const ys = [ID.founder, ID.big1, ID.child1, ID.shared].map(id => pos.get(id)!.y)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(NODE_H)
  })
  it('gives every node finite coordinates', () => {
    for (const n of nodes) { expect(Number.isFinite(n.x)).toBe(true); expect(Number.isFinite(n.y)).toBe(true) }
  })
  it('handles a placeholder founder and an empty graph', () => {
    expect(layoutLin(hiddenFounderGraph).nodes).toHaveLength(2)
    expect(layoutLin({ people: [], links: [] })).toEqual({ nodes: [], rows: [] })
  })
})
```

Create `web/src/lib/graph/flow.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements } from '@/lib/graph/flow'
import { linAGraph, ID } from '@/lib/testFixtures'

describe('buildFlowElements', () => {
  const layout = layoutLin(linAGraph)
  const photoUrls = new Map([[`${ID.big1}/avatar.jpg`, 'https://x/1']])
  const { nodes, edges } = buildFlowElements({ ...linAGraph, people: linAGraph.people.map(p => p.id === ID.big1 ? { ...p, photo_path: `${ID.big1}/avatar.jpg` } : p) }, layout, { selectedId: ID.child1, photoUrls })

  it('creates one node per person and one edge per link', () => {
    expect(nodes.map(n => n.id).sort()).toEqual(linAGraph.people.map(p => p.id).sort())
    expect(edges.map(e => e.id).sort()).toEqual(linAGraph.links.map(l => l.id).sort())
  })
  it('directs edges from big to little', () => {
    const e = edges.find(e => e.id === 'l5')!
    expect(e.source).toBe(ID.child1)
    expect(e.target).toBe(ID.shared)
  })
  it('marks the selected node and resolves photo urls', () => {
    expect(nodes.find(n => n.id === ID.child1)!.data.selected).toBe(true)
    expect(nodes.find(n => n.id === ID.big2)!.data.selected).toBe(false)
    expect(nodes.find(n => n.id === ID.big1)!.data.photoUrl).toBe('https://x/1')
    expect(nodes.find(n => n.id === ID.big2)!.data.photoUrl).toBeNull()
  })
  it('uses the person node type and positions from the layout', () => {
    const n = nodes.find(n => n.id === ID.founder)!
    const p = layout.nodes.find(n => n.id === ID.founder)!
    expect(n.type).toBe('person')
    expect(n.position).toEqual({ x: p.x, y: p.y })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: three files fail on missing modules.

- [ ] **Step 3: Implement**

Create `web/src/lib/graph/colors.ts`:
```ts
const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#8b5cf6']

export function yearColor(gradYear: number): string {
  const i = ((gradYear % PALETTE.length) + PALETTE.length) % PALETTE.length
  return PALETTE[i]
}
```

Create `web/src/lib/graph/layout.ts`:
```ts
import dagre from '@dagrejs/dagre'
import type { LinGraph } from '@/lib/types'

export const NODE_W = 180
export const NODE_H = 40
const ROW_GAP = 80
const COL_GAP = 32

export type Positioned = { id: string; x: number; y: number }

// dagre decides left-to-right order and x; grad year decides the row (y).
export function layoutLin(graph: LinGraph): { nodes: Positioned[]; rows: number[] } {
  if (graph.people.length === 0) return { nodes: [], rows: [] }
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: COL_GAP, ranksep: ROW_GAP })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(graph.people.map(p => p.id))
  for (const p of graph.people) g.setNode(p.id, { width: NODE_W, height: NODE_H })
  for (const l of graph.links) if (ids.has(l.big_id) && ids.has(l.little_id)) g.setEdge(l.big_id, l.little_id)
  dagre.layout(g)

  const rows = [...new Set(graph.people.map(p => p.grad_year))].sort((a, b) => a - b)
  const rowOf = new Map(rows.map((y, i) => [y, i]))
  const nodes = graph.people.map(p => {
    const n = g.node(p.id)
    return { id: p.id, x: (n?.x ?? 0) - NODE_W / 2, y: rowOf.get(p.grad_year)! * (NODE_H + ROW_GAP) }
  })
  return { nodes, rows }
}
```

Create `web/src/lib/graph/flow.ts`:
```ts
import type { Edge, Node } from '@xyflow/react'
import type { GraphPerson, LinGraph } from '@/lib/types'
import type { Positioned } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'

export type PersonNodeData = { person: GraphPerson; photoUrl: string | null; selected: boolean; color: string }
export type PersonFlowNode = Node<PersonNodeData, 'person'>

export function buildFlowElements(
  graph: LinGraph,
  layout: { nodes: Positioned[] },
  opts: { selectedId: string | null; photoUrls: Map<string, string> },
): { nodes: PersonFlowNode[]; edges: Edge[] } {
  const pos = new Map(layout.nodes.map(n => [n.id, n]))
  const nodes: PersonFlowNode[] = graph.people.map(person => {
    const p = pos.get(person.id) ?? { x: 0, y: 0 }
    return {
      id: person.id,
      type: 'person',
      position: { x: p.x, y: p.y },
      draggable: false,
      data: {
        person,
        photoUrl: person.photo_path ? opts.photoUrls.get(person.photo_path) ?? null : null,
        selected: person.id === opts.selectedId,
        color: yearColor(person.grad_year),
      },
    }
  })
  const edges: Edge[] = graph.links.map(l => ({
    id: l.id, source: l.big_id, target: l.little_id, type: 'smoothstep',
    style: { stroke: '#9ca3af', strokeWidth: 1.5 },
  }))
  return { nodes, edges }
}
```

- [ ] **Step 4: Run tests and lint**

```bash
npm test && npm run lint
```
Expected: 28 tests passing across 9 files.

- [ ] **Step 5: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): dagre row layout, year colors, React Flow element builder"
```

---

### Task 5: Graph components (PersonNode pill and LinGraph canvas)

**Files:**
- Create: `web/src/components/graph/PersonNode.tsx`, `web/src/components/graph/PersonNode.test.tsx`, `web/src/components/graph/LinGraph.tsx`

**Interfaces:**
- Consumes: `PersonNodeData`, `buildFlowElements`, `layoutLin`, `NODE_W/NODE_H`.
- Produces: `<PersonNode data={PersonNodeData} />` (registered as React Flow node type `person`); `<LinGraph graph photoUrls selectedId onSelect linKey />` where `linKey` changes trigger a fit-to-view.

- [ ] **Step 1: Write the failing PersonNode test**

Create `web/src/components/graph/PersonNode.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import { PersonNode } from '@/components/graph/PersonNode'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

const wrap = (ui: React.ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
const data = (id: string, extra = {}) => ({
  person: linAGraph.people.find(p => p.id === id)!, photoUrl: null, selected: false, color: '#6366f1', ...extra,
})

describe('PersonNode', () => {
  it('shows name and two-digit year', () => {
    wrap(<PersonNode data={data(ID.big1)} />)
    expect(screen.getByText('Big One')).toBeInTheDocument()
    expect(screen.getByText("'21")).toBeInTheDocument()
  })
  it('marks an unclaimed person with a dashed avatar', () => {
    wrap(<PersonNode data={data(ID.big2)} />)
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-unclaimed', 'true')
  })
  it('renders a photo when a url is given', () => {
    wrap(<PersonNode data={data(ID.big1, { photoUrl: 'https://x/1' })} />)
    expect(screen.getByRole('img', { name: 'Big One' })).toHaveAttribute('src', 'https://x/1')
  })
  it('renders a placeholder founder without a name', () => {
    wrap(<PersonNode data={{ person: hiddenFounderGraph.people[0], photoUrl: null, selected: false, color: '#000000' }} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
  })
  it('exposes selection state', () => {
    wrap(<PersonNode data={data(ID.big1, { selected: true })} />)
    expect(screen.getByTestId('pill')).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```
Expected: fails on missing `@/components/graph/PersonNode`.

- [ ] **Step 3: Implement PersonNode**

Create `web/src/components/graph/PersonNode.tsx`:
```tsx
'use client'
import { Handle, Position } from '@xyflow/react'
import type { PersonNodeData } from '@/lib/graph/flow'
import { NODE_H, NODE_W } from '@/lib/graph/layout'

export function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, photoUrl, selected, color } = data
  const name = person.placeholder ? 'Founder' : (person.display_name ?? 'Unnamed')
  const unclaimed = !person.placeholder && person.claimed === false
  return (
    <div
      data-testid="pill"
      aria-pressed={selected}
      style={{ width: NODE_W, height: NODE_H, borderColor: color, boxShadow: selected ? `0 0 0 3px ${color}55` : undefined }}
      className={`flex items-center gap-2 rounded-full border-2 bg-white px-2 text-sm ${person.placeholder ? 'italic text-neutral-500' : ''}`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        data-testid="avatar"
        data-unclaimed={unclaimed ? 'true' : 'false'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs ${unclaimed ? 'border-2 border-dashed border-neutral-400 text-neutral-400' : 'bg-neutral-200 text-neutral-700'}`}
      >
        {photoUrl ? <img src={photoUrl} alt={name} className="h-full w-full object-cover" /> : initials(person.placeholder ? null : person.display_name)}
      </span>
      <span className="truncate">{name}</span>
      <span className="ml-auto text-xs text-neutral-500">&#39;{String(person.grad_year).slice(-2)}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
```

- [ ] **Step 4: Implement LinGraph**

Create `web/src/components/graph/LinGraph.tsx`:
```tsx
'use client'
import { useEffect, useMemo } from 'react'
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LinGraph as LinGraphData } from '@/lib/types'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements, type PersonFlowNode } from '@/lib/graph/flow'
import { PersonNode } from '@/components/graph/PersonNode'

const nodeTypes = { person: PersonNode }

type Props = {
  graph: LinGraphData
  photoUrls: Map<string, string>
  selectedId: string | null
  onSelect: (personId: string) => void
  linKey: string
}

function Canvas({ graph, photoUrls, selectedId, onSelect, linKey }: Props) {
  const layout = useMemo(() => layoutLin(graph), [graph])
  const { nodes, edges } = useMemo(() => buildFlowElements(graph, layout, { selectedId, photoUrls }), [graph, layout, selectedId, photoUrls])
  const { fitView, setCenter, getNode } = useReactFlow()

  useEffect(() => { const t = setTimeout(() => fitView({ padding: 0.2 }), 0); return () => clearTimeout(t) }, [linKey, fitView])

  useEffect(() => {
    if (!selectedId) return
    const n = getNode(selectedId)
    if (n) setCenter(n.position.x + 90, n.position.y + 20, { zoom: 1.2, duration: 400 })
  }, [selectedId, getNode, setCenter])

  const onNodeClick: NodeMouseHandler<PersonFlowNode> = (_e, node) => onSelect(node.id)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

export function LinGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 5: Run tests and lint**

```bash
npm test && npm run lint
```
Expected: 33 tests passing. If lint flags `<img>` (Next's `no-img-element` rule), keep `<img>` — signed URLs change hourly and are not a `next/image` domain — and add `// eslint-disable-next-line @next/next/no-img-element` above it.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): PersonNode pill and LinGraph canvas"
```

---

### Task 6: Main screen — lin tabs, search, viewer menu, URL-synced selection

**Files:**
- Create: `web/src/components/LinTabs.tsx`, `web/src/components/LinTabs.test.tsx`, `web/src/components/SearchBox.tsx`, `web/src/components/SearchBox.test.tsx`, `web/src/components/TopBar.tsx`, `web/src/lib/hooks/useLinGraph.ts`
- Modify: `web/src/app/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `fetchLins`, `fetchLinGraph`, `fetchLinsOf`, `searchPeople`, `signedPhotoUrls`, `useViewer`, `LinGraph`.
- Produces: `<LinTabs lins selectedId onSelect />`; `<SearchBox search={(q) => Promise<PersonHit[]>} onPick={(hit) => void} />`; `<TopBar lins selectedLinId onSelectLin search onPick />`; `useLinGraph(linId) -> { graph, photoUrls, loading, error, reload }`. The page owns `lin` and `person` as URL query params (`/?lin=<id>&person=<id>`). A `SidePanel` slot renders a minimal placeholder that Task 7 replaces.

- [ ] **Step 1: Write the failing component tests**

Create `web/src/components/LinTabs.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LinTabs } from '@/components/LinTabs'

const lins = [
  { id: 'a', name: 'Wang Lin', color: '#6366f1', founder_id: 'f1' },
  { id: 'b', name: 'Wu Lin', color: '#14b8a6', founder_id: 'f2' },
]

describe('LinTabs', () => {
  it('renders a tab per lin and marks the selected one', () => {
    render(<LinTabs lins={lins} selectedId="b" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Wang Lin' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Wu Lin' })).toHaveAttribute('aria-selected', 'true')
  })
  it('calls onSelect with the lin id', () => {
    const onSelect = vi.fn()
    render(<LinTabs lins={lins} selectedId="a" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Wu Lin' }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })
})
```

Create `web/src/components/SearchBox.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBox } from '@/components/SearchBox'

describe('SearchBox', () => {
  it('searches after typing and picks a result', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onPick = vi.fn()
    render(<SearchBox search={search} onPick={onPick} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ali' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('ali'))
    const option = await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.click(option)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })
  it('shows an empty state', async () => {
    const search = vi.fn().mockResolvedValue([])
    render(<SearchBox search={search} onPick={() => {}} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(await screen.findByText('No one found')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: two files fail on missing modules.

- [ ] **Step 3: Implement LinTabs and SearchBox**

Create `web/src/components/LinTabs.tsx`:
```tsx
'use client'
import type { Lin } from '@/lib/types'

export function LinTabs({ lins, selectedId, onSelect }: { lins: Lin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto">
      {lins.map(lin => {
        const selected = lin.id === selectedId
        return (
          <button
            key={lin.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(lin.id)}
            style={{ borderColor: lin.color, backgroundColor: selected ? lin.color : undefined, color: selected ? '#fff' : undefined }}
            className="whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm"
          >
            {lin.name}
          </button>
        )
      })}
    </div>
  )
}
```

Create `web/src/components/SearchBox.tsx`:
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { PersonHit } from '@/lib/api/people'

export function SearchBox({ search, onPick, placeholder = 'Find a person' }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PersonHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!q.trim()) { setHits(null); return }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await search(q)
        if (mine === seq.current) { setHits(r); setError(null) }
      } catch (e) {
        if (mine === seq.current) setError(e instanceof Error ? e.message : 'Search failed')
      }
    }, 150)
    return () => clearTimeout(t)
  }, [q, search])

  return (
    <div className="relative">
      <input
        type="search"
        role="searchbox"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-56 rounded-md border px-2 py-1 text-sm"
      />
      {(hits || error) && (
        <ul role="listbox" className="absolute z-20 mt-1 w-72 rounded-md border bg-white shadow">
          {error && <li className="px-2 py-1 text-sm text-red-700">{error}</li>}
          {hits && hits.length === 0 && <li className="px-2 py-1 text-sm text-neutral-500">No one found</li>}
          {hits?.map(h => (
            <li key={h.id} role="option" aria-selected={false}
                onClick={() => { onPick(h); setQ(''); setHits(null) }}
                className="cursor-pointer px-2 py-1 text-sm hover:bg-neutral-100">
              {h.display_name} <span className="text-neutral-500">&#39;{String(h.grad_year).slice(-2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TopBar, hook, and page**

Create `web/src/components/TopBar.tsx`:
```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Lin } from '@/lib/types'
import type { PersonHit } from '@/lib/api/people'
import { LinTabs } from '@/components/LinTabs'
import { SearchBox } from '@/components/SearchBox'
import { useViewer } from '@/lib/viewer'

export function TopBar({ lins, selectedLinId, onSelectLin, search, onPick, onOpenSelf }: {
  lins: Lin[]
  selectedLinId: string | null
  onSelectLin: (id: string) => void
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  onOpenSelf: () => void
}) {
  const v = useViewer()
  const [open, setOpen] = useState(false)
  return (
    <header className="flex items-center gap-4 border-b px-4 py-2">
      <span className="font-semibold">CSA Lins</span>
      <LinTabs lins={lins} selectedId={selectedLinId} onSelect={onSelectLin} />
      <div className="ml-auto flex items-center gap-3">
        <SearchBox search={search} onPick={onPick} />
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} aria-label="Account menu" className="relative rounded-full border px-2 py-1 text-sm">
            {v.email ?? '…'}
            {v.pendingCount > 0 && (
              <span aria-label={`${v.pendingCount} pending requests`} className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{v.pendingCount}</span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-white text-sm shadow">
              {v.personId
                ? <button className="block w-full px-3 py-2 text-left hover:bg-neutral-100" onClick={() => { setOpen(false); onOpenSelf() }}>My profile</button>
                : <p className="px-3 py-2 text-neutral-500">You&#39;re not on a lin yet. Ask a CSA board member to add you.</p>}
              {v.isAdmin && <Link href="/admin" className="block px-3 py-2 hover:bg-neutral-100">Admin</Link>}
              <button className="block w-full px-3 py-2 text-left hover:bg-neutral-100" onClick={v.signOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
```

Create `web/src/lib/hooks/useLinGraph.ts`:
```ts
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchLinGraph } from '@/lib/api/graph'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { LinGraph } from '@/lib/types'

const EMPTY: LinGraph = { people: [], links: [] }

export function useLinGraph(linId: string | null) {
  const sb = useMemo(() => createClient(), [])
  const [graph, setGraph] = useState<LinGraph>(EMPTY)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!linId) { setGraph(EMPTY); return }
    setLoading(true); setError(null)
    try {
      const g = await fetchLinGraph(sb, linId)
      setGraph(g)
      setPhotoUrls(await signedPhotoUrls(sb, g.people.map(p => p.photo_path).filter((p): p is string => !!p)))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sb, linId])

  useEffect(() => { void reload() }, [reload])
  return { graph, photoUrls, loading, error, reload }
}
```

Replace `web/src/app/page.tsx`:
```tsx
'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLins, fetchLinsOf } from '@/lib/api/lins'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { useLinGraph } from '@/lib/hooks/useLinGraph'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { Lin } from '@/lib/types'
import { TopBar } from '@/components/TopBar'
import { LinGraph } from '@/components/graph/LinGraph'
import { SidePanel } from '@/components/panel/SidePanel'

function Home() {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const router = useRouter()
  const params = useSearchParams()
  const linId = params.get('lin')
  const personId = params.get('person')

  const [lins, setLins] = useState<Lin[]>([])
  const [error, setError] = useState<string | null>(null)
  const { graph, photoUrls, loading, error: graphError, reload } = useLinGraph(linId)

  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }) => {
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    router.replace(`/?${q.toString()}`)
  }, [params, router])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    ;(async () => {
      try {
        const all = await fetchLins(sb)
        setLins(all)
        if (!linId && all.length > 0) {
          const mine = viewer.personId ? await fetchLinsOf(sb, viewer.personId) : []
          setQuery({ lin: mine[0] ?? all[0].id })
        }
      } catch (e) { setError(errorMessage(e)) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    try {
      const inCurrent = graph.people.some(p => p.id === id)
      if (inCurrent) { setQuery({ person: id }); return }
      const theirs = await fetchLinsOf(sb, id)
      setQuery({ lin: theirs[0] ?? linId, person: id })
    } catch (e) { setError(errorMessage(e)) }
  }, [graph.people, linId, sb, setQuery])

  const search = useCallback((q: string) => searchPeople(sb, q), [sb])
  const onPick = useCallback((hit: PersonHit) => { void openPerson(hit.id) }, [openPerson])

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        lins={lins}
        selectedLinId={linId}
        onSelectLin={id => setQuery({ lin: id, person: null })}
        search={search}
        onPick={onPick}
        onOpenSelf={() => { if (viewer.personId) void openPerson(viewer.personId) }}
      />
      {(error || graphError) && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error ?? graphError}</p>}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {loading && <p className="absolute left-4 top-2 z-10 text-sm text-neutral-500">Loading…</p>}
          {linId && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={linId} />}
        </div>
        {personId && (
          <SidePanel
            personId={personId}
            graph={graph}
            photoUrls={photoUrls}
            lins={lins}
            currentLinId={linId}
            onSelectPerson={id => { void openPerson(id) }}
            onSelectLin={id => setQuery({ lin: id })}
            onClose={() => setQuery({ person: null })}
            onGraphChanged={reload}
          />
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
```

Create a minimal `web/src/components/panel/SidePanel.tsx` so the page compiles (Task 7 replaces it entirely):
```tsx
'use client'
import type { Lin, LinGraph } from '@/lib/types'

export type SidePanelProps = {
  personId: string
  graph: LinGraph
  photoUrls: Map<string, string>
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
  onClose: () => void
  onGraphChanged: () => Promise<void> | void
}

export function SidePanel({ personId, graph, onClose }: SidePanelProps) {
  const p = graph.people.find(x => x.id === personId)
  return (
    <aside className="w-80 border-l p-4">
      <button onClick={onClose} className="text-sm">Close</button>
      <p className="mt-2 font-semibold">{p?.display_name ?? 'Loading…'}</p>
    </aside>
  )
}
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
npm run dev
```
Expected: 37 tests passing. In the browser as alice: the Wang Lin tab is selected by default (she is its founder), a five-row graph appears with name pills, Frank Lin sits below both Derek and Ivy with two incoming edges, the Wu Lin tab switches graphs, clicking a pill opens the placeholder panel and puts `person=` in the URL, searching "ivy" and picking her switches to Wu Lin with Ivy selected. Sign in as bob: the account menu shows no Admin link.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): main screen with lin tabs, search, account menu, URL-synced selection"
```

---

### Task 7: Side panel in view mode

**Files:**
- Create: `web/src/components/panel/ProfileView.tsx`, `web/src/components/panel/ProfileView.test.tsx`, `web/src/lib/hooks/usePersonDetails.ts`
- Modify: `web/src/components/panel/SidePanel.tsx` (replace the Task 6 stub)

**Interfaces:**
- Consumes: `fetchPerson`, `fetchPeopleByIds`, `fetchLinksFor`, `splitLinks`, `fetchLinsOf`, `signedPhotoUrls`, `useViewer`.
- Produces:
  - `usePersonDetails(personId) -> { person, bigs, littles, incoming, outgoing, linIds, photoUrl, loading, error, reload }` where `bigs`/`littles` are `{ link: Link; person: Person }[]` and `incoming`/`outgoing` are the same shape for pending links (the other party in `person`).
  - `<ProfileView person photoUrl bigs littles lins currentLinId onSelectPerson onSelectLin />` — pure presentational.
  - `SidePanel` keeps the props type from Task 6 and adds an `isSelf` branch that renders the Task 8/9 controls (`ProfileEditor`, `LinkRequests`) — in this task those slots render nothing; Task 8 and 9 fill them.

- [ ] **Step 1: Write the failing ProfileView test**

Create `web/src/components/panel/ProfileView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileView } from '@/components/panel/ProfileView'
import type { Person, Link } from '@/lib/types'

const person = (id: string, name: string, year: number, extra: Partial<Person> = {}): Person => ({
  id, display_name: name, grad_year: year, penn_email: null, personal_email: null, auth_user_id: null, claimed_at: null,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra,
})
const link = (id: string, big: string, little: string): Link => ({
  id, big_id: big, little_id: little, status: 'confirmed', proposed_by: null, confirmed_by: null, confirmed_at: null, academic_year: '2023-24', created_at: '2026-01-01T00:00:00Z',
})
const lins = [{ id: 'a', name: 'Wang Lin', color: '#6366f1', founder_id: 'x' }, { id: 'b', name: 'Wu Lin', color: '#14b8a6', founder_id: 'y' }]

describe('ProfileView', () => {
  const me = person('me', 'Derek Zhang', 2024, { major: 'Econ', hometown: 'Queens, NY', bio: 'hi', instagram: 'dz', linkedin: 'https://linkedin.com/in/dz' })
  const props = {
    person: me, photoUrl: null,
    bigs: [{ link: link('l1', 'b1', 'me'), person: person('b1', 'Bob Chen', 2023) }],
    littles: [{ link: link('l2', 'me', 'k1'), person: person('k1', 'Frank Lin', 2025) }],
    lins, currentLinId: 'a', onSelectPerson: vi.fn(), onSelectLin: vi.fn(),
  }
  it('shows profile fields and socials', () => {
    render(<ProfileView {...props} />)
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
    expect(screen.getByText(/Econ/)).toBeInTheDocument()
    expect(screen.getByText(/Queens, NY/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '@dz' })).toHaveAttribute('href', 'https://instagram.com/dz')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://linkedin.com/in/dz')
  })
  it('lists bigs and littles as clickable pills', () => {
    render(<ProfileView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Bob Chen/ }))
    expect(props.onSelectPerson).toHaveBeenCalledWith('b1')
    fireEvent.click(screen.getByRole('button', { name: /Frank Lin/ }))
    expect(props.onSelectPerson).toHaveBeenCalledWith('k1')
  })
  it('shows lins and switches on click', () => {
    render(<ProfileView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wu Lin' }))
    expect(props.onSelectLin).toHaveBeenCalledWith('b')
  })
  it('shows an unclaimed note', () => {
    render(<ProfileView {...props} person={{ ...me, claimed_at: null }} />)
    expect(screen.getByText(/hasn.t claimed/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```
Expected: fails on missing `@/components/panel/ProfileView`.

- [ ] **Step 3: Implement ProfileView**

Create `web/src/components/panel/ProfileView.tsx`:
```tsx
'use client'
import type { Lin, Link, Person } from '@/lib/types'
import { yearColor } from '@/lib/graph/colors'
import { initials } from '@/components/graph/PersonNode'

export type Related = { link: Link; person: Person }

function PersonPill({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ borderColor: yearColor(p.grad_year) }}
      className="rounded-full border-2 px-2 py-0.5 text-sm hover:bg-neutral-50">
      {p.display_name} <span className="text-neutral-500">&#39;{String(p.grad_year).slice(-2)}</span>
    </button>
  )
}

export function ProfileView({ person, photoUrl, bigs, littles, lins, currentLinId, onSelectPerson, onSelectLin }: {
  person: Person
  photoUrl: string | null
  bigs: Related[]
  littles: Related[]
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl} alt={person.display_name} className="h-full w-full object-cover" /> : initials(person.display_name)}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{person.display_name}</h2>
          <p className="text-sm text-neutral-600">Class of {person.grad_year}{person.major ? ` · ${person.major}` : ''}</p>
          {!person.claimed_at && <p className="text-xs text-neutral-500">Hasn&#39;t claimed their profile yet</p>}
        </div>
      </div>

      {(person.hometown || person.bio) && (
        <div className="text-sm">
          {person.hometown && <p className="text-neutral-600">From {person.hometown}</p>}
          {person.bio && <p className="mt-1 whitespace-pre-wrap">{person.bio}</p>}
        </div>
      )}

      {(person.instagram || person.linkedin) && (
        <div className="flex gap-3 text-sm">
          {person.instagram && <a className="underline" href={`https://instagram.com/${person.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{person.instagram.replace(/^@/, '')}</a>}
          {person.linkedin && <a className="underline" href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
        </div>
      )}

      {lins.length > 0 && (
        <div>
          <p className="text-xs uppercase text-neutral-500">Lins</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {lins.map(l => (
              <button key={l.id} onClick={() => onSelectLin(l.id)} aria-current={l.id === currentLinId}
                style={{ borderColor: l.color, backgroundColor: l.id === currentLinId ? l.color : undefined, color: l.id === currentLinId ? '#fff' : undefined }}
                className="rounded-full border-2 px-2 py-0.5 text-xs">{l.name}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase text-neutral-500">Bigs</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {bigs.length === 0 && <span className="text-sm text-neutral-500">None recorded</span>}
          {bigs.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase text-neutral-500">Littles</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {littles.length === 0 && <span className="text-sm text-neutral-500">None recorded</span>}
          {littles.map(r => <PersonPill key={r.link.id} p={r.person} onClick={() => onSelectPerson(r.person.id)} />)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Details hook and SidePanel**

Create `web/src/lib/hooks/usePersonDetails.ts`:
```ts
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPerson, fetchPeopleByIds } from '@/lib/api/people'
import { fetchLinksFor, splitLinks } from '@/lib/api/links'
import { fetchLinsOf } from '@/lib/api/lins'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { Link, Person } from '@/lib/types'
import type { Related } from '@/components/panel/ProfileView'

export function usePersonDetails(personId: string) {
  const sb = useMemo(() => createClient(), [])
  const [person, setPerson] = useState<Person | null>(null)
  const [bigs, setBigs] = useState<Related[]>([])
  const [littles, setLittles] = useState<Related[]>([])
  const [incoming, setIncoming] = useState<Related[]>([])
  const [outgoing, setOutgoing] = useState<Related[]>([])
  const [linIds, setLinIds] = useState<string[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, links, lins] = await Promise.all([fetchPerson(sb, personId), fetchLinksFor(sb, personId), fetchLinsOf(sb, personId)])
      setPerson(p)
      setLinIds(lins)
      const other = (l: Link) => (l.big_id === personId ? l.little_id : l.big_id)
      const people = await fetchPeopleByIds(sb, [...new Set(links.map(other))])
      const byId = new Map(people.map(x => [x.id, x]))
      const join = (ls: Link[]): Related[] => ls.flatMap(l => { const q = byId.get(other(l)); return q ? [{ link: l, person: q }] : [] })
      const s = splitLinks(links, personId)
      setBigs(join(s.confirmedBigs)); setLittles(join(s.confirmedLittles))
      setIncoming(join(s.incoming)); setOutgoing(join(s.outgoing))
      setPhotoUrl(p?.photo_path ? (await signedPhotoUrls(sb, [p.photo_path])).get(p.photo_path) ?? null : null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sb, personId])

  useEffect(() => { void reload() }, [reload])
  return { person, bigs, littles, incoming, outgoing, linIds, photoUrl, loading, error, reload }
}
```

Replace `web/src/components/panel/SidePanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import type { Lin, LinGraph } from '@/lib/types'
import { useViewer } from '@/lib/viewer'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'
import { ProfileView } from '@/components/panel/ProfileView'

export type SidePanelProps = {
  personId: string
  graph: LinGraph
  photoUrls: Map<string, string>
  lins: Lin[]
  currentLinId: string | null
  onSelectPerson: (id: string) => void
  onSelectLin: (id: string) => void
  onClose: () => void
  onGraphChanged: () => Promise<void> | void
}

export function SidePanel(props: SidePanelProps) {
  const { personId, lins, currentLinId, onSelectPerson, onSelectLin, onClose } = props
  const viewer = useViewer()
  const d = usePersonDetails(personId)
  const [editing, setEditing] = useState(false)
  const isSelf = viewer.personId === personId
  const personLins = lins.filter(l => d.linIds.includes(l.id))

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto border-t bg-white p-4 shadow-lg md:static md:max-h-none md:w-80 md:border-l md:border-t-0 md:shadow-none">
      <div className="mb-2 flex items-center justify-between">
        {isSelf && !editing && <button className="text-sm underline" onClick={() => setEditing(true)}>Edit profile</button>}
        <button onClick={onClose} aria-label="Close panel" className="ml-auto text-sm text-neutral-500">Close</button>
      </div>
      {d.error && <p role="alert" className="text-sm text-red-700">{d.error}</p>}
      {d.loading && !d.person && <p className="text-sm text-neutral-500">Loading…</p>}
      {!d.loading && !d.person && !d.error && <p className="text-sm text-neutral-500">This person is not visible.</p>}
      {d.person && !editing && (
        <ProfileView person={d.person} photoUrl={d.photoUrl} bigs={d.bigs} littles={d.littles}
          lins={personLins} currentLinId={currentLinId} onSelectPerson={onSelectPerson} onSelectLin={onSelectLin} />
      )}
      {/* Task 8 renders <ProfileEditor> here when editing; Task 9 renders <LinkRequests> below the profile when isSelf. */}
      {d.person && editing && <p className="text-sm text-neutral-500">Editing arrives in the next task.</p>}
    </aside>
  )
}
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
```
Expected: 41 tests passing. In the browser: click Frank Lin; the panel shows both lins (Wang Lin highlighted), bigs Derek and Ivy, no littles. Clicking Ivy re-centers on her and the Wu Lin tab activates. Narrow the window below 768px: the panel becomes a bottom sheet.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): side panel with profile view, bigs/littles navigation, lin switching"
```

---

### Task 8: Own-profile editing and photo upload

**Files:**
- Create: `web/src/components/panel/ProfileEditor.tsx`, `web/src/components/panel/ProfileEditor.test.tsx`
- Modify: `web/src/components/panel/SidePanel.tsx` (render the editor)

**Interfaces:**
- Consumes: `updateOwnProfile`, `uploadOwnPhoto`, `validatePhoto`, `OwnProfilePatch`.
- Produces: `<ProfileEditor person onSave={(patch: OwnProfilePatch, photo: File | null) => Promise<void>} onCancel />`. The editor is pure; `SidePanel` wires `onSave` to upload the photo (if any), merge `photo_path` into the patch, call `updateOwnProfile`, then `reload()` and `onGraphChanged()`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/panel/ProfileEditor.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileEditor } from '@/components/panel/ProfileEditor'
import type { Person } from '@/lib/types'

const me: Person = {
  id: 'me', display_name: 'Derek Zhang', grad_year: 2024, penn_email: 'derek@upenn.edu', personal_email: null, auth_user_id: 'u', claimed_at: '2026-01-01T00:00:00Z',
  photo_path: null, major: 'Econ', hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('ProfileEditor', () => {
  it('submits only changed, allowed fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Hometown'), { target: { value: 'Queens, NY' } })
    fireEvent.change(screen.getByLabelText('Personal email'), { target: { value: 'Derek@Gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ hometown: 'Queens, NY', personal_email: 'derek@gmail.com' }, null))
  })
  it('rejects a bad photo before saving', async () => {
    const onSave = vi.fn()
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    const bad = new File([new Uint8Array(10)], 'x.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [bad] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPEG, PNG, or WebP/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })
  it('shows a save error verbatim', async () => {
    const onSave = vi.fn().mockRejectedValue({ message: 'not allowed to change protected fields' })
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Major'), { target: { value: 'Math' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed to change protected fields')
  })
  it('requires a name and a plausible grad year', async () => {
    const onSave = vi.fn()
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/name/i)
    expect(onSave).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```
Expected: fails on missing `@/components/panel/ProfileEditor`.

- [ ] **Step 3: Implement ProfileEditor**

Create `web/src/components/panel/ProfileEditor.tsx`:
```tsx
'use client'
import { useState, type FormEvent } from 'react'
import type { OwnProfilePatch, Person } from '@/lib/types'
import { validatePhoto } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'

const FIELDS: { key: keyof OwnProfilePatch; label: string; type?: string }[] = [
  { key: 'display_name', label: 'Name' },
  { key: 'grad_year', label: 'Grad year', type: 'number' },
  { key: 'major', label: 'Major' },
  { key: 'hometown', label: 'Hometown' },
  { key: 'personal_email', label: 'Personal email', type: 'email' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn URL', type: 'url' },
]

export function buildPatch(person: Person, form: Record<string, string>): OwnProfilePatch {
  const patch: OwnProfilePatch = {}
  for (const f of FIELDS) {
    const raw = form[f.key] ?? ''
    if (f.key === 'grad_year') {
      const n = Number(raw)
      if (n !== person.grad_year) patch.grad_year = n
      continue
    }
    let v: string | null = raw.trim() === '' ? null : raw.trim()
    if (f.key === 'personal_email' && v) v = v.toLowerCase()
    if (f.key === 'instagram' && v) v = v.replace(/^@/, '')
    if (v !== (person[f.key] ?? null)) (patch as Record<string, string | null>)[f.key] = v
  }
  const bio = form.bio ?? ''
  const b = bio.trim() === '' ? null : bio.trim()
  if (b !== (person.bio ?? null)) patch.bio = b
  return patch
}

export function ProfileEditor({ person, onSave, onCancel }: {
  person: Person
  onSave: (patch: OwnProfilePatch, photo: File | null) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    display_name: person.display_name, grad_year: String(person.grad_year), major: person.major ?? '', hometown: person.hometown ?? '',
    personal_email: person.personal_email ?? '', instagram: person.instagram ?? '', linkedin: person.linkedin ?? '', bio: person.bio ?? '',
  }))
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function onPhoto(files: FileList | null) {
    const f = files?.[0] ?? null
    if (!f) { setPhoto(null); setError(null); return }
    const problem = validatePhoto(f)
    setError(problem)
    setPhoto(problem ? null : f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (error) return
    if (form.display_name.trim() === '') { setError('Name is required'); return }
    const year = Number(form.grad_year)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) { setError('Grad year must be a four-digit year'); return }
    const patch = buildPatch(person, form)
    setSaving(true); setError(null)
    try { await onSave(patch, photo) } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      {FIELDS.map(f => (
        <label key={f.key} className="flex flex-col gap-0.5">
          <span className="text-xs uppercase text-neutral-500">{f.label}</span>
          <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="rounded border px-2 py-1" />
        </label>
      ))}
      <label className="flex flex-col gap-0.5">
        <span className="text-xs uppercase text-neutral-500">Bio</span>
        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="rounded border px-2 py-1" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-xs uppercase text-neutral-500">Photo</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onPhoto(e.target.files)} />
        <span className="text-xs text-neutral-500">JPEG, PNG, or WebP, up to 2 MB</span>
      </label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1">Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Wire the editor into SidePanel**

In `web/src/components/panel/SidePanel.tsx`:
- Add imports: `import { useMemo } from 'react'`, `import { createClient } from '@/lib/supabase/client'`, `import { updateOwnProfile } from '@/lib/api/people'`, `import { uploadOwnPhoto } from '@/lib/api/photos'`, `import { ProfileEditor } from '@/components/panel/ProfileEditor'`, `import type { OwnProfilePatch } from '@/lib/types'`.
- Inside the component add `const sb = useMemo(() => createClient(), [])` and:
```tsx
  async function save(patch: OwnProfilePatch, photo: File | null) {
    const full: OwnProfilePatch = { ...patch }
    if (photo) full.photo_path = await uploadOwnPhoto(sb, personId, photo)
    if (Object.keys(full).length > 0) await updateOwnProfile(sb, personId, full)
    setEditing(false)
    await d.reload()
    await props.onGraphChanged()
  }
```
- Replace the "Editing arrives in the next task." line with:
```tsx
      {d.person && editing && <ProfileEditor person={d.person} onSave={save} onCancel={() => setEditing(false)} />}
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
```
Expected: 45 tests passing. In the browser as bob: open My profile, Edit profile, set hometown and upload a small PNG, Save. The panel shows the new hometown and photo; the graph pill shows the photo. Sign in as alice and confirm the Edit button does not appear on Bob's profile. Trying to upload a 3 MB file shows the size message before saving.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): own-profile editor with photo upload"
```

---

### Task 9: Link requests — propose, accept, decline, withdraw, remove

**Files:**
- Create: `web/src/components/panel/LinkRequests.tsx`, `web/src/components/panel/LinkRequests.test.tsx`, `web/src/components/panel/AddLinkDialog.tsx`, `web/src/components/panel/AddLinkDialog.test.tsx`
- Modify: `web/src/components/panel/SidePanel.tsx`

**Interfaces:**
- Consumes: `searchPeople`, `findLinkBetween`, `proposeLink`, `acceptLink`, `deleteLink`, `useViewer().refresh`.
- Produces:
  - `<LinkRequests me incoming outgoing bigs littles onAccept(link) onDecline(link) onWithdraw(link) onRemove(link) />` — pure.
  - `<AddLinkDialog role="big"|"little" search onExisting(link) onPropose(otherId) onClose />` — pure; `onExisting` is called when `findLinkBetween` (passed in as `check`) finds a row.
  - `describeExisting(link, me): string` — "already confirmed" / "already requested by you" / "already requested by them".

- [ ] **Step 1: Write the failing tests**

Create `web/src/components/panel/LinkRequests.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LinkRequests, describeExisting } from '@/components/panel/LinkRequests'
import type { Link, Person } from '@/lib/types'

const person = (id: string, name: string): Person => ({
  id, display_name: name, grad_year: 2024, penn_email: null, personal_email: null, auth_user_id: null, claimed_at: null,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null,
  created_at: '', updated_at: '',
})
const link = (id: string, big: string, little: string, status: 'pending' | 'confirmed', proposed_by: string | null): Link => ({
  id, big_id: big, little_id: little, status, proposed_by, confirmed_by: null, confirmed_at: null, academic_year: null, created_at: '',
})

describe('LinkRequests', () => {
  const handlers = { onAccept: vi.fn(), onDecline: vi.fn(), onWithdraw: vi.fn(), onRemove: vi.fn() }
  const props = {
    me: 'me',
    incoming: [{ link: link('i1', 'x', 'me', 'pending', 'x'), person: person('x', 'Xavier') }],
    outgoing: [{ link: link('o1', 'me', 'y', 'pending', 'me'), person: person('y', 'Yara') }],
    bigs: [{ link: link('b1', 'z', 'me', 'confirmed', null), person: person('z', 'Zed') }],
    littles: [],
    ...handlers,
  }
  it('describes incoming requests with the right role and offers accept/decline', () => {
    render(<LinkRequests {...props} />)
    expect(screen.getByText(/Xavier wants to be your big/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handlers.onAccept).toHaveBeenCalledWith(props.incoming[0].link)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(handlers.onDecline).toHaveBeenCalledWith(props.incoming[0].link)
  })
  it('lets me withdraw an outgoing request and remove a confirmed link', () => {
    render(<LinkRequests {...props} />)
    expect(screen.getByText(/Waiting for Yara/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(handlers.onWithdraw).toHaveBeenCalledWith(props.outgoing[0].link)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Zed' }))
    expect(handlers.onRemove).toHaveBeenCalledWith(props.bigs[0].link)
  })
})

describe('describeExisting', () => {
  it('names the state of an existing link', () => {
    expect(describeExisting(link('1', 'a', 'me', 'confirmed', null), 'me')).toBe('This link is already confirmed')
    expect(describeExisting(link('2', 'a', 'me', 'pending', 'me'), 'me')).toBe('You already requested this link')
    expect(describeExisting(link('3', 'a', 'me', 'pending', 'a'), 'me')).toBe('They already requested this link; accept it below')
  })
})
```

Create `web/src/components/panel/AddLinkDialog.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddLinkDialog } from '@/components/panel/AddLinkDialog'

const hit = { id: 'p9', display_name: 'Nina Lu', grad_year: 2023, hidden: false }

describe('AddLinkDialog', () => {
  it('proposes after picking a person with no existing link', async () => {
    const search = vi.fn().mockResolvedValue([hit])
    const check = vi.fn().mockResolvedValue(null)
    const onPropose = vi.fn().mockResolvedValue(undefined)
    render(<AddLinkDialog role="big" search={search} check={check} onPropose={onPropose} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nin' } })
    fireEvent.click(await screen.findByRole('option', { name: /Nina Lu/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(onPropose).toHaveBeenCalledWith('p9'))
  })
  it('shows the existing link instead of proposing', async () => {
    const search = vi.fn().mockResolvedValue([hit])
    const check = vi.fn().mockResolvedValue({ id: 'l', big_id: 'p9', little_id: 'me', status: 'confirmed', proposed_by: null, confirmed_by: null, confirmed_at: null, academic_year: null, created_at: '' })
    const onPropose = vi.fn()
    render(<AddLinkDialog role="big" search={search} check={check} onPropose={onPropose} onClose={() => {}} me="me" />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nin' } })
    fireEvent.click(await screen.findByRole('option', { name: /Nina Lu/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already confirmed')
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
    expect(onPropose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: both files fail on missing modules.

- [ ] **Step 3: Implement LinkRequests and AddLinkDialog**

Create `web/src/components/panel/LinkRequests.tsx`:
```tsx
'use client'
import type { Link } from '@/lib/types'
import type { Related } from '@/components/panel/ProfileView'

export function describeExisting(link: Link, me: string): string {
  if (link.status === 'confirmed') return 'This link is already confirmed'
  if (link.proposed_by === me) return 'You already requested this link'
  return 'They already requested this link; accept it below'
}

export function LinkRequests({ me, incoming, outgoing, bigs, littles, onAccept, onDecline, onWithdraw, onRemove }: {
  me: string
  incoming: Related[]
  outgoing: Related[]
  bigs: Related[]
  littles: Related[]
  onAccept: (l: Link) => void
  onDecline: (l: Link) => void
  onWithdraw: (l: Link) => void
  onRemove: (l: Link) => void
}) {
  const roleOf = (l: Link) => (l.big_id === me ? 'little' : 'big')
  return (
    <div className="flex flex-col gap-3 text-sm">
      {incoming.length > 0 && (
        <div>
          <p className="text-xs uppercase text-neutral-500">Requests for you</p>
          <ul className="mt-1 flex flex-col gap-1">
            {incoming.map(r => (
              <li key={r.link.id} className="flex items-center gap-2">
                <span>{r.person.display_name} wants to be your {roleOf(r.link)}</span>
                <button onClick={() => onAccept(r.link)} className="ml-auto rounded bg-neutral-900 px-2 py-0.5 text-white">Accept</button>
                <button onClick={() => onDecline(r.link)} className="rounded border px-2 py-0.5">Decline</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="text-xs uppercase text-neutral-500">Your requests</p>
          <ul className="mt-1 flex flex-col gap-1">
            {outgoing.map(r => (
              <li key={r.link.id} className="flex items-center gap-2">
                <span>Waiting for {r.person.display_name} to confirm as your {roleOf(r.link)}</span>
                <button onClick={() => onWithdraw(r.link)} className="ml-auto rounded border px-2 py-0.5">Withdraw</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(bigs.length > 0 || littles.length > 0) && (
        <div>
          <p className="text-xs uppercase text-neutral-500">Remove a link</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {[...bigs, ...littles].map(r => (
              <li key={r.link.id}>
                <button onClick={() => onRemove(r.link)} aria-label={`Remove ${r.person.display_name}`} className="rounded border px-2 py-0.5 text-neutral-600">
                  {r.person.display_name} ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

Create `web/src/components/panel/AddLinkDialog.tsx`:
```tsx
'use client'
import { useState } from 'react'
import type { Link } from '@/lib/types'
import type { PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'
import { describeExisting } from '@/components/panel/LinkRequests'
import { errorMessage } from '@/lib/errors'

export function AddLinkDialog({ role, me = 'me', search, check, onPropose, onClose }: {
  role: 'big' | 'little'
  me?: string
  search: (q: string) => Promise<PersonHit[]>
  check: (otherId: string) => Promise<Link | null>
  onPropose: (otherId: string) => Promise<void>
  onClose: () => void
}) {
  const [picked, setPicked] = useState<PersonHit | null>(null)
  const [existing, setExisting] = useState<Link | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(h: PersonHit) {
    setPicked(h); setExisting(null); setError(null)
    try { setExisting(await check(h.id)) } catch (e) { setError(errorMessage(e)) }
  }
  async function send() {
    if (!picked) return
    setBusy(true); setError(null)
    try { await onPropose(picked.id); onClose() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-2">Add a {role}</p>
      <SearchBox search={search} onPick={pick} placeholder={`Who is your ${role}?`} />
      {picked && <p className="mt-2">Selected: {picked.display_name}</p>}
      {existing && <p role="alert" className="mt-1 text-amber-700">{describeExisting(existing, me)}</p>}
      {error && <p role="alert" className="mt-1 text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        {picked && !existing && <button onClick={send} disabled={busy} className="rounded bg-neutral-900 px-2 py-1 text-white disabled:opacity-50">Send request</button>}
        <button onClick={onClose} className="rounded border px-2 py-1">Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire into SidePanel**

In `web/src/components/panel/SidePanel.tsx` add imports for `LinkRequests`, `AddLinkDialog`, `searchPeople`, `findLinkBetween`, `proposeLink`, `acceptLink`, `deleteLink`, and `useCallback`. Add state `const [adding, setAdding] = useState<'big' | 'little' | null>(null)` and `const [actionError, setActionError] = useState<string | null>(null)`. Add:
```tsx
  const afterChange = useCallback(async () => { await d.reload(); await props.onGraphChanged(); await viewer.refresh() }, [d, props, viewer])
  async function run(fn: () => Promise<void>) { setActionError(null); try { await fn(); await afterChange() } catch (e) { setActionError(errorMessage(e)) } }
```
(import `errorMessage`). Below the `ProfileView` block, when `isSelf && d.person && !editing`, render:
```tsx
        <div className="mt-4 flex flex-col gap-3">
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <LinkRequests me={personId} incoming={d.incoming} outgoing={d.outgoing} bigs={d.bigs} littles={d.littles}
            onAccept={l => run(() => acceptLink(sb, l.id, personId))}
            onDecline={l => run(() => deleteLink(sb, l.id))}
            onWithdraw={l => run(() => deleteLink(sb, l.id))}
            onRemove={l => { if (window.confirm('Remove this link?')) void run(() => deleteLink(sb, l.id)) }} />
          {!adding && (
            <div className="flex gap-2 text-sm">
              <button onClick={() => setAdding('big')} className="rounded border px-2 py-1">Add a big</button>
              <button onClick={() => setAdding('little')} className="rounded border px-2 py-1">Add a little</button>
            </div>
          )}
          {adding && (
            <AddLinkDialog role={adding} me={personId}
              search={q => searchPeople(sb, q)}
              check={other => findLinkBetween(sb, personId, other)}
              onPropose={async other => {
                const bigId = adding === 'big' ? other : personId
                const littleId = adding === 'big' ? personId : other
                await proposeLink(sb, { bigId, littleId, me: personId })
                await afterChange()
              }}
              onClose={() => setAdding(null)} />
          )}
        </div>
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
```
Expected: 51 tests passing. In the browser as bob: My profile → Add a little → search "grace" → Send request. Sign in as alice (admin, but here acting as a member): her profile shows no request (she is not the party). Sign in as grace? There is no grace dev login; instead as bob, Withdraw the request, then Add a big → pick Alice → Send. Sign in as alice: the account badge shows 1; My profile shows "Bob Chen wants to be your little"; Accept. The graph now shows Bob under Alice twice? No: Alice → Bob already exists in the seed, so the dialog must have shown "already confirmed" and no Send button. Use Cathy instead: as bob, Add a big → Cathy → Send; as alice, nothing pending; as bob, Withdraw. Finally as bob, Add a big → Alice: expect "This link is already confirmed".

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): link requests — propose, accept, decline, withdraw, remove"
```

---

### Task 10: Admin screen — people table, add person, CSV bulk add

**Files:**
- Create: `web/src/lib/csv.ts`, `web/src/lib/csv.test.ts`, `web/src/lib/api/admin.ts`, `web/src/app/admin/page.tsx`, `web/src/components/admin/AdminTabs.tsx`, `web/src/components/admin/PeopleTable.tsx`, `web/src/components/admin/AddPersonForm.tsx`, `web/src/components/admin/AddPersonForm.test.tsx`, `web/src/components/admin/BulkAddForm.tsx`

**Interfaces:**
- Consumes: `useViewer`, `searchPeople`, `Person`.
- Produces:
  - `parsePeopleCsv(text): { rows: NewPerson[]; errors: string[] }` where `NewPerson = { display_name: string; grad_year: number; penn_email: string | null }`. Accepts `name, grad_year, penn_email` per line (comma or tab separated), skips blank lines and a header line whose first cell is `name` (case-insensitive), trims cells, lowercases emails, rejects rows with a non-4-digit year or an email lacking `@`, and reports errors with 1-based line numbers.
  - `admin.ts`: `listPeople(sb, { q, includeHidden }): Promise<Person[]>` (ordered by grad_year desc, display_name); `insertPeople(sb, rows: NewPerson[]): Promise<Person[]>`; `adminUpdatePerson(sb, id, patch: AdminPersonPatch)` where `AdminPersonPatch = Partial<Pick<Person,'display_name'|'grad_year'|'penn_email'|'personal_email'|'hidden'|'major'|'hometown'|'bio'|'instagram'|'linkedin'>>`; `insertConfirmedLink(sb, { bigId, littleId, academicYear })`; `listPendingLinks(sb)`; `adminResolveLink(sb, id, decision: 'accept'|'reject', adminId)`; `listLins(sb)`; `upsertLin(sb, lin: { id?: string; name; color; founder_id })`; `deleteLin(sb, id)`; `listAdmins(sb): Promise<(Person & { granted_at: string })[]>`; `promote(sb, personId, byId)`; `demote(sb, personId)`; `mergePeople(sb, survivor, duplicate)`; `listChangelog(sb, { before?: number; limit }): Promise<ChangelogRow[]>`.
  - `/admin` page with tabs People, Links, Lins, Requests, Admins, Merge, Changelog; non-admins are redirected to `/`. This task fills People; Task 11 fills the rest (they render "Coming in Task 11" placeholders here).
  - `<AddPersonForm nearMatches={(name) => Promise<PersonHit[]>} onAdd={(row: NewPerson) => Promise<void>} />` — warns with near matches before the admin confirms.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parsePeopleCsv } from '@/lib/csv'

describe('parsePeopleCsv', () => {
  it('parses comma and tab rows, skipping header and blanks', () => {
    const text = 'name,grad_year,penn_email\nAlice Wang, 2022, Alice@UPenn.edu\n\nBob Chen\t2023\tbob@seas.upenn.edu\nCathy Liu,2023,'
    const { rows, errors } = parsePeopleCsv(text)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { display_name: 'Alice Wang', grad_year: 2022, penn_email: 'alice@upenn.edu' },
      { display_name: 'Bob Chen', grad_year: 2023, penn_email: 'bob@seas.upenn.edu' },
      { display_name: 'Cathy Liu', grad_year: 2023, penn_email: null },
    ])
  })
  it('reports bad rows with line numbers and keeps good ones', () => {
    const { rows, errors } = parsePeopleCsv('Ann,20x2,a@upenn.edu\nBen,2024,not-an-email\nCal,2025,c@upenn.edu\n,2025,d@upenn.edu')
    expect(rows.map(r => r.display_name)).toEqual(['Cal'])
    expect(errors).toEqual([
      'Line 1: grad year must be a four-digit year',
      'Line 2: email must contain @',
      'Line 4: name is required',
    ])
  })
})
```

Create `web/src/components/admin/AddPersonForm.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddPersonForm } from '@/components/admin/AddPersonForm'

describe('AddPersonForm', () => {
  it('warns about near matches and still allows adding', async () => {
    const nearMatches = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<AddPersonForm nearMatches={nearMatches} onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice Wong' } })
    fireEvent.blur(screen.getByLabelText('Name'))
    expect(await screen.findByText(/Similar names already exist/)).toBeInTheDocument()
    expect(screen.getByText(/Alice Wang/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Grad year'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Penn email'), { target: { value: 'AWong@upenn.edu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ display_name: 'Alice Wong', grad_year: 2026, penn_email: 'awong@upenn.edu' }))
  })
  it('shows a database error verbatim', async () => {
    const onAdd = vi.fn().mockRejectedValue({ message: 'duplicate key value violates unique constraint "people_penn_email_key"' })
    render(<AddPersonForm nearMatches={vi.fn().mockResolvedValue([])} onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dup' } })
    fireEvent.change(screen.getByLabelText('Grad year'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Penn email'), { target: { value: 'dup@upenn.edu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/people_penn_email_key/)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```
Expected: both files fail on missing modules.

- [ ] **Step 3: Implement csv.ts and admin.ts**

Create `web/src/lib/csv.ts`:
```ts
export type NewPerson = { display_name: string; grad_year: number; penn_email: string | null }

export function parsePeopleCsv(text: string): { rows: NewPerson[]; errors: string[] } {
  const rows: NewPerson[] = []
  const errors: string[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.trim() === '') return
    const cells = line.split(line.includes('\t') ? '\t' : ',').map(c => c.trim())
    if (i === 0 && cells[0]?.toLowerCase() === 'name') return
    const n = i + 1
    const [name = '', yearRaw = '', emailRaw = ''] = cells
    if (!name) { errors.push(`Line ${n}: name is required`); return }
    if (!/^\d{4}$/.test(yearRaw)) { errors.push(`Line ${n}: grad year must be a four-digit year`); return }
    const email = emailRaw ? emailRaw.toLowerCase() : null
    if (email && !email.includes('@')) { errors.push(`Line ${n}: email must contain @`); return }
    rows.push({ display_name: name, grad_year: Number(yearRaw), penn_email: email })
  })
  return { rows, errors }
}
```

Create `web/src/lib/api/admin.ts`:
```ts
import type { Supabase } from '@/lib/supabase/client'
import type { ChangelogRow, Lin, Link, Person } from '@/lib/types'
import type { NewPerson } from '@/lib/csv'

export type AdminPersonPatch = Partial<Pick<Person,
  'display_name' | 'grad_year' | 'penn_email' | 'personal_email' | 'hidden' | 'major' | 'hometown' | 'bio' | 'instagram' | 'linkedin'>>

export async function listPeople(sb: Supabase, opts: { q: string; includeHidden: boolean }): Promise<Person[]> {
  let query = sb.from('people').select('*').is('merged_into', null).order('grad_year', { ascending: false }).order('display_name')
  if (!opts.includeHidden) query = query.eq('hidden', false)
  if (opts.q.trim()) query = query.ilike('display_name', `%${opts.q.trim().replace(/[%_]/g, '')}%`)
  const { data, error } = await query.limit(500)
  if (error) throw error
  return data
}

export async function insertPeople(sb: Supabase, rows: NewPerson[]): Promise<Person[]> {
  const { data, error } = await sb.from('people').insert(rows).select('*')
  if (error) throw error
  return data
}

export async function adminUpdatePerson(sb: Supabase, id: string, patch: AdminPersonPatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}

export async function insertConfirmedLink(sb: Supabase, args: { bigId: string; littleId: string; academicYear: string | null }): Promise<void> {
  const { error } = await sb.from('links').insert({ big_id: args.bigId, little_id: args.littleId, status: 'confirmed', academic_year: args.academicYear })
  if (error) throw error
}

export async function listPendingLinks(sb: Supabase): Promise<Link[]> {
  const { data, error } = await sb.from('links').select('*').eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
}

export async function adminResolveLink(sb: Supabase, id: string, decision: 'accept' | 'reject', adminId: string): Promise<void> {
  const { error } = decision === 'accept'
    ? await sb.from('links').update({ status: 'confirmed', confirmed_by: adminId, confirmed_at: new Date().toISOString() }).eq('id', id)
    : await sb.from('links').delete().eq('id', id)
  if (error) throw error
}

export async function listLins(sb: Supabase): Promise<Lin[]> {
  const { data, error } = await sb.from('lins').select('id, name, color, founder_id').order('name')
  if (error) throw error
  return data
}

export async function upsertLin(sb: Supabase, lin: { id?: string; name: string; color: string; founder_id: string }): Promise<void> {
  const { error } = lin.id
    ? await sb.from('lins').update({ name: lin.name, color: lin.color, founder_id: lin.founder_id }).eq('id', lin.id)
    : await sb.from('lins').insert({ name: lin.name, color: lin.color, founder_id: lin.founder_id })
  if (error) throw error
}

export async function deleteLin(sb: Supabase, id: string): Promise<void> {
  const { error } = await sb.from('lins').delete().eq('id', id)
  if (error) throw error
}

export async function listAdmins(sb: Supabase): Promise<{ person: Person; granted_at: string }[]> {
  const { data, error } = await sb.from('admins').select('granted_at, person:people!admins_person_id_fkey(*)').order('granted_at')
  if (error) throw error
  return data.flatMap(r => (r.person ? [{ person: r.person as unknown as Person, granted_at: r.granted_at }] : []))
}

export async function promote(sb: Supabase, personId: string, byId: string): Promise<void> {
  const { error } = await sb.from('admins').insert({ person_id: personId, granted_by: byId })
  if (error) throw error
}

export async function demote(sb: Supabase, personId: string): Promise<void> {
  const { error } = await sb.from('admins').delete().eq('person_id', personId)
  if (error) throw error
}

export async function mergePeople(sb: Supabase, survivor: string, duplicate: string): Promise<void> {
  const { error } = await sb.rpc('merge_people', { survivor, duplicate })
  if (error) throw error
}

export async function listChangelog(sb: Supabase, opts: { before?: number; limit: number }): Promise<ChangelogRow[]> {
  let query = sb.from('changelog').select('*').order('id', { ascending: false }).limit(opts.limit)
  if (opts.before !== undefined) query = query.lt('id', opts.before)
  const { data, error } = await query
  if (error) throw error
  return data
}
```

If TypeScript rejects the `people!admins_person_id_fkey` embed name, open `src/lib/database.types.ts`, find the `admins` table's `Relationships` array, and use the `foreignKeyName` listed for `person_id`.

- [ ] **Step 4: Admin page shell, tabs, PeopleTable, AddPersonForm, BulkAddForm**

Create `web/src/components/admin/AdminTabs.tsx`:
```tsx
'use client'
export const ADMIN_TABS = ['People', 'Links', 'Lins', 'Requests', 'Admins', 'Merge', 'Changelog'] as const
export type AdminTab = typeof ADMIN_TABS[number]

export function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b pb-2">
      {ADMIN_TABS.map(t => (
        <button key={t} role="tab" aria-selected={t === tab} onClick={() => onChange(t)}
          className={`rounded-full px-3 py-1 text-sm ${t === tab ? 'bg-neutral-900 text-white' : 'border'}`}>{t}</button>
      ))}
    </div>
  )
}
```

Create `web/src/components/admin/AddPersonForm.tsx`:
```tsx
'use client'
import { useState, type FormEvent } from 'react'
import type { PersonHit } from '@/lib/api/people'
import type { NewPerson } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'

export function AddPersonForm({ nearMatches, onAdd }: {
  nearMatches: (name: string) => Promise<PersonHit[]>
  onAdd: (row: NewPerson) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [email, setEmail] = useState('')
  const [similar, setSimilar] = useState<PersonHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function checkSimilar() {
    const words = name.trim().split(/\s+/).filter(w => w.length > 2)
    if (words.length === 0) { setSimilar([]); return }
    try {
      const hits = (await Promise.all(words.map(w => nearMatches(w)))).flat()
      const unique = [...new Map(hits.map(h => [h.id, h])).values()]
      setSimilar(unique.slice(0, 5))
    } catch { setSimilar([]) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null); setDone(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!/^\d{4}$/.test(year)) { setError('Grad year must be a four-digit year'); return }
    const row: NewPerson = { display_name: name.trim(), grad_year: Number(year), penn_email: email.trim() ? email.trim().toLowerCase() : null }
    try {
      await onAdd(row)
      setDone(`Added ${row.display_name}`)
      setName(''); setYear(''); setEmail(''); setSimilar([])
    } catch (err) { setError(errorMessage(err)) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <p className="font-medium">Add a person</p>
      <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={checkSimilar} className="rounded border px-2 py-1" /></label>
      {similar.length > 0 && (
        <div className="rounded bg-amber-50 p-2 text-amber-800">
          <p>Similar names already exist. Make sure this is a new person:</p>
          <ul>{similar.map(s => <li key={s.id}>{s.display_name} &#39;{String(s.grad_year).slice(-2)}{s.hidden ? ' (hidden)' : ''}</li>)}</ul>
        </div>
      )}
      <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Grad year</span>
        <input value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Penn email</span>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="rounded border px-2 py-1" /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {done && <p className="text-green-700">{done}</p>}
      <button className="self-start rounded bg-neutral-900 px-3 py-1 text-white">Add person</button>
    </form>
  )
}
```

Create `web/src/components/admin/BulkAddForm.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { parsePeopleCsv, type NewPerson } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'

export function BulkAddForm({ onAdd }: { onAdd: (rows: NewPerson[]) => Promise<void> }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ rows: NewPerson[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function add() {
    if (!preview || preview.rows.length === 0) return
    setError(null); setDone(null)
    try { await onAdd(preview.rows); setDone(`Added ${preview.rows.length} people`); setText(''); setPreview(null) }
    catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <p className="font-medium">Bulk add from a spreadsheet</p>
      <p className="text-neutral-600">Paste rows of <code>name, grad_year, penn_email</code> (comma or tab separated; email optional).</p>
      <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null) }} rows={6} className="rounded border px-2 py-1 font-mono" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setPreview(parsePeopleCsv(text))} className="rounded border px-3 py-1">Preview</button>
        {preview && preview.rows.length > 0 && <button type="button" onClick={add} className="rounded bg-neutral-900 px-3 py-1 text-white">Add {preview.rows.length} people</button>}
      </div>
      {preview && preview.errors.length > 0 && <ul role="alert" className="text-red-700">{preview.errors.map(e => <li key={e}>{e}</li>)}</ul>}
      {preview && preview.rows.length > 0 && (
        <table className="text-xs"><tbody>{preview.rows.map((r, i) => <tr key={i}><td className="pr-2">{r.display_name}</td><td className="pr-2">{r.grad_year}</td><td>{r.penn_email ?? '—'}</td></tr>)}</tbody></table>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {done && <p className="text-green-700">{done}</p>}
    </div>
  )
}
```

Create `web/src/components/admin/PeopleTable.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminUpdatePerson, insertPeople, listPeople, type AdminPersonPatch } from '@/lib/api/admin'
import { searchPeople } from '@/lib/api/people'
import { errorMessage } from '@/lib/errors'
import type { Person } from '@/lib/types'
import { AddPersonForm } from '@/components/admin/AddPersonForm'
import { BulkAddForm } from '@/components/admin/BulkAddForm'

function Row({ p, onSave }: { p: Person; onSave: (patch: AdminPersonPatch) => Promise<void> }) {
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ display_name: p.display_name, grad_year: String(p.grad_year), penn_email: p.penn_email ?? '', personal_email: p.personal_email ?? '' })
  const [error, setError] = useState<string | null>(null)
  const claimed = !!p.claimed_at

  async function save() {
    setError(null)
    const patch: AdminPersonPatch = {}
    if (form.display_name !== p.display_name) patch.display_name = form.display_name.trim()
    if (Number(form.grad_year) !== p.grad_year) patch.grad_year = Number(form.grad_year)
    if (!claimed && (form.penn_email || null) !== p.penn_email) patch.penn_email = form.penn_email ? form.penn_email.trim().toLowerCase() : null
    if ((form.personal_email || null) !== p.personal_email) patch.personal_email = form.personal_email ? form.personal_email.trim().toLowerCase() : null
    try { await onSave(patch); setEdit(false) } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <tr className={p.hidden ? 'text-neutral-400' : ''}>
      <td className="py-1 pr-2">{edit ? <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-40 rounded border px-1" /> : p.display_name}</td>
      <td className="py-1 pr-2">{edit ? <input value={form.grad_year} onChange={e => setForm({ ...form, grad_year: e.target.value })} className="w-16 rounded border px-1" /> : p.grad_year}</td>
      <td className="py-1 pr-2">{edit && !claimed ? <input value={form.penn_email} onChange={e => setForm({ ...form, penn_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.penn_email ?? '—')}{claimed && <span className="ml-1 text-xs text-green-700">claimed</span>}</td>
      <td className="py-1 pr-2">{edit ? <input value={form.personal_email} onChange={e => setForm({ ...form, personal_email: e.target.value })} className="w-48 rounded border px-1" /> : (p.personal_email ?? '—')}</td>
      <td className="py-1 pr-2 whitespace-nowrap">
        {edit ? <><button onClick={save} className="mr-1 underline">Save</button><button onClick={() => setEdit(false)} className="underline">Cancel</button></>
              : <><button onClick={() => setEdit(true)} className="mr-1 underline">Edit</button>
                  <button onClick={() => onSave({ hidden: !p.hidden }).catch(e => setError(errorMessage(e)))} className="underline">{p.hidden ? 'Unhide' : 'Hide'}</button></>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  )
}

export function PeopleTable() {
  const sb = useMemo(() => createClient(), [])
  const [q, setQ] = useState('')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try { setPeople(await listPeople(sb, { q, includeHidden })); setError(null) } catch (e) { setError(errorMessage(e)) }
  }, [sb, q, includeHidden])
  useEffect(() => { const t = setTimeout(() => { void reload() }, 150); return () => clearTimeout(t) }, [reload])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddPersonForm nearMatches={n => searchPeople(sb, n, 5)} onAdd={async r => { await insertPeople(sb, [r]); await reload() }} />
        <BulkAddForm onAdd={async rows => { await insertPeople(sb, rows); await reload() }} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <input type="search" placeholder="Filter by name" value={q} onChange={e => setQ(e.target.value)} className="rounded border px-2 py-1" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={includeHidden} onChange={e => setIncludeHidden(e.target.checked)} /> Show hidden</label>
        <span className="text-neutral-500">{people.length} people</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-neutral-500"><th>Name</th><th>Year</th><th>Penn email</th><th>Personal email</th><th></th></tr></thead>
          <tbody>{people.map(p => <Row key={p.id} p={p} onSave={async patch => { if (Object.keys(patch).length) await adminUpdatePerson(sb, p.id, patch); await reload() }} />)}</tbody>
        </table>
      </div>
    </div>
  )
}
```

Create `web/src/app/admin/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useViewer } from '@/lib/viewer'
import { AdminTabs, type AdminTab } from '@/components/admin/AdminTabs'
import { PeopleTable } from '@/components/admin/PeopleTable'

export default function AdminPage() {
  const v = useViewer()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('People')

  useEffect(() => { if (!v.loading && !v.isAdmin) router.replace('/') }, [v.loading, v.isAdmin, router])
  if (v.loading || !v.isAdmin) return <p className="p-6 text-sm text-neutral-500">Loading…</p>

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link href="/" className="text-sm underline">Back to lins</Link>
      </div>
      <AdminTabs tab={tab} onChange={setTab} />
      {tab === 'People' && <PeopleTable />}
      {tab !== 'People' && <p className="text-sm text-neutral-500">Coming in Task 11.</p>}
    </main>
  )
}
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
```
Expected: 55 tests passing. In the browser as alice: Admin → People lists nine seeded people. Add "Alice Wong" 2026: the near-match warning lists Alice Wang. Bulk-paste two rows; preview; add. Edit Bob's Penn email: the field is read-only with "claimed" (Bob signed in earlier). Hide someone; the main graph no longer shows them; "Show hidden" reveals them. As bob, visiting `/admin` bounces to `/`.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): admin people table with add, bulk add, edit, hide"
```

---

### Task 11: Admin screen — links, lins, requests, admins, merge, changelog

**Files:**
- Create: `web/src/components/admin/LinksAdmin.tsx`, `web/src/components/admin/LinsAdmin.tsx`, `web/src/components/admin/PendingAdmin.tsx`, `web/src/components/admin/AdminsAdmin.tsx`, `web/src/components/admin/MergeForm.tsx`, `web/src/components/admin/ChangelogList.tsx`, `web/src/lib/changelog.ts`, `web/src/lib/changelog.test.ts`, `web/src/components/admin/PersonPicker.tsx`
- Modify: `web/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: everything in `admin.ts`, `searchPeople`, `fetchPeopleByIds`, `useViewer`.
- Produces: `<PersonPicker label onPick />` (SearchBox wrapper showing the chosen name); `summarizeChange(row: ChangelogRow): string` — e.g. `people update: major "Econ" → "Math"`, `links insert: big=<id8> little=<id8> pending`, `admins delete: person=<id8>`; the six admin tab components.

- [ ] **Step 1: Write the failing changelog summary test**

Create `web/src/lib/changelog.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { summarizeChange } from '@/lib/changelog'
import type { ChangelogRow } from '@/lib/types'

const base = { id: 1, actor_id: null, created_at: '2026-09-06T00:00:00Z', row_id: '00000000-0000-0000-0000-000000000002' }

describe('summarizeChange', () => {
  it('lists changed fields on update', () => {
    const row: ChangelogRow = { ...base, table_name: 'people', action: 'update', before: { major: 'Econ', bio: null }, after: { major: 'Math', bio: null } }
    expect(summarizeChange(row)).toBe('people update: major "Econ" → "Math"')
  })
  it('describes inserts and deletes compactly', () => {
    const ins: ChangelogRow = { ...base, table_name: 'links', action: 'insert', before: null, after: { big_id: 'aaaaaaaa-0000-0000-0000-000000000001', little_id: 'bbbbbbbb-0000-0000-0000-000000000002', status: 'pending' } }
    expect(summarizeChange(ins)).toBe('links insert: big=aaaaaaaa little=bbbbbbbb pending')
    const del: ChangelogRow = { ...base, table_name: 'admins', action: 'delete', before: { person_id: 'cccccccc-0000-0000-0000-000000000003' }, after: null }
    expect(summarizeChange(del)).toBe('admins delete: person=cccccccc')
  })
  it('ignores updated_at noise', () => {
    const row: ChangelogRow = { ...base, table_name: 'people', action: 'update', before: { updated_at: '1', hidden: false }, after: { updated_at: '2', hidden: true } }
    expect(summarizeChange(row)).toBe('people update: hidden false → true')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test
```
Expected: fails on missing `@/lib/changelog`.

- [ ] **Step 3: Implement changelog.ts**

Create `web/src/lib/changelog.ts`:
```ts
import type { ChangelogRow } from '@/lib/types'

const NOISE = new Set(['updated_at', 'created_at'])
const short = (v: unknown) => (typeof v === 'string' && v.length >= 8 ? v.slice(0, 8) : String(v))
const fmt = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'string' ? `"${v}"` : String(v))
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function summarizeChange(row: ChangelogRow): string {
  const head = `${row.table_name} ${row.action}`
  const before = obj(row.before), after = obj(row.after)
  if (row.action === 'update') {
    const changes = Object.keys({ ...before, ...after })
      .filter(k => !NOISE.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map(k => `${k} ${fmt(before[k])} → ${fmt(after[k])}`)
    return `${head}: ${changes.join(', ') || 'no visible change'}`
  }
  const r = row.action === 'insert' ? after : before
  if (row.table_name === 'links') return `${head}: big=${short(r.big_id)} little=${short(r.little_id)} ${String(r.status ?? '')}`.trim()
  if (row.table_name === 'admins') return `${head}: person=${short(r.person_id)}`
  if (row.table_name === 'people') return `${head}: ${String(r.display_name ?? short(r.id))}`
  if (row.table_name === 'lins') return `${head}: ${String(r.name ?? short(r.id))}`
  return head
}
```

- [ ] **Step 4: Implement the tab components**

Create `web/src/components/admin/PersonPicker.tsx`:
```tsx
'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'

export function PersonPicker({ label, value, onPick }: { label: string; value: PersonHit | null; onPick: (h: PersonHit | null) => void }) {
  const sb = useMemo(() => createClient(), [])
  const [key, setKey] = useState(0)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase text-neutral-500">{label}</span>
      {value
        ? <span className="flex items-center gap-2">{value.display_name} &#39;{String(value.grad_year).slice(-2)} <button onClick={() => { onPick(null); setKey(k => k + 1) }} className="underline">change</button></span>
        : <SearchBox key={key} search={q => searchPeople(sb, q)} onPick={onPick} placeholder={label} />}
    </div>
  )
}
```

Create `web/src/components/admin/LinksAdmin.tsx`:
```tsx
'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { insertConfirmedLink } from '@/lib/api/admin'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function LinksAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [big, setBig] = useState<PersonHit | null>(null)
  const [little, setLittle] = useState<PersonHit | null>(null)
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function add() {
    if (!big || !little) return
    setError(null); setDone(null)
    try {
      await insertConfirmedLink(sb, { bigId: big.id, littleId: little.id, academicYear: year.trim() || null })
      setDone(`${big.display_name} → ${little.display_name} recorded`)
      setLittle(null); setYear('')
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-medium">Record a big → little link (confirmed immediately)</p>
      <PersonPicker label="Big" value={big} onPick={setBig} />
      <PersonPicker label="Little" value={little} onPick={setLittle} />
      <label className="flex flex-col gap-0.5 text-sm"><span className="text-xs uppercase text-neutral-500">Academic year (optional, e.g. 2024-25)</span>
        <input value={year} onChange={e => setYear(e.target.value)} className="rounded border px-2 py-1" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
      <button onClick={add} disabled={!big || !little} className="self-start rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50">Add link</button>
    </div>
  )
}
```

Create `web/src/components/admin/LinsAdmin.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteLin, listLins, upsertLin } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import type { PersonHit } from '@/lib/api/people'
import type { Lin } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function LinsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [lins, setLins] = useState<Lin[]>([])
  const [founders, setFounders] = useState<Map<string, string>>(new Map())
  const [editing, setEditing] = useState<{ id?: string; name: string; color: string; founder: PersonHit | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ls = await listLins(sb)
      setLins(ls)
      const people = await fetchPeopleByIds(sb, ls.map(l => l.founder_id))
      setFounders(new Map(people.map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])

  async function save() {
    if (!editing || !editing.founder) return
    setError(null)
    try {
      await upsertLin(sb, { id: editing.id, name: editing.name.trim(), color: editing.color, founder_id: editing.founder.id })
      setEditing(null); await reload()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <table className="max-w-xl">
        <thead><tr className="text-left text-xs uppercase text-neutral-500"><th>Lin</th><th>Founder</th><th></th></tr></thead>
        <tbody>
          {lins.map(l => (
            <tr key={l.id}>
              <td className="py-1 pr-2"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />{l.name}</td>
              <td className="py-1 pr-2">{founders.get(l.founder_id) ?? l.founder_id.slice(0, 8)}</td>
              <td className="py-1">
                <button className="mr-2 underline" onClick={() => setEditing({ id: l.id, name: l.name, color: l.color, founder: { id: l.founder_id, display_name: founders.get(l.founder_id) ?? '', grad_year: 0, hidden: false } })}>Edit</button>
                <button className="underline" onClick={async () => { if (window.confirm(`Delete ${l.name}? People and links are kept.`)) { try { await deleteLin(sb, l.id); await reload() } catch (e) { setError(errorMessage(e)) } } }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!editing && <button onClick={() => setEditing({ name: '', color: '#6366f1', founder: null })} className="self-start rounded border px-3 py-1">New lin</button>}
      {editing && (
        <div className="flex max-w-md flex-col gap-2 rounded-md border p-3">
          <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Name</span>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="rounded border px-2 py-1" /></label>
          <label className="flex flex-col gap-0.5"><span className="text-xs uppercase text-neutral-500">Color</span>
            <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} /></label>
          <PersonPicker label="Founder" value={editing.founder} onPick={h => setEditing({ ...editing, founder: h })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={!editing.name.trim() || !editing.founder} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Save</button>
            <button onClick={() => setEditing(null)} className="rounded border px-3 py-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

Create `web/src/components/admin/PendingAdmin.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminResolveLink, listPendingLinks } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { Link } from '@/lib/types'

export function PendingAdmin() {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [links, setLinks] = useState<Link[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ls = await listPendingLinks(sb)
      setLinks(ls)
      const ids = [...new Set(ls.flatMap(l => [l.big_id, l.little_id, l.proposed_by].filter((x): x is string => !!x)))]
      setNames(new Map((await fetchPeopleByIds(sb, ids)).map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])

  const n = (id: string | null) => (id ? names.get(id) ?? id.slice(0, 8) : '—')
  async function resolve(l: Link, d: 'accept' | 'reject') {
    setError(null)
    try { await adminResolveLink(sb, l.id, d, v.personId!); await reload(); await v.refresh() } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {links.length === 0 && <p className="text-neutral-500">No pending requests.</p>}
      <ul className="flex flex-col gap-1">
        {links.map(l => (
          <li key={l.id} className="flex items-center gap-2">
            <span>{n(l.big_id)} → {n(l.little_id)} <span className="text-neutral-500">(proposed by {n(l.proposed_by)})</span></span>
            <button onClick={() => resolve(l, 'accept')} className="ml-auto rounded bg-neutral-900 px-2 py-0.5 text-white">Accept</button>
            <button onClick={() => resolve(l, 'reject')} className="rounded border px-2 py-0.5">Reject</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Create `web/src/components/admin/AdminsAdmin.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { demote, listAdmins, promote } from '@/lib/api/admin'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import type { Person } from '@/lib/types'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function AdminsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [admins, setAdmins] = useState<{ person: Person; granted_at: string }[]>([])
  const [pick, setPick] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => { try { setAdmins(await listAdmins(sb)) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void reload() }, [reload])

  async function run(fn: () => Promise<void>) { setError(null); try { await fn(); await reload(); await v.refresh() } catch (e) { setError(errorMessage(e)) } }

  return (
    <div className="flex max-w-md flex-col gap-3 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <ul className="flex flex-col gap-1">
        {admins.map(a => (
          <li key={a.person.id} className="flex items-center gap-2">
            <span>{a.person.display_name} <span className="text-neutral-500">since {a.granted_at.slice(0, 10)}</span></span>
            <button onClick={() => { if (window.confirm(`Remove ${a.person.display_name} as admin?`)) void run(() => demote(sb, a.person.id)) }} className="ml-auto underline">Remove</button>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <PersonPicker label="Promote" value={pick} onPick={setPick} />
        <button disabled={!pick} onClick={() => { if (pick) void run(async () => { await promote(sb, pick.id, v.personId!); setPick(null) }) }} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Make admin</button>
      </div>
    </div>
  )
}
```

Create `web/src/components/admin/MergeForm.tsx`:
```tsx
'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergePeople } from '@/lib/api/admin'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function MergeForm() {
  const sb = useMemo(() => createClient(), [])
  const [survivor, setSurvivor] = useState<PersonHit | null>(null)
  const [duplicate, setDuplicate] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function merge() {
    if (!survivor || !duplicate) return
    if (!window.confirm(`Merge "${duplicate.display_name}" into "${survivor.display_name}"? The duplicate is hidden and all its links move to the survivor.`)) return
    setError(null); setDone(null)
    try { await mergePeople(sb, survivor.id, duplicate.id); setDone('Merged'); setDuplicate(null) } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-md border p-3 text-sm">
      <p>Merge two profiles that are the same person. The survivor keeps its name and fields; anything it lacks is copied from the duplicate.</p>
      <PersonPicker label="Keep (survivor)" value={survivor} onPick={setSurvivor} />
      <PersonPicker label="Merge away (duplicate)" value={duplicate} onPick={setDuplicate} />
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {done && <p className="text-green-700">{done}</p>}
      <button onClick={merge} disabled={!survivor || !duplicate || survivor.id === duplicate.id} className="self-start rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Merge</button>
    </div>
  )
}
```

Create `web/src/components/admin/ChangelogList.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listChangelog } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import { summarizeChange } from '@/lib/changelog'
import { errorMessage } from '@/lib/errors'
import type { ChangelogRow } from '@/lib/types'

const PAGE = 50

export function ChangelogList() {
  const sb = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ChangelogRow[]>([])
  const [actors, setActors] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(true)

  const load = useCallback(async (before?: number) => {
    try {
      const page = await listChangelog(sb, { before, limit: PAGE })
      setRows(r => (before === undefined ? page : [...r, ...page]))
      setMore(page.length === PAGE)
      const ids = [...new Set(page.map(r => r.actor_id).filter((x): x is string => !!x))]
      const people = await fetchPeopleByIds(sb, ids)
      setActors(a => new Map([...a, ...people.map(p => [p.id, p.display_name] as const)]))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void load() }, [load])

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <ul className="flex flex-col gap-0.5 font-mono text-xs">
        {rows.map(r => (
          <li key={r.id}>
            <span className="text-neutral-500">{r.created_at.replace('T', ' ').slice(0, 16)}</span>{' '}
            <span className="text-neutral-700">{r.actor_id ? actors.get(r.actor_id) ?? r.actor_id.slice(0, 8) : 'system'}</span>{' '}
            {summarizeChange(r)}
          </li>
        ))}
      </ul>
      {more && rows.length > 0 && <button onClick={() => load(rows[rows.length - 1].id)} className="self-start rounded border px-3 py-1">Load more</button>}
    </div>
  )
}
```

Update `web/src/app/admin/page.tsx`: import the six components and replace the placeholder line with:
```tsx
      {tab === 'Links' && <LinksAdmin />}
      {tab === 'Lins' && <LinsAdmin />}
      {tab === 'Requests' && <PendingAdmin />}
      {tab === 'Admins' && <AdminsAdmin />}
      {tab === 'Merge' && <MergeForm />}
      {tab === 'Changelog' && <ChangelogList />}
```

- [ ] **Step 5: Run tests, lint, and check by hand**

```bash
npm test && npm run lint && npm run build
```
Expected: 58 tests passing. In the browser as alice: Links → record Cathy → Frank; the graph shows the new edge. Try Frank → Alice: the error `link would create a cycle` appears verbatim. Lins → New lin "Test Lin", founder Henry; a new tab appears on the main screen. Admins → Remove Alice (the only admin): `cannot remove the last admin`. Promote Bob, then remove Bob. Merge → keep Alice, merge away the "Alice Wong" from Task 10: succeeds and she disappears from the graph. Changelog shows every one of these with Alice as the actor and readable summaries.

- [ ] **Step 6: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add web
git commit -m "feat(web): admin links, lins, requests, admins, merge, changelog"
```

---

### Task 12: Deployment configuration and documentation

**Files:**
- Create: `web/README.md`, `README.md` (repo root), `web/vercel.json`
- Modify: `supabase/README.md` (one cross-reference line)

**Interfaces:**
- Produces: a documented path from clone to running locally, and from zero to a Vercel deployment with Google sign-in, for a maintainer who has never seen the project.

- [ ] **Step 1: Vercel config**

Create `web/vercel.json`:
```json
{
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build"
}
```

- [ ] **Step 2: Web README**

Create `web/README.md`:
```markdown
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

Commands: `npm test` (Vitest), `npm run lint`, `npm run build`,
`npm run gen:types` (regenerate `src/lib/database.types.ts` after a migration).

## Where things are

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Main screen: lin tabs, search, graph, side panel; `?lin=&person=` in the URL |
| `src/app/admin/page.tsx` | Admin tabs (redirects non-admins) |
| `src/app/login`, `src/app/auth/callback` | Google sign-in and OAuth code exchange |
| `src/middleware.ts` | Sends signed-out visitors to `/login` |
| `src/lib/viewer.tsx` | Who is signed in: `personId` from the JWT, `isAdmin` from `rpc('is_admin')` |
| `src/lib/api/*` | Every Supabase query, one file per area |
| `src/lib/graph/*` | Pure layout: dagre for x, grad year for y; React Flow element builder |
| `src/components/graph/*` | The canvas and the name-pill node |
| `src/components/panel/*` | Side panel: profile view, editor, link requests |
| `src/components/admin/*` | Admin tabs |

The graph for a lin is one call: `rpc('lin_graph', { lin })`. See
`../supabase/README.md` for the contract.

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
```

- [ ] **Step 3: Root README and backend cross-reference**

Create `README.md` at the repo root:
```markdown
# CSA Lin Tree

The big/little "lin" family trees of the Penn Chinese Student Association, as
an interactive website.

- `supabase/` — the whole backend: Postgres schema, security rules, auth hook,
  tests. Start here: [supabase/README.md](supabase/README.md).
- `web/` — the Next.js site. Run and deploy: [web/README.md](web/README.md).
- `docs/superpowers/specs/` — the design spec; `docs/superpowers/plans/` — the
  implementation plans the code was built from.

Quick start: Docker Desktop running, then

```bash
supabase start && supabase db reset
cd web && cp .env.example .env.local   # paste ANON_KEY from `supabase status`
npm install && npm run dev
```

Sign in at http://localhost:3000 with `alice@upenn.edu` / `password123`.
```

In `supabase/README.md`, under "## Local development", after the Studio line, add:
```markdown
The web app lives in `../web`; see `web/README.md` to run it against this stack.
```

- [ ] **Step 4: Full verification**

```bash
cd /Users/michaelli/Documents/projects/csa-lin/web
npm test && npm run lint && npm run build
cd .. && supabase test db 2>&1 | tail -3
```
Expected: 58 web tests passing, lint clean, production build succeeds, backend suite still `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
cd /Users/michaelli/Documents/projects/csa-lin
git add README.md web/README.md web/vercel.json supabase/README.md
git commit -m "docs: run and deploy instructions for the web app"
```

---

## Self-review against the spec

- **§4 auth**: Google with Penn hint (Task 2), dev login gated by env (Task 2), viewer-with-no-profile message (Task 6 account menu), hook rejection message surfaced on `/login` (Task 2 callback).
- **§7 top bar**: lin tabs, search, avatar badge with pending count (Task 6). **Lin view**: rows by grad year, name pills with year-colored border, dashed avatar for unclaimed, pan/zoom/fit (Tasks 4, 5), search selects and centers (Task 6). **Side panel**: fields, lins switchable, bigs/littles re-center, bottom sheet on narrow screens (Task 7); own-profile edit, add big/little, pending accept/decline, remove link (Tasks 8, 9). **Admin**: people table with near-match, inline edit, hide, CSV bulk add (Task 10); links, lins, pending, admins with last-admin error, merge, changelog (Task 11).
- **§8 member flows**: claim is backend-only; edit (8); propose with existing-link detection (9); accept/decline (9); remove (9). No notifications.
- **§9 edge cases** shown verbatim from the database: cycle, locked penn_email, last admin, both-claimed merge — all flow through `errorMessage` (Task 2) and `role="alert"` elements.
- **§11 deployment**: Vercel root `web`, env vars, redirect URLs, no dev login in prod (Task 12).
- **§12 tests**: layout with the two-big fixture (Task 4), each person/link rendered once via `buildFlowElements` (Task 4) plus pill rendering (Task 5), search selects the right person (Task 6), own-profile panel shows edit controls only for self (verified by hand in Task 8; `SidePanel` depends on `useViewer`, so it is exercised manually rather than mocked).

Name consistency: `fetchLinGraph`, `parseLinGraph`, `layoutLin`, `buildFlowElements`, `PersonNodeData`, `usePersonDetails`, `Related`, `splitLinks`, `describeExisting`, `parsePeopleCsv`, `summarizeChange`, `errorMessage`, `useViewer` are spelled identically wherever they appear.

Known simplifications, deliberate: no optimistic updates (every write is followed by a reload); no end-to-end browser tests; `SidePanel` and the admin tab components are wired components verified by hand, with their pure children unit-tested.
