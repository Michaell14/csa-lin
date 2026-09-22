'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listNotifications, markRead, unreadNotificationCount, type Notification } from '@/lib/api/notifications'
import { errorMessage } from '@/lib/errors'
import { BellIcon } from '@/components/icons'

export function ActivityInbox() {
  const sb = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Notification[]>([]), [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState(0), [loading, setLoading] = useState(false)
  const trayRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const countRequest = useRef(0)
  const loadCount = useCallback(async () => {
    const request = ++countRequest.current
    try {
      const count = await unreadNotificationCount(sb)
      if (request !== countRequest.current) return
      setUnread(count)
      setError(null)
    } catch (e) {
      if (request === countRequest.current) setError(errorMessage(e))
    }
  }, [sb])
  useEffect(() => {
    void loadCount()
    // A hidden tab keeps its interval but skips the request; focus catches up.
    const refresh = () => { if (!document.hidden) void loadCount() }
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 30_000)
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(interval) }
  }, [loadCount])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!trayRef.current?.contains(event.target as Node)) setOpen(false)
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
  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return
    try {
      setLoading(true)
      const visible = await listNotifications(sb)
      setItems(visible)
      const ids = visible.filter(item => !item.read_at).map(item => item.id)
      if (ids.length) {
        await markRead(sb, ids)
        const readAt = new Date().toISOString()
        setItems(xs => xs.map(x => ids.includes(x.id) ? { ...x, read_at: readAt } : x))
      }
      // The list is capped, so only the loaded notifications were marked; ask
      // the server how many remain rather than assuming none do.
      await loadCount()
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }
  return <div ref={trayRef} className="relative">
    <button ref={buttonRef} onClick={() => { void toggle() }} aria-expanded={open} aria-label={`Activity${unread ? `, ${unread} unread` : ''}`} className="icon-btn relative h-10 w-10 sm:h-8 sm:w-8"><BellIcon /><span className="sr-only">Activity</span>{unread > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white tabular-nums">{unread}</span>}</button>
    {open && <div className="card pop fixed inset-x-3 top-14 z-30 max-h-[70dvh] overflow-y-auto p-3 shadow-elevated sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80">
      <p className="heading text-sm">Activity</p>{error && <p role="alert" className="error mt-1">{error}</p>}{loading && <p role="status" className="mt-2 text-sm text-ink-muted">Loading activity…</p>}{!loading && !error && items.length === 0 && <p className="mt-2 text-sm text-ink-muted">You’re all caught up.</p>}
      <ul className="mt-2 divide-y divide-line">{items.map(item => <li key={item.id} className="py-2"><p className="text-sm text-ink">{item.message}</p><p className="text-xs text-ink-muted">{new Date(item.created_at).toLocaleDateString()}</p></li>)}</ul>
    </div>}
  </div>
}
