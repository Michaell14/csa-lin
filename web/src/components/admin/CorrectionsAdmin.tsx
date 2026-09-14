'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listCorrections, resolveCorrection, type CorrectionRequest } from '@/lib/api/corrections'
import { fetchPeopleByIds } from '@/lib/api/people'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'

export function CorrectionsAdmin() {
  const sb = useMemo(() => createClient(), []), viewer = useViewer()
  const [items, setItems] = useState<CorrectionRequest[]>([]), [error, setError] = useState<string | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const reload = useCallback(async () => {
    try {
      const rows = await listCorrections(sb)
      setItems(rows)
      const ids = [...new Set(rows.map(r => r.person_id).filter((x): x is string => !!x))]
      setNames(new Map((await fetchPeopleByIds(sb, ids)).map(p => [p.id, p.display_name])))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void reload() }, [reload])
  async function resolve(id: string, status: 'resolved' | 'dismissed') { setError(null); try { await resolveCorrection(sb, id, status, viewer.personId!) } catch (e) { setError(errorMessage(e)) } await reload() }
  // Profile and relationship reports name the person they concern, and an admin
  // cannot investigate one without it. A missing-person request has no profile
  // yet, so its details are the only identification there is.
  const target = (item: CorrectionRequest) => item.person_id ? names.get(item.person_id) ?? item.person_id.slice(0, 8) : 'Nobody on the lin yet'
  return <div className="space-y-3 text-sm">{error && <p role="alert" className="error">{error}</p>}{items.length === 0 && <p className="text-ink-muted">No correction reports.</p>}
    {items.map(item => <article key={item.id} className="card p-3"><p className="eyebrow">{item.kind.replaceAll('_', ' ')}</p><p className="mt-1 font-bold">{target(item)}</p><p className="mt-1 whitespace-pre-wrap">{item.details}</p><p className="mt-1 text-xs text-ink-muted">Submitted {new Date(item.created_at).toLocaleDateString()}</p><div className="mt-2 flex gap-2"><button onClick={() => resolve(item.id, 'resolved')} className="btn-sm-accent">Mark resolved</button><button onClick={() => resolve(item.id, 'dismissed')} className="btn-sm">Dismiss</button></div></article>)}
  </div>
}
