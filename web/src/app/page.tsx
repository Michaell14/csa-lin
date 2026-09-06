'use client'
import { useViewer } from '@/lib/viewer'

export default function Home() {
  const v = useViewer()
  if (v.loading) return <p className="p-6">Loading…</p>
  return (
    <main className="p-6">
      <p>Signed in as {v.email ?? 'unknown'}. Profile: {v.personId ?? 'none'}. Admin: {String(v.isAdmin)}. Pending: {v.pendingCount}</p>
      <button className="mt-4 rounded border px-3 py-1" onClick={v.signOut}>Sign out</button>
    </main>
  )
}
