'use client'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'
import { Landing } from '@/components/landing/Landing'
import { NursingEmailSignIn } from '@/components/landing/NursingEmailSignIn'
import { TreeIcon } from '@/components/icons'
import { RETURN_PARAM, callbackUrl, safeReturnPath } from '@/lib/returnPath'
import { loginErrorMessage } from '@/lib/loginErrors'

function LoginForm() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useSearchParams()
  // A failed callback arrives with a code in the URL, shown once as its fixed
  // message (see loginErrors.ts); errors raised on this page are shown as is.
  const [error, setError] = useState<string | null>(() => loginErrorMessage(params.get('error')))
  // Where the middleware said this visitor was headed before it sent them here.
  const back = safeReturnPath(params.get(RETURN_PARAM))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === 'true'
  const nursingEmailEnabled = process.env.NEXT_PUBLIC_NURSING_EMAIL_LOGIN_ENABLED === 'true'

  // A retry starts clean: the code a failed callback left in the URL is
  // dropped too, so a refresh mid-attempt does not resurrect a stale alert.
  function clearError() {
    setError(null)
    if (!params.has('error')) return
    const q = new URLSearchParams(params.toString())
    q.delete('error')
    window.history.replaceState(null, '', q.size ? `/login?${q.toString()}` : '/login')
  }

  async function google() {
    clearError()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(window.location.origin, back), queryParams: { prompt: 'select_account' } },
    })
    if (error) setError(errorMessage(error))
  }

  async function dev(e: FormEvent) {
    e.preventDefault()
    clearError()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(errorMessage(error)); return }
    router.push(back)
    router.refresh()
  }

  // The button is repeated down the page; the error is not, so it stays out of `cta`.
  // The icon sits on the left, so that side gets 2px less padding than the text side.
  const cta = <button onClick={google} className="btn-primary pl-3.5"><TreeIcon />Sign in with Penn Google</button>
  const alert = error ? <p role="alert" className="alert max-w-md">{error}</p> : null

  const devForm = devLogin ? (
    <form onSubmit={dev} className="card flex w-full max-w-sm flex-col gap-3 p-4 text-sm">
      <p className="label">Local dev login</p>
      <input className="input" type="email" placeholder="alice@upenn.edu" aria-label="Dev account email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" placeholder="password" aria-label="Dev account password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="btn-secondary self-start">Sign in with dev account</button>
    </form>
  ) : null

  const showNursingEmail = nursingEmailEnabled && !devLogin
  return <main><Landing cta={cta} secondaryCta={devForm ?? (showNursingEmail ? <NursingEmailSignIn back={back} /> : null)} nursingEmailEnabled={showNursingEmail} onSignIn={google} alert={alert} /></main>
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
