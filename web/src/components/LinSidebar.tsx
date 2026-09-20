'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lin } from '@/lib/types'
import { ChevronLeftIcon, ChevronRightIcon, SortIcon } from '@/components/icons'

const MIN_WIDTH = 160
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 220
// Tailwind's sm breakpoint: below it the viewport is a phone held upright.
const NARROW_WIDTH = 640
const WIDTH_KEY = 'lins.sidebar.width'
const OPEN_KEY = 'lins.sidebar.open'
const SORT_KEY = 'lins.sidebar.sort'
type SortMode = 'asc' | 'desc' | 'most' | 'fewest'

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

// Room the rest of the row needs: the profile panel is a static 320px column
// from md up (below that it is a bottom sheet over the graph), and the graph
// itself has to stay usable. A width chosen on a desktop is remembered, but it
// must not swallow the graph when the same person opens the app on a phone.
const PANEL_WIDTH = 320
const MIN_GRAPH_WIDTH = 280
const MD_WIDTH = 768

const viewportMax = () => {
  if (typeof window === 'undefined') return MAX_WIDTH
  const reserved = MIN_GRAPH_WIDTH + (window.innerWidth >= MD_WIDTH ? PANEL_WIDTH : 0)
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - reserved))
}

export function LinSidebar({ lins, memberCounts = {}, selectedId, onSelect, onPrefetch }: {
  lins: Lin[]
  memberCounts?: Record<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  // Called when a lin is likely to be opened next (pointer over it, or it has
  // keyboard focus), so its graph can be loaded ahead of the click.
  onPrefetch?: (id: string) => void
}) {
  // Neither the server nor the first client paint can read localStorage or the
  // viewport width, so until the effect below runs we render both the rail and
  // the panel and let a media query on NARROW_WIDTH show the right one. That
  // matches the defaults picked below, so a first visit paints its final layout
  // instead of opening a 220px panel and collapsing it a frame later.
  const [restored, setRestored] = useState<{ open: boolean; width: number } | null>(null)
  const [maxWidth, setMaxWidth] = useState(MAX_WIDTH)
  const [dragging, setDragging] = useState(false)
  const [sort, setSort] = useState<SortMode>('asc')
  const asideRef = useRef<HTMLElement>(null)
  const open = restored?.open ?? true
  // The stored width is the preference; what is painted is that, capped to what
  // the row can spare. Resizing writes the preference, never the cap, so a width
  // chosen on a desktop comes back there after a visit on a phone.
  const preferredWidth = restored?.width ?? DEFAULT_WIDTH
  const width = Math.min(preferredWidth, maxWidth)

  useEffect(() => {
    const update = () => setMaxWidth(viewportMax())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // With nothing stored yet, a phone starts collapsed: open, the panel would take
  // well over half the width and leave the graph a sliver. A stored choice wins at
  // any size -- someone who opened it here meant to.
  useEffect(() => {
    const narrow = window.innerWidth < NARROW_WIDTH
    setRestored({
      open: readStored(OPEN_KEY, raw => raw !== 'false', !narrow),
      width: readStored(WIDTH_KEY, raw => clamp(Number(raw) || DEFAULT_WIDTH), DEFAULT_WIDTH),
    })
  }, [])

  useEffect(() => {
    setSort(readStored(SORT_KEY, raw => ['asc', 'desc', 'most', 'fewest'].includes(raw) ? raw as SortMode : 'asc', 'asc'))
  }, [])

  const sortedLins = [...lins].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id)
    if (sort === 'asc') return byName
    if (sort === 'desc') return -byName
    const aCount = memberCounts[a.id], bCount = memberCounts[b.id]
    if (aCount === undefined || bCount === undefined) {
      if (aCount === undefined && bCount === undefined) return byName
      return aCount === undefined ? 1 : -1
    }
    return (sort === 'most' ? bCount - aCount : aCount - bCount) || byName
  })

  const resize = useCallback((next: number) => {
    const w = clamp(next)
    setRestored(s => ({ open: s?.open ?? true, width: w }))
    store(WIDTH_KEY, String(w))
  }, [])

  // Each control names the state it moves to rather than toggling: on the first
  // paint the rail and the panel are both mounted and only CSS decides which one
  // is visible, so a toggle could act on the state the viewer cannot see.
  const setOpen = useCallback((next: boolean) => {
    store(OPEN_KEY, String(next))
    setRestored(s => ({ open: next, width: s?.width ?? DEFAULT_WIDTH }))
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

  // `unrestored` is only true for the first paint; see the comment above.
  const unrestored = restored === null

  const rail = (extra = '') => (
    <div className={`flex shrink-0 flex-col items-center border-r border-line bg-surface-muted px-1.5 py-2 ${extra}`}>
      <button
        onClick={() => setOpen(true)}
        aria-label="Show lins"
        aria-expanded={false}
        className="icon-btn"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )

  if (!open && !unrestored) return rail()

  return (
    <>
      {unrestored && rail('sm:hidden')}
      <aside
        ref={asideRef}
        style={{ width }}
        className={`relative flex shrink-0 flex-col border-r border-line bg-surface-muted ${unrestored ? 'hidden sm:flex' : ''}`}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="heading text-base">Lins</h2>
          <div className="flex items-center gap-1">
            <label className="relative flex h-7 w-[68px] items-center rounded hover:bg-surface-hover">
              <SortIcon size={14} className="pointer-events-none absolute right-1" />
              <select
                aria-label="Sort lins"
                title="Sort lins"
                value={sort}
                onChange={event => {
                  const next = event.target.value as SortMode
                  setSort(next)
                  store(SORT_KEY, next)
                }}
                className="h-full w-full cursor-pointer appearance-none bg-transparent pr-[21px] text-right text-[11px] font-medium text-ink-body [text-align-last:right] outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="asc">A–Z</option>
                <option value="desc">Z–A</option>
                <option value="most">Most</option>
                <option value="fewest">Fewest</option>
              </select>
            </label>
            <button
              onClick={() => setOpen(false)}
              aria-label="Hide lins"
              aria-expanded={true}
              className="icon-btn"
            >
              <ChevronLeftIcon />
            </button>
          </div>
        </div>
        <div role="tablist" aria-orientation="vertical" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1 pb-3">
          {sortedLins.map(lin => {
            const selected = lin.id === selectedId
            const memberCount = memberCounts[lin.id]
            return (
              <button
                key={lin.id}
                role="tab"
                aria-selected={selected}
                aria-label={memberCount === undefined ? undefined : `${lin.name}, ${memberCount} ${memberCount === 1 ? 'person' : 'people'}`}
                onClick={() => onSelect(lin.id)}
                onPointerEnter={onPrefetch && (() => onPrefetch(lin.id))}
                onFocus={onPrefetch && (() => onPrefetch(lin.id))}
                className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-[background-color,box-shadow] duration-100 ${selected ? 'bg-white font-medium text-ink shadow-border' : 'text-ink-body hover:bg-surface-hover'}`}
              >
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: lin.color }} />
                <span className="min-w-0 flex-1 truncate">{lin.name}</span>
                {memberCount !== undefined && <span aria-hidden className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-surface-hover px-1 text-[10px] font-medium tabular-nums text-ink-body" title={`${memberCount} ${memberCount === 1 ? 'person' : 'people'}`}>{memberCount}</span>}
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
            if (e.key === 'ArrowLeft') { e.preventDefault(); resize(preferredWidth - 16) }
            if (e.key === 'ArrowRight') { e.preventDefault(); resize(preferredWidth + 16) }
          }}
          className="absolute inset-y-0 -right-1.5 w-3 cursor-col-resize transition-colors duration-100 hover:bg-line"
        />
      </aside>
    </>
  )
}
