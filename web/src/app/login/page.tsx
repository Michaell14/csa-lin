'use client'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'

function LoginForm() {
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
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
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
      <p className="text-sm text-ink-muted">Sign in with your Penn Google account to see the lin trees.</p>
      <button onClick={google} className="rounded-md bg-accent px-4 py-2 text-accent-ink">Continue with Google</button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {devLogin && (
        <form onSubmit={dev} className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs uppercase text-ink-faint">Local dev login</p>
          <input className="rounded border px-2 py-1" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="rounded border px-2 py-1" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="rounded-md border px-4 py-2">Sign in</button>
        </form>
      )}
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
