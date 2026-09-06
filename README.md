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
