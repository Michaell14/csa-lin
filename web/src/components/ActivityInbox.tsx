'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listNotifications, markRead, type Notification } from '@/lib/api/notifications'
import { errorMessage } from '@/lib/errors'

export function ActivityInbox() {
  const sb = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Notification[]>([]), [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setItems(await listNotifications(sb)); setError(null) } catch (e) { setError(errorMessage(e)) } }, [sb])
  useEffect(() => { void load() }, [load])
  const unread = items.filter(item => !item.read_at).length
  async function toggle() {
    const next = !open; setOpen(next)
    if (!next) return
    try {
      const visible = await listNotifications(sb)
      setItems(visible); setError(null)
      const ids = visible.filter(item => !item.read_at).map(item => item.id)
      await markRead(sb, ids)
      const readAt = new Date().toISOString()
      setItems(xs => xs.map(x => ids.includes(x.id) ? { ...x, read_at: readAt } : x))
    } catch (e) { setError(errorMessage(e)) }
  }
  return <div className="relative">
    <button onClick={() => { void toggle() }} aria-expanded={open} aria-label={`Activity${unread ? `, ${unread} unread` : ''}`} className="btn-sm relative h-10 min-w-10 text-lg sm:h-9">♟<span className="sr-only">Activity</span>{unread > 0 && <span className="absolute -top-2.5 -right-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-accent px-1.5 text-xs font-bold text-cream">{unread}</span>}</button>
    {open && <div className="card fixed inset-x-3 top-14 z-30 max-h-[70vh] overflow-y-auto p-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
      <p className="display text-base">Activity</p>{error && <p role="alert" className="error mt-2">{error}</p>}{!error && items.length === 0 && <p className="mt-2 text-sm text-ink-muted">You’re all caught up.</p>}
      <ul className="mt-2 divide-y-2 divide-ink">{items.map(item => <li key={item.id} className="py-2"><p className="text-sm">{item.message}</p><p className="text-xs text-ink-muted">{new Date(item.created_at).toLocaleDateString()}</p></li>)}</ul>
    </div>}
  </div>
}
