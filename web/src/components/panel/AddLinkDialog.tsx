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
      {existing && <p role="alert" className="mt-1 text-warn">{describeExisting(existing, me)}</p>}
      {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        {picked && !existing && <button onClick={send} disabled={busy} className="rounded bg-accent px-2 py-1 text-accent-ink disabled:opacity-50">Send request</button>}
        <button onClick={onClose} className="rounded border px-2 py-1">Cancel</button>
      </div>
    </div>
  )
}
