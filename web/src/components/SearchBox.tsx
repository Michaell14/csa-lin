'use client'
import { useEffect, useId, useRef, useState } from 'react'
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
  const [active, setActive] = useState(-1)
  const seq = useRef(0)
  const id = `person-search-${useId().replace(/:/g, '')}`

  useEffect(() => {
    if (!q.trim()) { setHits(null); return }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await search(q)
        if (mine === seq.current) { setHits(r); setActive(r.length ? 0 : -1); setError(null) }
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
        role="combobox"
        value={q}
        onChange={e => { seq.current++; setQ(e.target.value); setHits(null); setError(null); setActive(-1) }}
        onKeyDown={e => {
          if (!hits?.length) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQ(''); setHits(null) }; return }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % hits.length) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + hits.length) % hits.length) }
          if (e.key === 'Enter' && active >= 0) { e.preventDefault(); onPick(hits[active]!); setQ(''); setHits(null) }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQ(''); setHits(null) }
        }}
        aria-autocomplete="list"
        aria-label={placeholder}
        aria-expanded={Boolean(hits || error)}
        aria-controls={`${id}-results`}
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        placeholder={placeholder}
        className="input-sm w-full sm:w-56"
      />
      {(hits || error) && (
        <ul id={`${id}-results`} role="listbox" className="card fixed inset-x-3 top-14 z-20 max-h-[70vh] overflow-y-auto py-1 text-sm sm:absolute sm:inset-x-auto sm:top-auto sm:mt-2 sm:w-72">
          {error && <li className="error px-3 py-1.5">{error}</li>}
          {hits && hits.length === 0 && <li className="px-3 py-1.5 text-ink-muted">No one found</li>}
          {hits?.map((h, index) => (
            <li id={`${id}-option-${index}`} key={h.id} role="option" aria-selected={active === index}
                onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)}
                onClick={() => { onPick(h); setQ(''); setHits(null) }}
                className={`cursor-pointer px-3 py-3 sm:py-1.5 ${active === index ? 'bg-gold-tint' : 'hover:bg-gold-tint'}`}>
              <span className="font-bold">{h.preferred_name || h.display_name}</span> <span className="font-medium text-ink-muted">&#39;{String(h.grad_year).slice(-2)}</span>
              {(h.major || h.school || h.current_city || h.csa_role) && <span className="block truncate text-xs font-medium text-ink-muted">{[h.major, h.school, h.csa_role, h.current_city].filter(Boolean).join(' · ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
