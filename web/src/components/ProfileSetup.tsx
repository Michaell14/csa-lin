'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readViewerClaims } from '@/lib/jwt'
import { errorMessage } from '@/lib/errors'
import { BrandTitle } from '@/components/BrandTitle'

export function ProfileSetup({ email, onReady, onSignOut }: {
  email: string | null
  onReady: () => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const sb = useMemo(() => createClient(), [])
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void sb.auth.getUser().then(({ data: { user } }) => {
      const suggested = user?.user_metadata?.full_name ?? user?.user_metadata?.name
      if (typeof suggested === 'string') setName(current => current || suggested.slice(0, 100))
    })
  }, [sb])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    const classYear = Number(year)
    if (!trimmed || trimmed.length > 100) { setError('Enter your name (100 characters or fewer).'); return }
    if (!/^\d{4}$/.test(year) || classYear < 1900 || classYear > 2200) {
      setError('Enter a valid four-digit class year.'); return
    }
    setSaving(true); setError(null)
    try {
      const { error: createError } = await sb.rpc('create_my_profile', { profile_name: trimmed, class_year: classYear })
      if (createError) throw createError
      // person_id is issued by the auth hook, not the RPC response. Refresh it
      // before enabling profile editing or link requests (which rely on RLS).
      const { data, error: refreshError } = await sb.auth.refreshSession()
      if (refreshError) throw refreshError
      if (!readViewerClaims(data.session?.access_token).personId) {
        throw new Error('Your profile was saved, but your session did not update. Please sign out and back in.')
      }
      await onReady()
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-5">
    <BrandTitle className="flex" />
    <form onSubmit={submit} className="card flex w-full max-w-md flex-col gap-4 p-6 text-sm">
      <div>
        <h1 className="heading text-xl">Set up your profile</h1>
        <p className="mt-2 text-ink-body">Add your class year to create your profile. Then you can request a big or little and help improve your lin.</p>
        {email && <p className="mt-2 text-xs text-ink-muted">Signed in as {email}</p>}
      </div>
      <label className="flex flex-col gap-1"><span className="label">Full Name</span>
        <input className="input-sm" autoComplete="name" maxLength={100} required value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="flex flex-col gap-1"><span className="label">Class of</span>
        <input className="input-sm" type="number" inputMode="numeric" min={1900} max={2200} step={1} required placeholder="2028" value={year} onChange={event => setYear(event.target.value)} /></label>
      {error && <p role="alert" className="alert">{error}</p>}
      <button className="btn-sm-primary self-start" disabled={saving}>{saving ? 'Creating profile…' : 'Create profile'}</button>
    </form>
    <button className="link text-sm" onClick={() => { void onSignOut() }}>Sign out</button>
  </main>
}
