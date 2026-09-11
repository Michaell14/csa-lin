'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { PersonHit } from '@/lib/api/people'
import { errorMessage } from '@/lib/errors'
import { useEscapeLayer } from '@/lib/hooks/useEscapeLayer'

export function SearchBox({ search, onPick, placeholder = 'Find a person', className = 'w-56', autoFocus = false }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PersonHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const seq = useRef(0)
  const listId = useId()

  useEffect(() => {
    if (!q.trim()) { seq.current++; setHits(null); return }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await search(q)
        if (mine === seq.current) { setHits(r); setActive(0); setError(null) }
      } catch (e) {
        if (mine === seq.current) setError(errorMessage(e))
      }
    }, 150)
    return () => clearTimeout(t)
  }, [q, search])

  const idle = focused && !q.trim()
  const open = !!(hits || error) || idle

  function choose(hit: PersonHit) {
    onPick(hit)
    setQ('')
    close()
  }

  // Bumping the sequence retires whatever search is still in flight. Without it
  // a response that lands after a dismissal repopulates the list and reopens
  // the box the user just closed, including the common case where Escape came
  // while the request was still pending and nothing was on screen yet.
  function close() { seq.current++; setHits(null); setError(null) }

  // The list only owns Escape while it is the topmost thing on screen, so
  // dismissing it never also closes the panel behind it.
  useEscapeLayer(focused || open, () => { if (!open) setQ(''); close() })

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!hits || hits.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % hits.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + hits.length) % hits.length) }
    if (e.key === 'Enter') { e.preventDefault(); const hit = hits[active]; if (hit) choose(hit) }
  }

  const activeId = hits && hits[active] ? `${listId}-${hits[active].id}` : undefined

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={placeholder}
        autoFocus={autoFocus}
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); close() }}
        placeholder={placeholder}
        className={`rounded-md border px-2 py-1 text-sm ${className}`}
      />
      {open && (
        // Keep the input focused through the click so onBlur doesn't drop the pick.
        <ul id={listId} role="listbox" onMouseDown={e => e.preventDefault()}
            className="absolute z-20 mt-1 max-h-72 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-surface shadow">
          {idle && <li className="px-2 py-1 text-sm text-ink-faint">Type a name to search everyone on every lin</li>}
          {error && <li className="px-2 py-1 text-sm text-danger">{error}</li>}
          {hits && hits.length === 0 && <li className="px-2 py-1 text-sm text-ink-faint">No one found</li>}
          {hits?.map((h, i) => (
            <li key={h.id} id={`${listId}-${h.id}`} role="option" aria-selected={i === active}
                onClick={() => choose(h)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-2 py-1 text-sm ${i === active ? 'bg-surface-hover' : ''}`}>
              {h.display_name}{' '}
              <span className="text-ink-faint">
                &#39;{String(h.grad_year).slice(-2)}{h.major ? ` · ${h.major}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
