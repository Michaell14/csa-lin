'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminRemoveLink, confirmedLinkExists, insertConfirmedLink } from '@/lib/api/admin'
import { findLinkBetween } from '@/lib/api/links'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function LinksAdmin({ onQueueChanged }: { onQueueChanged?: () => void }) {
  const sb = useMemo(() => createClient(), [])
  const [big, setBig] = useState<PersonHit | null>(null)
  const [little, setLittle] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [removeBig, setRemoveBig] = useState<PersonHit | null>(null)
  const [removeLittle, setRemoveLittle] = useState<PersonHit | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeDone, setRemoveDone] = useState<string | null>(null)

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
      await insertConfirmedLink(sb, { bigId: big.id, littleId: little.id })
      setDone(`${big.display_name} → ${little.display_name} recorded`)
      setLittle(null)
    } catch (e) { setError(errorMessage(e)) }
  }

  async function remove() {
    if (!removeBig || !removeLittle) return
    setRemoveError(null); setRemoveDone(null)
    try {
      if (!await confirmedLinkExists(sb, removeBig.id, removeLittle.id)) {
        setRemoveError('No confirmed link exists for this big → little pair.')
        return
      }
      if (!window.confirm(`Remove the confirmed link ${removeBig.display_name} → ${removeLittle.display_name}?`)) return
      const removed = await adminRemoveLink(sb, removeBig.id, removeLittle.id)
      if (!removed) { setRemoveError('No confirmed link exists for this big → little pair.'); return }
      setRemoveDone(`${removeBig.display_name} → ${removeLittle.display_name} removed`)
      setRemoveLittle(null)
      onQueueChanged?.()
    } catch (e) { setRemoveError(errorMessage(e)) }
  }

  return (
    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
      <div className="card flex h-full flex-col gap-3 p-5">
        <p className="heading text-base">Add a confirmed link</p>
        <p className="text-sm text-ink-muted">Choose a big and little. This takes effect immediately.</p>
        <PersonPicker label="Big" value={big} onPick={setBig} />
        <PersonPicker label="Little" value={little} onPick={setLittle} />
        {error && <p role="alert" className="alert">{error}</p>}
        {done && <p className="text-sm font-medium text-success">{done}</p>}
        <button onClick={add} disabled={!big || !little} className="btn-sm-primary mt-auto self-start">Add link</button>
      </div>
      <div className="card flex h-full flex-col gap-3 p-5">
        <p className="heading text-base">Remove a confirmed link</p>
        <p className="text-sm text-ink-muted">Choose a big and little. This takes effect immediately.</p>
        <PersonPicker label="Big" value={removeBig} onPick={setRemoveBig} />
        <PersonPicker label="Little" value={removeLittle} onPick={setRemoveLittle} />
        {removeError && <p role="alert" className="alert">{removeError}</p>}
        {removeDone && <p className="text-sm font-medium text-success">{removeDone}</p>}
        <button onClick={remove} disabled={!removeBig || !removeLittle} className="btn-sm-primary mt-auto self-start">Remove link</button>
      </div>
    </div>
  )
}
