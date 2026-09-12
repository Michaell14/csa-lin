'use client'
import { useEffect, useRef, useState } from 'react'
import type { PersonHit } from '@/lib/api/people'
import { errorMessage } from '@/lib/errors'

export function SearchBox({ search, onPick, placeholder = 'Find a person' }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PersonHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!q.trim()) { setHits(null); return }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await search(q)
        if (mine === seq.current) { setHits(r); setError(null) }
      } catch (e) {
        if (mine === seq.current) setError(errorMessage(e))
      }
    }, 150)
    return () => clearTimeout(t)
  }, [q, search])

  return (
    <div className="relative">
      <input
        type="search"
        role="searchbox"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        className="input-sm w-56"
      />
      {(hits || error) && (
        <ul role="listbox" className="card absolute z-20 mt-2 w-72 overflow-hidden py-1 text-sm">
          {error && <li className="error px-3 py-1.5">{error}</li>}
          {hits && hits.length === 0 && <li className="px-3 py-1.5 text-ink-muted">No one found</li>}
          {hits?.map(h => (
            <li key={h.id} role="option" aria-selected={false}
                onClick={() => { onPick(h); setQ(''); setHits(null) }}
                className="cursor-pointer px-3 py-1.5 font-bold hover:bg-gold-tint">
              {h.display_name} <span className="font-medium text-ink-muted">&#39;{String(h.grad_year).slice(-2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
