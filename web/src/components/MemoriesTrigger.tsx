'use client'
import { useEffect, useState } from 'react'
import { PhotoIcon } from './icons'

export const MEMORIES_OPEN_KEY = 'lins.memories.open'

/** Whether the viewer last left the memories timeline open, remembered per browser. */
export function useMemoriesOpen() {
  const [open, setOpenState] = useState(false)
  useEffect(() => {
    try { setOpenState(localStorage.getItem(MEMORIES_OPEN_KEY) === 'true') } catch { /* Storage is optional. */ }
  }, [])
  function setOpen(next: boolean) {
    setOpenState(next)
    try { localStorage.setItem(MEMORIES_OPEN_KEY, String(next)) } catch { /* Storage is optional. */ }
  }
  return { open, setOpen }
}

// `shifted` moves the button clear of the side panel while a profile occupies
// it: from md the panel overlays the graph's right edge and would otherwise
// swallow clicks meant for the button. From lg the panel is its own column.
export function MemoriesTrigger({ shifted, onOpen }: { shifted: boolean; onOpen: () => void }) {
  return <button onClick={onOpen} aria-expanded={false} aria-controls="lin-memories-sidebar" aria-label="Show memories" title="Show memories"
    className={`absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${shifted ? 'md:right-[calc(var(--rail-width)+0.75rem)] lg:right-3' : ''}`}>
    <PhotoIcon size={18} />Memories
  </button>
}
