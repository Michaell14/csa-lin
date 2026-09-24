'use client'
import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

export const RAIL_WIDTH_KEY = 'lins.rail.width'
export const MIN_RAIL_WIDTH = 280
export const MAX_RAIL_WIDTH = 600
// Room the content beside the rail keeps when the rail is a column: enough
// graph to read.
const RESERVED_WIDTH = 340
function save(value: number) {
  try { localStorage.setItem(RAIL_WIDTH_KEY, String(value)) } catch { /* Storage is optional. */ }
}
function clamp(value: number, max: number) { return Math.min(max, Math.max(MIN_RAIL_WIDTH, value)) }

/**
 * The one width every side panel shares, remembered per browser and capped so
 * the rail never squeezes out the graph. `host` is the element the rail is a
 * column of; its size sets the cap.
 */
export function useRailWidth(host: RefObject<HTMLElement | null>) {
  const [width, setWidthState] = useState(360)
  const [maxWidth, setMaxWidth] = useState(MAX_RAIL_WIDTH)
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(RAIL_WIDTH_KEY))
      if (stored > 0) setWidthState(clamp(stored, MAX_RAIL_WIDTH))
    } catch { /* Use the default when storage is unavailable. */ }
    const el = host.current
    if (!el) return
    const update = () => setMaxWidth(clamp(el.clientWidth - RESERVED_WIDTH, MAX_RAIL_WIDTH))
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    return () => observer.disconnect()
  }, [host])
  function setWidth(next: number) {
    const value = clamp(next, maxWidth)
    setWidthState(value); save(value)
  }
  return { width: Math.min(width, maxWidth), maxWidth, setWidth }
}

/**
 * The single right-hand panel: a bottom sheet on phones, an overlay on the
 * graph from md, and a resizable column from lg. Whatever it holds, a profile
 * or the memories timeline, gets the same place and the same width, so the two
 * can never stack.
 */
export function RightRail({ label, id, width, maxWidth, onResize, children }: { label: string; id?: string; width: number; maxWidth: number; onResize: (width: number) => void; children: ReactNode }) {
  return <aside id={id} aria-label={label} style={{ '--rail-width': `${width}px` } as CSSProperties}
    // Sized against the dynamic viewport, so the sheet fits what is actually
    // visible once a phone's browser bars come and go, and padded clear of the
    // home indicator and the notch while it spans the screen.
    className="rise fixed bottom-0 left-0 right-0 z-30 flex max-h-[75dvh] flex-col overflow-y-auto rounded-t-lg bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-elevated md:absolute md:p-0 md:top-0 md:left-auto md:z-20 md:max-h-none md:w-[var(--rail-width)] md:rounded-none md:border-l md:border-line lg:relative lg:shrink-0 lg:shadow-none">
    {children}
    <div role="separator" tabIndex={0} aria-label="Resize side panel" aria-orientation="vertical"
      aria-valuemin={MIN_RAIL_WIDTH} aria-valuemax={maxWidth} aria-valuenow={width}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        onResize(clamp(event.currentTarget.parentElement!.getBoundingClientRect().right - event.clientX, maxWidth))
      }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        onResize(clamp(width + (event.key === 'ArrowLeft' ? 24 : -24), maxWidth))
      }}
      className="absolute inset-y-0 -left-1.5 z-10 hidden w-3 touch-none cursor-col-resize hover:bg-line focus-visible:bg-line focus-visible:outline-none lg:block" />
  </aside>
}
