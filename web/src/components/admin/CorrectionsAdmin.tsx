'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listCorrections, resolveCorrection, type CorrectionRequest } from '@/lib/api/corrections'
import { fetchPeopleByAuthUserIds, fetchPeopleByIds } from '@/lib/api/people'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'

export function CorrectionsAdmin({ onQueueChanged }: { onQueueChanged?: () => void }) {
  const sb = useMemo(() => createClient(), []), viewer = useViewer()
  const [items, setItems] = useState<CorrectionRequest[]>([]), [error, setError] = useState<string | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [reporters, setReporters] = useState<Map<string, string>>(new Map())
  const reload = useCallback(async () => {
    try {
      const rows = await listCorrections(sb)
      setItems(rows)
      const ids = [...new Set(rows.map(r => r.person_id).filter((x): x is string => !!x))]
      const reporterIds = [...new Set(rows.map(r => r.reporter_user_id))]
      const [people, reporterNames] = await Promise.all([fetchPeopleByIds(sb, ids), fetchPeopleByAuthUserIds(sb, reporterIds)])
      setNames(new Map(people.map(p => [p.id, p.display_name])))
      setReporters(reporterNames)
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])
  async function resolve(id: string, status: 'resolved' | 'dismissed') { setError(null); try { await resolveCorrection(sb, id, status, viewer.personId!) } catch (e) { setError(errorMessage(e)) } await reload(); onQueueChanged?.() }
  // Profile and relationship reports name the person they concern, and an admin
  // cannot investigate one without it. A missing-person request has no profile
  // yet, so its details are the only identification there is.
  const target = (item: CorrectionRequest) => item.person_id ? names.get(item.person_id) ?? item.person_id.slice(0, 8) : 'No profile yet (missing-person request)'
  return <div className="space-y-3 text-sm">{error && <p role="alert" className="error">{error}</p>}{items.length === 0 && <p className="text-ink-muted">No correction reports.</p>}
    {items.map(item => <article key={item.id} className="card p-3"><p className="label">{item.kind.replaceAll('_', ' ')}</p><p className="mt-1 font-medium">About: {target(item)}</p><p className="mt-1 whitespace-pre-wrap">{item.details}</p><p className="mt-1 break-words text-xs text-ink-muted">Submitted by {reporters.get(item.reporter_user_id) ?? `account ${item.reporter_user_id}`} · {new Date(item.created_at).toLocaleDateString()}</p><div className="mt-2 flex gap-2"><button onClick={() => resolve(item.id, 'resolved')} className="btn-sm-primary">Mark resolved</button><button onClick={() => resolve(item.id, 'dismissed')} className="btn-sm">Dismiss</button></div></article>)}
  </div>
}
