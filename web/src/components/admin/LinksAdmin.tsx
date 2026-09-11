'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { insertConfirmedLink } from '@/lib/api/admin'
import { findLinkBetween } from '@/lib/api/links'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function LinksAdmin() {
  const sb = useMemo(() => createClient(), [])
  const [big, setBig] = useState<PersonHit | null>(null)
  const [little, setLittle] = useState<PersonHit | null>(null)
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function add() {
    if (!big || !little) return
    setError(null); setDone(null)
    try {
      const existing = await findLinkBetween(sb, big.id, little.id)
      if (existing) {
        const sameDirection = existing.big_id === big.id
        setError(existing.status === 'confirmed'
          ? `${sameDirection ? 'This link' : 'The reverse link'} is already recorded and confirmed`
          : 'A pending request for this pair already exists; accept or reject it on the Requests tab')
        return
      }
      await insertConfirmedLink(sb, { bigId: big.id, littleId: little.id, academicYear: year.trim() || null })
      setDone(`${big.display_name} → ${little.display_name} recorded`)
      setLittle(null); setYear('')
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-medium">Record a big → little link (confirmed immediately)</p>
      <PersonPicker label="Big" value={big} onPick={setBig} />
      <PersonPicker label="Little" value={little} onPick={setLittle} />
      <label className="flex flex-col gap-0.5 text-sm"><span className="text-xs uppercase text-ink-faint">Academic year (optional, e.g. 2024-25)</span>
        <input value={year} onChange={e => setYear(e.target.value)} className="rounded border px-2 py-1" /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {done && <p className="text-sm text-ok">{done}</p>}
      <button onClick={add} disabled={!big || !little} className="self-start rounded bg-accent px-3 py-1 text-sm text-accent-ink disabled:opacity-50">Add link</button>
    </div>
  )
}
