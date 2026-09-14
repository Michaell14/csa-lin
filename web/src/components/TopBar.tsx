'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'
import { useViewer } from '@/lib/viewer'
import { ReportIssue } from '@/components/panel/ReportIssue'

export function TopBar({ search, onPick, onOpenSelf }: {
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  onOpenSelf: () => void
}) {
  const v = useViewer()
  const [open, setOpen] = useState(false)
  return (
    <header className="relative z-40 flex items-center gap-2 border-b-[3px] border-ink bg-cream px-3 py-3 sm:gap-4 sm:px-4">
      <span className="display hidden shrink-0 -rotate-2 rounded-tag border-[3px] border-ink bg-white px-2.5 py-0.5 text-lg shadow-sticker-xs sm:block">CSA Lins</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:ml-auto sm:flex-initial sm:gap-3">
        <div className="min-w-0 flex-1 sm:flex-initial">
        <SearchBox search={search} onPick={onPick} />
        </div>
        <div className="relative">
          {/* The email truncates, not the button: `truncate` hides overflow, which
              would clip the pending badge sitting outside the button's corner.
              The control keeps a 40px touch target until `sm`, where it relaxes
              to the standard small-button height. */}
          <button onClick={() => setOpen(o => !o)} aria-label="Account menu" aria-expanded={open} className="btn-sm relative h-10 min-w-10 max-w-[200px] sm:h-9">
            <span className="sm:hidden">{v.email?.[0]?.toUpperCase() ?? '…'}</span><span className="hidden truncate sm:inline">{v.email ?? '…'}</span>
            {v.pendingCount > 0 && (
              <span aria-label={`${v.pendingCount} pending requests`} className="absolute -top-2.5 -right-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-accent px-1.5 text-xs font-bold text-cream">{v.pendingCount}</span>
            )}
          </button>
          {open && (
            <div className="card absolute right-0 z-20 mt-2 flex w-56 flex-col overflow-hidden py-1 text-sm font-bold">
              {v.personId
                ? <button className="px-3 py-2 text-left hover:bg-gold-tint" onClick={() => { setOpen(false); onOpenSelf() }}>My profile</button>
                : <p className="px-3 py-2 font-medium text-ink-muted">You&#39;re not on a lin yet. Ask a CSA board member to add you.</p>}
              {v.isAdmin && <Link href="/admin" className="px-3 py-2 hover:bg-gold-tint">Admin</Link>}
              <div className="border-t-2 border-ink px-3 py-2"><ReportIssue /></div>
              <button className="px-3 py-2 text-left hover:bg-gold-tint" onClick={() => { v.signOut().catch(() => { window.location.href = '/login' }) }}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
