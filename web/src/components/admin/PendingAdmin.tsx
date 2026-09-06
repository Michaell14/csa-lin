'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminResolveLink, listPendingLinks } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { Link } from '@/lib/types'

export function PendingAdmin() {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [links, setLinks] = useState<Link[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ls = await listPendingLinks(sb)
      setLinks(ls)
      const ids = [...new Set(ls.flatMap(l => [l.big_id, l.little_id, l.proposed_by].filter((x): x is string => !!x)))]
      setNames(new Map((await fetchPeopleByIds(sb, ids)).map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])

  const n = (id: string | null) => (id ? names.get(id) ?? id.slice(0, 8) : '—')
  async function resolve(l: Link, d: 'accept' | 'reject') {
    setError(null)
    try { await adminResolveLink(sb, l.id, d, v.personId!); await reload(); await v.refresh() } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {links.length === 0 && <p className="text-neutral-500">No pending requests.</p>}
      <ul className="flex flex-col gap-1">
        {links.map(l => (
          <li key={l.id} className="flex items-center gap-2">
            <span>{n(l.big_id)} → {n(l.little_id)} <span className="text-neutral-500">(proposed by {n(l.proposed_by)})</span></span>
            <button onClick={() => resolve(l, 'accept')} className="ml-auto rounded bg-neutral-900 px-2 py-0.5 text-white">Accept</button>
            <button onClick={() => resolve(l, 'reject')} className="rounded border px-2 py-0.5">Reject</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
