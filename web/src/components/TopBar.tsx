'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'
import { useViewer } from '@/lib/viewer'

function SearchIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" strokeLinecap="round" />
    </svg>
  )
}

export function TopBar({ search, onPick, onOpenSelf }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  onOpenSelf: () => void
}) {
  const v = useViewer()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // A menu you can't dismiss with the mouse or Escape is a trap on every device.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = v.email ?? '…'
  return (
    <header className="flex flex-col border-b">
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        <span className="font-semibold">CSA Lins</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <SearchBox search={search} onPick={onPick} />
          </div>
          <button
            onClick={() => setSearchOpen(o => !o)}
            aria-label="Search people"
            aria-expanded={searchOpen}
            className="rounded-md border p-2 text-ink-muted hover:bg-surface-hover sm:hidden"
          >
            <SearchIcon />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              onClick={() => setOpen(o => !o)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={open}
              className="relative flex items-center rounded-full border px-2 py-1.5 text-sm hover:bg-surface-hover"
            >
              {/* The full address is useful on a wide bar and just noise on a phone. */}
              <span className="hidden max-w-[14rem] truncate sm:inline">{label}</span>
              <span aria-hidden className="sm:hidden">{label.slice(0, 2).toUpperCase()}</span>
              {v.pendingCount > 0 && (
                <span aria-label={`${v.pendingCount} pending requests`} className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{v.pendingCount}</span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-surface text-sm shadow">
                {v.personId
                  ? <button className="block w-full px-3 py-2.5 text-left hover:bg-surface-hover" onClick={() => { setOpen(false); onOpenSelf() }}>My profile</button>
                  : <p className="px-3 py-2 text-ink-faint">You&#39;re not on a lin yet. Ask a CSA board member to add you.</p>}
                {v.isAdmin && <Link href="/admin" className="block px-3 py-2.5 hover:bg-surface-hover">Admin</Link>}
                <button className="block w-full px-3 py-2.5 text-left hover:bg-surface-hover" onClick={() => { v.signOut().catch(() => { window.location.href = '/login' }) }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {searchOpen && (
        <div className="border-t px-3 py-2 sm:hidden">
          <SearchBox search={search} onPick={hit => { setSearchOpen(false); onPick(hit) }} className="w-full" autoFocus />
        </div>
      )}
    </header>
  )
}
