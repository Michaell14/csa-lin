'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listNotifications, markRead, unreadNotificationCount, type Notification } from '@/lib/api/notifications'
import { errorMessage } from '@/lib/errors'

function BellIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

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
        setItems(xs => xs.map(x => ids.includes(x.id) ? { ...x, read_at: readAt } : x))
        // The list is capped, so only the loaded notifications were marked; ask
        // the server how many remain rather than assuming none do.
        setUnread(await unreadNotificationCount(sb))
      }
      setError(null)
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }
  return <div className="relative">
    <button onClick={() => { void toggle() }} aria-expanded={open} aria-label={`Activity${unread ? `, ${unread} unread` : ''}`} className="icon-btn relative h-10 w-10 sm:h-8 sm:w-8"><BellIcon /><span className="sr-only">Activity</span>{unread > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white">{unread}</span>}</button>
    {open && <div className="card fixed inset-x-3 top-14 z-30 max-h-[70vh] overflow-y-auto p-3 shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80">
      <p className="heading text-sm">Activity</p>{error && <p role="alert" className="error mt-1">{error}</p>}{loading && <p role="status" className="mt-2 text-sm text-ink-muted">Loading activity…</p>}{!loading && !error && items.length === 0 && <p className="mt-2 text-sm text-ink-muted">You’re all caught up.</p>}
      <ul className="mt-2 divide-y divide-line">{items.map(item => <li key={item.id} className="py-2"><p className="text-sm text-ink">{item.message}</p><p className="text-xs text-ink-muted">{new Date(item.created_at).toLocaleDateString()}</p></li>)}</ul>
    </div>}
  </div>
}
