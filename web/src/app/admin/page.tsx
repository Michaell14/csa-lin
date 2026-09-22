'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useViewer } from '@/lib/viewer'
import { AdminTabs, type AdminTab } from '@/components/admin/AdminTabs'
import { PeopleTable } from '@/components/admin/PeopleTable'
import { LinksAdmin } from '@/components/admin/LinksAdmin'
import { LinsAdmin } from '@/components/admin/LinsAdmin'
import { PendingAdmin } from '@/components/admin/PendingAdmin'
import { AdminsAdmin } from '@/components/admin/AdminsAdmin'
import { ChangelogList } from '@/components/admin/ChangelogList'
import { CorrectionsAdmin } from '@/components/admin/CorrectionsAdmin'
import { createClient } from '@/lib/supabase/client'
import { fetchAdminQueueCounts } from '@/lib/api/admin'
import { errorMessage } from '@/lib/errors'

export default function AdminPage() {
  const v = useViewer()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('People')
  const sb = useMemo(() => createClient(), [])
  const [counts, setCounts] = useState<{ requests: number; corrections: number } | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const countSeq = useRef(0)

  const reloadCounts = useCallback(async () => {
    const mine = ++countSeq.current
    try {
      const next = await fetchAdminQueueCounts(sb)
      if (mine !== countSeq.current) return
      setCounts(next); setCountsError(null)
    } catch (error) {
      if (mine !== countSeq.current) return
      setCounts(null); setCountsError(errorMessage(error))
    }
  }, [sb])

  useEffect(() => { if (!v.loading && !v.isAdmin) router.replace('/') }, [v.loading, v.isAdmin, router])
  useEffect(() => {
    if (v.loading || !v.isAdmin) return
    void reloadCounts()
    const onFocus = () => { void reloadCounts() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => { if (!document.hidden) void reloadCounts() }, 60_000)
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); countSeq.current += 1 }
  }, [v.loading, v.isAdmin, reloadCounts])
  if (v.loading || !v.isAdmin) return <p className="p-6 text-sm text-ink-muted">Loading…</p>

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="heading text-xl">Admin</h1>
        <Link href="/" className="btn-sm">Back to lins</Link>
      </div>
      <AdminTabs tab={tab} counts={counts} onChange={next => { setTab(next); void reloadCounts() }} />
      {countsError && <p role="alert" className="alert">Could not load admin counts: {countsError}</p>}
      {tab === 'People' && <PeopleTable />}
      {tab === 'Links' && <LinksAdmin onQueueChanged={() => { void reloadCounts() }} />}
      {tab === 'Lins' && <LinsAdmin />}
      {tab === 'Requests' && <PendingAdmin onQueueChanged={() => { void reloadCounts() }} />}
      {tab === 'Corrections' && <CorrectionsAdmin onQueueChanged={() => { void reloadCounts() }} />}
      {tab === 'Admins' && <AdminsAdmin />}
      {tab === 'Changelog' && <ChangelogList />}
    </main>
  )
}
