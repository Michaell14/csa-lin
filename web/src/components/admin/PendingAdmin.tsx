'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminResolveLink, adminResolveLinkRemoval, listPendingLinks, listPendingLinkRemovals, type LinkRemovalRequest } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { Link } from '@/lib/types'

export function PendingAdmin({ onQueueChanged }: { onQueueChanged?: () => void }) {
  const sb = useMemo(() => createClient(), [])
  const v = useViewer()
  const [links, setLinks] = useState<Link[]>([])
  const [removals, setRemovals] = useState<LinkRemovalRequest[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [ls, pendingRemovals] = await Promise.all([listPendingLinks(sb), listPendingLinkRemovals(sb)])
      setLinks(ls)
      setRemovals(pendingRemovals)
      const ids = [...new Set([
        ...ls.flatMap(l => [l.big_id, l.little_id, l.proposed_by]),
        ...pendingRemovals.flatMap(r => [r.big_id, r.little_id, r.requested_by]),
      ].filter((x): x is string => !!x))]
      setNames(new Map((await fetchPeopleByIds(sb, ids)).map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])

  const n = (id: string | null) => (id ? names.get(id) ?? id.slice(0, 8) : '—')
  async function resolve(l: Link, d: 'accept' | 'reject') {
    setError(null)
    try { await adminResolveLink(sb, l.id, d, v.personId!); await reload(); onQueueChanged?.(); await v.refresh() } catch (e) { setError(errorMessage(e)) }
  }
  async function resolveRemoval(r: LinkRemovalRequest, approve: boolean) {
    setError(null)
    try { await adminResolveLinkRemoval(sb, r.id, approve); await reload(); onQueueChanged?.(); await v.refresh() }
    catch (e) { setError(errorMessage(e)) }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p role="alert" className="alert">{error}</p>}
      {links.length === 0 && removals.length === 0 && <p className="text-ink-muted">No pending requests.</p>}
      {links.length > 0 && <p className="label">Add links</p>}
      <ul className="flex max-w-2xl flex-col gap-3">
        {links.map(l => (
          <li key={l.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <span>{n(l.big_id)} → {n(l.little_id)} <span className="text-ink-muted">(proposed by {n(l.proposed_by)})</span></span>
            <button onClick={() => resolve(l, 'accept')} className="btn-sm-primary ml-auto">Accept</button>
            <button onClick={() => resolve(l, 'reject')} className="btn-sm">Reject</button>
          </li>
        ))}
      </ul>
      {removals.length > 0 && <p className="label mt-3">Remove links</p>}
      <ul className="flex max-w-2xl flex-col gap-3">
        {removals.map(r => (
          <li key={r.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <span>Remove {n(r.big_id)} → {n(r.little_id)} <span className="text-ink-muted">(requested by {n(r.requested_by)})</span></span>
            <button onClick={() => resolveRemoval(r, true)} className="btn-sm-primary ml-auto">Approve removal</button>
            <button onClick={() => resolveRemoval(r, false)} className="btn-sm">Reject</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
