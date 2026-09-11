'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lin } from '@/lib/types'

const MIN_WIDTH = 160
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 220
const WIDTH_KEY = 'lins.sidebar.width'
const OPEN_KEY = 'lins.sidebar.open'

function readStored<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : parse(raw)
  } catch { return fallback }
}

function store(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

const clamp = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w))

// Tailwind's md breakpoint: below it the panel floats over the graph instead of
// squeezing it, so it starts collapsed and closes again once a lin is picked.
const isNarrow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches

export function LinSidebar({ lins, selectedId, onSelect }: { lins: Lin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  // Restore the persisted size and state after mount so the server and client markup match.
  useEffect(() => {
    const stored = readStored<boolean | null>(OPEN_KEY, raw => raw !== 'false', null)
    setOpen(stored ?? !isNarrow())
    setWidth(readStored(WIDTH_KEY, raw => clamp(Number(raw) || DEFAULT_WIDTH), DEFAULT_WIDTH))
  }, [])

  const resize = useCallback((next: number) => {
    const w = clamp(next)
    setWidth(w)
    store(WIDTH_KEY, String(w))
  }, [])

  const toggle = useCallback(() => {
    setOpen(o => { store(OPEN_KEY, String(!o)); return !o })
  }, [])

  const select = useCallback((id: string) => {
    onSelect(id)
    if (isNarrow()) setOpen(false)
  }, [onSelect])

  useEffect(() => {
    if (!dragging) return
    function onMove(e: PointerEvent) {
      const left = asideRef.current?.getBoundingClientRect().left ?? 0
      resize(e.clientX - left)
    }
    function onUp() { setDragging(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
    }
  }, [dragging, resize])

  if (!open) {
    return (
      <div className="flex shrink-0 flex-col items-center border-r bg-surface-muted px-1 py-2">
        <button
          onClick={toggle}
          aria-label="Show lins"
          aria-expanded={false}
          className="rounded p-2 text-sm text-ink-muted hover:bg-surface-active"
        >
          ›
        </button>
      </div>
    )
  }

  return (
    <aside
      ref={asideRef}
      style={{ width }}
      className="absolute inset-y-0 left-0 z-20 flex shrink-0 flex-col border-r bg-surface-muted shadow-lg md:relative md:inset-y-auto md:left-auto md:z-auto md:shadow-none"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Lins</h2>
        <button
          onClick={toggle}
          aria-label="Hide lins"
          aria-expanded={true}
          className="rounded p-2 text-sm text-ink-muted hover:bg-surface-active"
        >
          ‹
        </button>
      </div>
      <div role="tablist" aria-orientation="vertical" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
        {lins.map(lin => {
          const selected = lin.id === selectedId
          return (
            <button
              key={lin.id}
              role="tab"
              aria-selected={selected}
              onClick={() => select(lin.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${selected ? 'bg-surface font-medium shadow-sm' : 'hover:bg-surface-active'}`}
            >
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: lin.color }} />
              <span className="truncate">{lin.name}</span>
            </button>
          )
        })}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize lins panel"
        tabIndex={0}
        onPointerDown={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); resize(width - 16) }
          if (e.key === 'ArrowRight') { e.preventDefault(); resize(width + 16) }
        }}
        className="absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize hover:bg-surface-active md:block"
      />
    </aside>
  )
}
