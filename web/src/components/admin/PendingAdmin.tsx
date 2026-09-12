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
      {error && <p role="alert" className="alert">{error}</p>}
      {links.length === 0 && <p className="text-ink-muted">No pending requests.</p>}
      <ul className="flex max-w-2xl flex-col gap-3">
        {links.map(l => (
          <li key={l.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <span>{n(l.big_id)} → {n(l.little_id)} <span className="font-medium text-ink-muted">(proposed by {n(l.proposed_by)})</span></span>
            <button onClick={() => resolve(l, 'accept')} className="btn-sm-accent ml-auto">Accept</button>
            <button onClick={() => resolve(l, 'reject')} className="btn-sm">Reject</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
