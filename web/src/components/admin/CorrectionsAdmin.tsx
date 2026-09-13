'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listCorrections, resolveCorrection, type CorrectionRequest } from '@/lib/api/corrections'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'

export function CorrectionsAdmin() {
  const sb = useMemo(() => createClient(), []), viewer = useViewer()
  const [items, setItems] = useState<CorrectionRequest[]>([]), [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => { try { setItems(await listCorrections(sb)) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void reload() }, [reload])
  async function resolve(id: string, status: 'resolved' | 'dismissed') { try { await resolveCorrection(sb, id, status, viewer.personId!); await reload() } catch (e) { setError(errorMessage(e)) } }
  return <div className="space-y-3 text-sm">{error && <p role="alert" className="error">{error}</p>}{items.length === 0 && <p className="text-ink-muted">No correction reports.</p>}
    {items.map(item => <article key={item.id} className="card p-3"><p className="eyebrow">{item.kind.replaceAll('_', ' ')}</p><p className="mt-1 whitespace-pre-wrap">{item.details}</p><p className="mt-1 text-xs text-ink-muted">Submitted {new Date(item.created_at).toLocaleDateString()}</p><div className="mt-2 flex gap-2"><button onClick={() => resolve(item.id, 'resolved')} className="btn-sm-accent">Mark resolved</button><button onClick={() => resolve(item.id, 'dismissed')} className="btn-sm">Dismiss</button></div></article>)}
  </div>
}
