'use client'
import { useEffect, useRef, useState } from 'react'
import type { PersonHit } from '@/lib/api/people'

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
        if (mine === seq.current) setError(e instanceof Error ? e.message : 'Search failed')
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
        className="w-56 rounded-md border px-2 py-1 text-sm"
      />
      {(hits || error) && (
        <ul role="listbox" className="absolute z-20 mt-1 w-72 rounded-md border bg-white shadow">
          {error && <li className="px-2 py-1 text-sm text-red-700">{error}</li>}
          {hits && hits.length === 0 && <li className="px-2 py-1 text-sm text-neutral-500">No one found</li>}
          {hits?.map(h => (
            <li key={h.id} role="option" aria-selected={false}
                onClick={() => { onPick(h); setQ(''); setHits(null) }}
                className="cursor-pointer px-2 py-1 text-sm hover:bg-neutral-100">
              {h.display_name} <span className="text-neutral-500">&#39;{String(h.grad_year).slice(-2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
