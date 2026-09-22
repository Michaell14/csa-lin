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
  // Whether the results are showing. They close when focus leaves the box or
  // a tap lands outside it, and come back with the next keystroke or focus, so
  // the list never sits over the page after the search is abandoned.
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const id = `person-search-${useId().replace(/:/g, '')}`

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

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

  const showing = open && Boolean(hits || error)
  return (
    <div ref={box} className="relative">
      <input
        type="search"
        role="combobox"
        value={q}
        onChange={e => { seq.current++; setQ(e.target.value); setHits(null); setError(null); setActive(-1); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (!open && hits?.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); return }
          if (!showing || !hits?.length) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQ(''); setHits(null) }; return }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % hits.length) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + hits.length) % hits.length) }
          if (e.key === 'Enter' && active >= 0) { e.preventDefault(); onPick(hits[active]!); setQ(''); setHits(null) }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQ(''); setHits(null) }
        }}
        aria-autocomplete="list"
        aria-label={placeholder}
        aria-expanded={showing}
        aria-controls={`${id}-results`}
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        placeholder={placeholder}
        className="input-sm w-full sm:w-56"
      />
      {showing && (
        <ul id={`${id}-results`} role="listbox" onMouseDown={e => e.preventDefault()} className="card pop fixed inset-x-3 top-14 z-20 max-h-[70vh] overflow-y-auto p-1 text-sm shadow-elevated sm:absolute sm:inset-x-auto sm:top-auto sm:mt-1 sm:w-72">
          {error && <li className="error px-3 py-1.5">{error}</li>}
          {hits && hits.length === 0 && <li className="px-3 py-1.5 text-ink-muted">No one found</li>}
          {hits?.map((h, index) => (
            <li id={`${id}-option-${index}`} key={h.id} role="option" aria-selected={active === index}
                onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)}
                onClick={() => { onPick(h); setQ(''); setHits(null) }}
                className={`cursor-pointer rounded px-3 py-3 transition-colors duration-100 sm:py-1.5 ${active === index ? 'bg-surface-hover' : ''}`}>
              <span className="font-medium">{h.display_name}</span> <span className="text-ink-muted">&#39;{String(h.grad_year).slice(-2)}</span>
              {h.major && <span className="block truncate text-xs text-ink-muted">{h.major}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
