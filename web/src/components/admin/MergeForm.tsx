'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergePeople } from '@/lib/api/admin'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'
import { ConfirmButton } from '@/components/ConfirmButton'

export function MergeForm() {
  const sb = useMemo(() => createClient(), [])
  const [survivor, setSurvivor] = useState<PersonHit | null>(null)
  const [duplicate, setDuplicate] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function merge() {
    if (!survivor || !duplicate) return
    setError(null); setDone(null)
    try {
      const { leftoverPhoto, photoNotAdopted } = await mergePeople(sb, survivor.id, duplicate.id)
      const notes = [
        photoNotAdopted && `The photo was not carried over: ${photoNotAdopted} was already taken.`,
        leftoverPhoto && `The duplicate's old photo (${leftoverPhoto}) is still in Storage; move or remove it there.`,
      ].filter(Boolean)
      setDone(notes.length > 0 ? `Merged. ${notes.join(' ')}` : 'Merged')
      setDuplicate(null)
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-md border p-3 text-sm">
      <p>Merge two profiles that are the same person. The survivor keeps its name and fields; anything it lacks is copied from the duplicate.</p>
      <PersonPicker label="Keep (survivor)" value={survivor} onPick={setSurvivor} />
      <PersonPicker label="Merge away (duplicate)" value={duplicate} onPick={setDuplicate} />
      {error && <p role="alert" className="text-danger">{error}</p>}
      {done && <p className="text-ok">{done}</p>}
      {survivor && duplicate && survivor.id !== duplicate.id ? (
        <span className="self-start">
          <ConfirmButton
            label="Merge"
            question={`Merge “${duplicate.display_name}” into “${survivor.display_name}”? The duplicate is hidden and all its links move to the survivor.`}
            confirmLabel="Merge"
            onConfirm={() => { void merge() }}
            className="rounded bg-accent px-3 py-1 text-accent-ink"
          />
        </span>
      ) : (
        <button disabled className="self-start rounded bg-accent px-3 py-1 text-accent-ink opacity-50">Merge</button>
      )}
    </div>
  )
}
