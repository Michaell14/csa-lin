'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lin } from '@/lib/types'

const MIN_WIDTH = 160
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 220
// Tailwind's sm breakpoint: below it the viewport is a phone held upright.
const NARROW_WIDTH = 640
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

export function LinSidebar({ lins, selectedId, onSelect }: { lins: Lin[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  // Restore the persisted size and state after mount so the server and client markup match.
  // With nothing stored yet, a phone starts collapsed: open, the panel would take
  // well over half the width and leave the graph a sliver. A stored choice wins at
  // any size -- someone who opened it here meant to.
  useEffect(() => {
    const narrow = window.innerWidth < NARROW_WIDTH
    setOpen(readStored(OPEN_KEY, raw => raw !== 'false', !narrow))
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
      <div className="flex shrink-0 flex-col items-center border-r-[3px] border-ink bg-cream px-1.5 py-2">
        <button
          onClick={toggle}
          aria-label="Show lins"
          aria-expanded={false}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold text-ink hover:bg-gold-tint"
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
      className="relative flex shrink-0 flex-col border-r-[3px] border-ink bg-cream"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="eyebrow">Lins</h2>
        <button
          onClick={toggle}
          aria-label="Hide lins"
          aria-expanded={true}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold text-ink hover:bg-gold-tint"
        >
          ‹
        </button>
      </div>
      <div role="tablist" aria-orientation="vertical" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-1 pb-3">
        {lins.map(lin => {
          const selected = lin.id === selectedId
          return (
            <button
              key={lin.id}
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(lin.id)}
              className={`flex h-10 items-center gap-2.5 rounded-full border-[3px] px-3 text-left text-[15px] font-bold ${selected ? 'border-ink bg-white shadow-sticker-sm' : 'border-transparent hover:bg-white'}`}
            >
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-ink" style={{ backgroundColor: lin.color }} />
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
        className="absolute inset-y-0 -right-1.5 w-3 cursor-col-resize hover:bg-gold"
      />
    </aside>
  )
}
