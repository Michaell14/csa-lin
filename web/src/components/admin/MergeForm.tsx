'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergePeople } from '@/lib/api/admin'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function MergeForm() {
  const sb = useMemo(() => createClient(), [])
  const [survivor, setSurvivor] = useState<PersonHit | null>(null)
  const [duplicate, setDuplicate] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function merge() {
    if (!survivor || !duplicate) return
    if (!window.confirm(`Merge "${duplicate.display_name}" into "${survivor.display_name}"? The duplicate is hidden and all its links move to the survivor.`)) return
    setError(null); setDone(null)
    try {
      const { leftoverPhoto } = await mergePeople(sb, survivor.id, duplicate.id)
      setDone(leftoverPhoto
        ? `Merged. The duplicate's old photo (${leftoverPhoto}) could not be deleted; remove it in Storage.`
        : 'Merged')
      setDuplicate(null)
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="card flex max-w-md flex-col gap-3 p-5 text-sm">
      <p>Merge two profiles that are the same person. The survivor keeps its name and fields; anything it lacks is copied from the duplicate.</p>
      <PersonPicker label="Keep (survivor)" value={survivor} onPick={setSurvivor} />
      <PersonPicker label="Merge away (duplicate)" value={duplicate} onPick={setDuplicate} />
      {error && <p role="alert" className="alert">{error}</p>}
      {done && <p className="font-medium text-success">{done}</p>}
      <button onClick={merge} disabled={!survivor || !duplicate || survivor.id === duplicate.id} className="btn-sm-primary self-start">Merge</button>
    </div>
  )
}
