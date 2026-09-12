'use client'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'
import { Landing } from '@/components/landing/Landing'

function GoogleIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M12 8l-6 5M12 8l6 5" />
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
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

  // The button is repeated down the page; the error is not, so it stays out of `cta`.
  const cta = <button onClick={google} className="btn-primary"><GoogleIcon />Sign in with Penn Google</button>
  const alert = error ? <p role="alert" className="alert max-w-[420px]">{error}</p> : null

  const devForm = devLogin ? (
    <div className="relative px-5 pb-16 md:px-14">
      <form onSubmit={dev} className="card mx-auto flex max-w-sm flex-col gap-3 p-6">
        <p className="eyebrow">Local dev login</p>
        <input className="input" placeholder="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" placeholder="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn-outline self-start">Sign in</button>
      </form>
    </div>
  ) : null

  return <main><Landing cta={cta} alert={alert} footerSlot={devForm} /></main>
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
