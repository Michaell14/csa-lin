'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listNotifications, markRead, unreadNotificationCount, type Notification } from '@/lib/api/notifications'
import { errorMessage } from '@/lib/errors'

export function ActivityInbox() {
  const sb = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Notification[]>([]), [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState(0), [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(false)
  const loadCount = useCallback(async () => { try { setUnread(await unreadNotificationCount(sb)); setError(null) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void loadCount() }, [loadCount])
  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return
    try {
      let visible = items
      if (!loaded) { setLoading(true); visible = await listNotifications(sb); setItems(visible); setLoaded(true) }
      const ids = visible.filter(item => !item.read_at).map(item => item.id)
      if (ids.length) {
        await markRead(sb, ids)
        const readAt = new Date().toISOString()
        setUnread(0); setItems(xs => xs.map(x => ids.includes(x.id) ? { ...x, read_at: readAt } : x))
      }
      setError(null)
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }
  return <div className="relative">
    <button onClick={() => { void toggle() }} aria-expanded={open} aria-label={`Activity${unread ? `, ${unread} unread` : ''}`} className="relative min-h-10 min-w-10 rounded-full border text-lg">♟<span className="sr-only">Activity</span>{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}</button>
    {open && <div className="fixed inset-x-3 top-14 z-30 max-h-[70vh] overflow-y-auto rounded-lg border bg-white p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80">
      <p className="font-semibold">Activity</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{loading && <p role="status" className="mt-2 text-sm text-neutral-500">Loading activity…</p>}{!loading && !error && items.length === 0 && <p className="mt-2 text-sm text-neutral-500">You’re all caught up.</p>}
      <ul className="mt-2 divide-y">{items.map(item => <li key={item.id} className="py-2"><p className="text-sm">{item.message}</p><p className="text-xs text-neutral-400">{new Date(item.created_at).toLocaleDateString()}</p></li>)}</ul>
    </div>}
  </div>
}
