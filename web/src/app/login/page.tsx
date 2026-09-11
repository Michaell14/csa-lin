'use client'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="h-4 w-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function LoginForm() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(params.get('error'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // The OAuth redirect can take a moment; say so rather than looking inert.
  const [busy, setBusy] = useState(false)
  const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === 'true'

  async function google() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    })
    if (error) { setError(errorMessage(error)); setBusy(false) }
  }

  async function dev(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(errorMessage(error)); setBusy(false); return }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink text-sm font-semibold tracking-wide">
          CSA
        </span>
        <h1 className="text-2xl font-semibold">CSA Lins</h1>
        <p className="text-sm text-ink-muted">
          The big/little family trees of the Penn Chinese Student Association. Sign in with your Penn Google account to see them.
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border bg-danger-surface px-3 py-2 text-sm text-danger">{error}</p>}

      <button
        onClick={google}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 font-medium hover:bg-surface-hover disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? 'Taking you to Google…' : 'Continue with Google'}
      </button>

      {devLogin && (
        <form onSubmit={dev} className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Local dev login</p>
          <input className="rounded border px-2 py-1.5" placeholder="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="rounded border px-2 py-1.5" placeholder="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <button disabled={busy} className="rounded-md bg-accent px-4 py-2 text-accent-ink disabled:opacity-60">Sign in</button>
        </form>
      )}
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
