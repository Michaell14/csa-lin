'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { demote, listAdmins, promote } from '@/lib/api/admin'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import type { Person } from '@/lib/types'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function AdminsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [admins, setAdmins] = useState<{ person: Person; granted_at: string }[]>([])
  const [pick, setPick] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => { try { setAdmins(await listAdmins(sb)) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void reload() }, [reload])

  async function run(fn: () => Promise<void>) { setError(null); try { await fn(); await reload(); await v.refresh() } catch (e) { setError(errorMessage(e)) } }

  return (
    <div className="flex max-w-md flex-col gap-3 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <ul className="flex flex-col gap-1">
        {admins.map(a => (
          <li key={a.person.id} className="flex items-center gap-2">
            <span>{a.person.display_name} <span className="text-neutral-500">since {a.granted_at.slice(0, 10)}</span></span>
            <button onClick={() => { if (window.confirm(`Remove ${a.person.display_name} as admin?`)) void run(() => demote(sb, a.person.id)) }} className="ml-auto underline">Remove</button>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <PersonPicker label="Promote" value={pick} onPick={setPick} />
        <button disabled={!pick} onClick={() => { if (pick) void run(async () => { await promote(sb, pick.id, v.personId!); setPick(null) }) }} className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">Make admin</button>
      </div>
    </div>
  )
}
