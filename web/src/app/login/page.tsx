'use client'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'
import { Landing } from '@/components/landing/Landing'
import { TreeIcon } from '@/components/icons'

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
  // The icon sits on the left, so that side gets 2px less padding than the text side.
  const cta = <button onClick={google} className="btn-primary pl-3.5"><TreeIcon />Sign in with Penn Google</button>
  const alert = error ? <p role="alert" className="alert max-w-md">{error}</p> : null

  const devForm = devLogin ? (
    <div className="px-5 pb-16 md:px-12">
      <form onSubmit={dev} className="card mx-auto flex max-w-sm flex-col gap-3 p-5">
        <p className="label">Local dev login</p>
        <input className="input" placeholder="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" placeholder="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn-secondary self-start">Sign in</button>
      </form>
    </div>
  ) : null

  return <main><Landing cta={cta} onSignIn={google} alert={alert} footerSlot={devForm} /></main>
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
