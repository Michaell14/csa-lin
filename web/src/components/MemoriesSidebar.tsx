'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Lin } from '@/lib/types'
import { LinMemories } from './LinMemories'
import { PhotoIcon } from './icons'

const WIDTH_KEY = 'lins.memories.width'
const HEIGHT_KEY = 'lins.memories.height'
const OPEN_KEY = 'lins.memories.open'
function save(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Storage is optional. */ }
}

export function MemoriesSidebar({ lin, viewerKey }: { lin: Lin; viewerKey: string }) {
  const panel = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(360)
  const [height, setHeight] = useState(300)
  const [bounds, setBounds] = useState({ wide: false, width: 600, height: 400 })
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === 'true')
      const storedWidth = Number(localStorage.getItem(WIDTH_KEY))
      const storedHeight = Number(localStorage.getItem(HEIGHT_KEY))
      if (storedWidth > 0) setWidth(Math.min(600, Math.max(280, storedWidth)))
      if (storedHeight > 0) setHeight(Math.min(700, Math.max(140, storedHeight)))
    } catch { /* Use defaults when storage is unavailable. */ }
    const parent = panel.current?.parentElement
    if (!parent) return
    const update = () => setBounds({ wide: window.innerWidth >= 1024, width: Math.max(280, Math.min(600, parent.clientWidth - 240)), height: Math.max(140, parent.clientHeight - 240) })
    const observer = new ResizeObserver(update)
    observer.observe(parent)
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  function toggle(next: boolean) { setOpen(next); save(OPEN_KEY, String(next)) }
  const actualWidth = Math.min(width, bounds.width)
  const actualHeight = Math.min(height, bounds.height)
  function resize(value: number) {
    if (bounds.wide) {
      const next = Math.min(bounds.width, Math.max(280, value))
      setWidth(next); save(WIDTH_KEY, String(next))
    } else {
      const next = Math.min(bounds.height, Math.max(140, value))
      setHeight(next); save(HEIGHT_KEY, String(next))
    }
  }
  return <>
    {!open && <button onClick={() => toggle(true)} aria-expanded={false} aria-controls="lin-memories-sidebar" aria-label="Show memories" title="Show memories" className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent"><PhotoIcon size={18} />Memories</button>}
    <aside id="lin-memories-sidebar" ref={panel} aria-label="Memories sidebar"
    style={{ '--memories-width': `${actualWidth}px`, '--memories-height': `${actualHeight}px` } as CSSProperties}
    className={`relative min-h-0 shrink-0 flex-col border-t border-line bg-surface-muted lg:border-t-0 lg:border-l ${open ? 'flex h-[var(--memories-height)] lg:h-full lg:w-[var(--memories-width)]' : 'hidden'}`}>

    <div className={open ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
      <LinMemories key={`${lin.id}:${viewerKey}`} lin={lin} onClose={() => toggle(false)} />
    </div>
    {open && <div role="separator" tabIndex={0} aria-label="Resize memories sidebar"
      aria-orientation={bounds.wide ? 'vertical' : 'horizontal'} aria-valuemin={bounds.wide ? 280 : 140}
      aria-valuemax={bounds.wide ? bounds.width : bounds.height} aria-valuenow={bounds.wide ? actualWidth : actualHeight}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const rect = panel.current!.getBoundingClientRect()
        resize(bounds.wide ? rect.right - event.clientX : rect.bottom - event.clientY)
      }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onKeyDown={event => {
        const grow = bounds.wide ? 'ArrowLeft' : 'ArrowUp'
        const shrink = bounds.wide ? 'ArrowRight' : 'ArrowDown'
        if (event.key === grow || event.key === shrink) {
          event.preventDefault()
          resize((bounds.wide ? actualWidth : actualHeight) + (event.key === grow ? 24 : -24))
        }
      }}
      className="absolute -top-1.5 inset-x-0 z-10 h-3 touch-none cursor-row-resize hover:bg-line focus-visible:bg-line focus-visible:outline-none lg:inset-y-0 lg:-left-1.5 lg:right-auto lg:h-auto lg:w-3 lg:cursor-col-resize" />}
  </aside>
  </>
}
