'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'
import { useViewer } from '@/lib/viewer'
import { ActivityInbox } from '@/components/ActivityInbox'
import { BrandTitle } from '@/components/BrandTitle'

export function TopBar({ search, onPick, onOpenSelf }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  onOpenSelf: () => void
}) {
  const v = useViewer()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <header className="relative z-40 flex items-center gap-2 border-b border-line bg-white px-3 py-2 sm:gap-4 sm:px-4">
      <BrandTitle className="hidden sm:flex" />
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:ml-auto sm:flex-initial sm:gap-3">
        <div className="min-w-0 flex-1 sm:flex-initial">
        <SearchBox search={search} onPick={onPick} />
        </div>
        <ActivityInbox />
        <div ref={menuRef} className="relative">
          {/* The email truncates, not the button: `truncate` hides overflow, which
              would clip the pending badge sitting outside the button's corner.
              The control keeps a 40px touch target until `sm`, where it relaxes
              to the standard small-button height. */}
          <button ref={buttonRef} onClick={() => setOpen(o => !o)} aria-label="Account menu" aria-expanded={open} className="btn-sm relative h-10 min-w-10 max-w-[200px] sm:h-8">
            <span className="sm:hidden">{v.email?.[0]?.toUpperCase() ?? '…'}</span><span className="hidden truncate sm:inline">{v.email ?? '…'}</span>
            {v.pendingCount > 0 && (
              <span aria-label={`${v.pendingCount} pending requests`} className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white tabular-nums">{v.pendingCount}</span>
            )}
          </button>
          {open && (
            <div className="card pop absolute right-0 z-20 mt-1 flex w-56 flex-col p-1 shadow-elevated">
              {v.personId
                ? <button className="menu-item" onClick={() => { setOpen(false); onOpenSelf() }}>My profile</button>
                : <p className="px-3 py-2 text-sm text-ink-muted">You&#39;re not on a lin yet. Ask a CSA board member to add you.</p>}
              {v.isAdmin && <Link href="/admin" className="menu-item">Admin</Link>}
              <button className="menu-item" onClick={() => { v.signOut().catch(() => { window.location.href = '/login' }) }}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
