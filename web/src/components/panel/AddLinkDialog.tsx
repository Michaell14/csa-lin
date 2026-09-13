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
    <div className="card flex flex-col gap-3 p-4 text-sm">
      <p className="display text-lg tracking-[-0.02em]">Add a {role}</p>
      <SearchBox search={search} onPick={pick} placeholder={`Who is your ${role}?`} />
      {picked && <p>Selected: <span className="font-bold">{picked.display_name}</span></p>}
      {existing && <p role="alert" className="rounded-tag border-2 border-ink bg-gold-tint px-3 py-2 font-bold">{describeExisting(existing, me)}</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      <div className="flex gap-3">
        {picked && !existing && <button onClick={send} disabled={busy} className="btn-sm-accent">Send request</button>}
        <button onClick={onClose} className="btn-sm">Cancel</button>
      </div>
    </div>
  )
}
