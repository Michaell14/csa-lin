'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useViewer } from '@/lib/viewer'
import { AdminTabs, type AdminTab } from '@/components/admin/AdminTabs'
import { PeopleTable } from '@/components/admin/PeopleTable'

export default function AdminPage() {
  const v = useViewer()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('People')

  useEffect(() => { if (!v.loading && !v.isAdmin) router.replace('/') }, [v.loading, v.isAdmin, router])
  if (v.loading || !v.isAdmin) return <p className="p-6 text-sm text-neutral-500">Loading…</p>

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link href="/" className="text-sm underline">Back to lins</Link>
      </div>
      <AdminTabs tab={tab} onChange={setTab} />
      {tab === 'People' && <PeopleTable />}
      {tab !== 'People' && <p className="text-sm text-neutral-500">Coming in Task 11.</p>}
    </main>
  )
}
