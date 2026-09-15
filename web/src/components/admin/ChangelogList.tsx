'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listChangelog } from '@/lib/api/admin'
import { fetchPeopleByIds } from '@/lib/api/people'
import { summarizeChange } from '@/lib/changelog'
import { errorMessage } from '@/lib/errors'
import type { ChangelogRow } from '@/lib/types'

const PAGE = 50

export function ChangelogList() {
  const sb = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ChangelogRow[]>([])
  const [actors, setActors] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(true)

  const load = useCallback(async (before?: number) => {
    try {
      const page = await listChangelog(sb, { before, limit: PAGE })
      setRows(r => (before === undefined ? page : [...r, ...page]))
      setMore(page.length === PAGE)
      const ids = [...new Set(page.map(r => r.actor_id).filter((x): x is string => !!x))]
      const people = await fetchPeopleByIds(sb, ids)
      setActors(a => new Map([...a, ...people.map(p => [p.id, p.display_name] as const)]))
    } catch (e) { setError(errorMessage(e)) }
  }, [sb])
  useEffect(() => { void load() }, [load])

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p role="alert" className="alert">{error}</p>}
      <ul className="card flex flex-col gap-1 p-4 font-mono text-xs">
        {rows.map(r => (
          <li key={r.id}>
            <span className="text-ink-muted">{r.created_at.replace('T', ' ').slice(0, 16)}</span>{' '}
            <span className="font-medium">{r.actor_id ? actors.get(r.actor_id) ?? r.actor_id.slice(0, 8) : 'system'}</span>{' '}
            {summarizeChange(r)}
          </li>
        ))}
      </ul>
      {more && rows.length > 0 && <button onClick={() => load(rows[rows.length - 1].id)} className="btn-sm self-start">Load more</button>}
    </div>
  )
}
