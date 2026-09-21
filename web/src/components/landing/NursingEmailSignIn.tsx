'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/errors'
import { callbackUrl } from '@/lib/returnPath'

const NURSING_EMAIL = /^[^@\s]+@nursing\.upenn\.edu$/

// `back` is the page to open once signed in; the login page reads it from the URL.
export function NursingEmailSignIn({ back = '/' }: { back?: string } = {}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendWait, setResendWait] = useState(0)

  useEffect(() => {
    if (resendWait === 0) return
    const timer = setTimeout(() => setResendWait(resendWait - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendWait])

  async function requestCode(address: string) {
    if (busy) return
    setError(null)
    const normalized = address.trim().toLowerCase()
    if (!NURSING_EMAIL.test(normalized)) {
      setError('Email codes are for @nursing.upenn.edu addresses. For other accounts, use Google sign-in.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: callbackUrl(window.location.origin, back) },
      })
      if (error) throw error
      setSentEmail(normalized)
      setCode('')
      setResendWait(60)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!sentEmail || busy) return
    setError(null)
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your email.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: sentEmail, token: code, type: 'email' })
      if (error) throw error
      router.replace(back)
      router.refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex w-full max-w-sm flex-col items-start gap-3">
    <button type="button" className="link text-sm" aria-expanded={open} aria-controls="nursing-email-sign-in" onClick={() => { setOpen(!open); setError(null) }}>
      In the Nursing School? Sign in with an email code
    </button>
    {open && <div id="nursing-email-sign-in" className="card w-full p-4 text-sm">
      {!sentEmail ? <form onSubmit={e => { e.preventDefault(); void requestCode(email) }} className="flex flex-col gap-3">
        <label htmlFor="nursing-email" className="font-medium">Your Nursing email</label>
        <input id="nursing-email" type="email" autoComplete="email" required className="input" placeholder="you@nursing.upenn.edu" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn-primary self-start" disabled={busy}>{busy ? 'Sending…' : 'Send a code'}</button>
      </form> : <form onSubmit={verifyCode} className="flex flex-col gap-3">
        <p>Enter the code sent to <strong>{sentEmail}</strong>.</p>
        <label htmlFor="nursing-code" className="font-medium">Six-digit code</label>
        <input id="nursing-code" type="text" inputMode="numeric" autoComplete="one-time-code" required className="input" placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <button className="btn-primary self-start" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <button type="button" className="link disabled:cursor-default disabled:opacity-50" disabled={busy || resendWait > 0} onClick={() => { void requestCode(sentEmail) }}>
            {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
          </button>
          <button type="button" className="link" onClick={() => { setSentEmail(null); setCode(''); setError(null) }}>Use a different email</button>
        </div>
      </form>}
      {error && <p role="alert" className="alert mt-3">{error}</p>}
    </div>}
  </div>
}
