'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { demote, listAdmins, promote, type AdminEntry } from '@/lib/api/admin'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { PersonHit } from '@/lib/api/people'
import { PersonPicker } from '@/components/admin/PersonPicker'

export function AdminsAdmin() {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [pick, setPick] = useState<PersonHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => { try { setAdmins(await listAdmins(sb)) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void reload() }, [reload])

  async function run(fn: () => Promise<void>) { setError(null); try { await fn(); await reload(); await v.refresh() } catch (e) { setError(errorMessage(e)) } }

  return (
    <div className="flex max-w-md flex-col gap-3 text-sm">
      {error && <p role="alert" className="alert">{error}</p>}
      <ul className="flex flex-col gap-3">
        {admins.map(a => (
          <li key={a.person.id} className="card flex items-center gap-3 px-4 py-3">
            <span>{a.person.display_name} <span className="font-medium text-ink-muted">since {a.granted_at.slice(0, 10)}</span></span>
            <button onClick={() => { if (window.confirm(`Remove ${a.person.display_name} as admin?`)) void run(() => demote(sb, a.person.id)) }} className="link ml-auto">Remove</button>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-3">
        <PersonPicker label="Promote" value={pick} onPick={setPick} />
        <button disabled={!pick} onClick={() => { if (pick) void run(async () => { await promote(sb, pick.id, v.personId!); setPick(null) }) }} className="btn-sm-accent">Make admin</button>
      </div>
    </div>
  )
}
