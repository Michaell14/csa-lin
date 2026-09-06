'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Lin } from '@/lib/types'
import type { PersonHit } from '@/lib/api/people'
import { LinTabs } from '@/components/LinTabs'
import { SearchBox } from '@/components/SearchBox'
import { useViewer } from '@/lib/viewer'

export function TopBar({ lins, selectedLinId, onSelectLin, search, onPick, onOpenSelf }: {
  lins: Lin[]
  selectedLinId: string | null
  onSelectLin: (id: string) => void
  search: (q: string) => Promise<PersonHit[]>
  onPick: (hit: PersonHit) => void
  onOpenSelf: () => void
}) {
  const v = useViewer()
  const [open, setOpen] = useState(false)
  return (
    <header className="flex items-center gap-4 border-b px-4 py-2">
      <span className="font-semibold">CSA Lins</span>
      <LinTabs lins={lins} selectedId={selectedLinId} onSelect={onSelectLin} />
      <div className="ml-auto flex items-center gap-3">
        <SearchBox search={search} onPick={onPick} />
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} aria-label="Account menu" className="relative rounded-full border px-2 py-1 text-sm">
            {v.email ?? '…'}
            {v.pendingCount > 0 && (
              <span aria-label={`${v.pendingCount} pending requests`} className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{v.pendingCount}</span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-white text-sm shadow">
              {v.personId
                ? <button className="block w-full px-3 py-2 text-left hover:bg-neutral-100" onClick={() => { setOpen(false); onOpenSelf() }}>My profile</button>
                : <p className="px-3 py-2 text-neutral-500">You&#39;re not on a lin yet. Ask a CSA board member to add you.</p>}
              {v.isAdmin && <Link href="/admin" className="block px-3 py-2 hover:bg-neutral-100">Admin</Link>}
              <button className="block w-full px-3 py-2 text-left hover:bg-neutral-100" onClick={v.signOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
