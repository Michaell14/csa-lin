'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readViewerClaims } from '@/lib/jwt'

export type Viewer = {
  loading: boolean
  authUserId: string | null
  email: string | null
  personId: string | null
  // A shared read-only account: no profile, and none to set up.
  isGuest: boolean
  isAdmin: boolean
  pendingCount: number
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const ViewerContext = createContext<Viewer | null>(null)
const MAX_RETRIES = 3
const RETRY_MS = 500

export function ViewerProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<Omit<Viewer, 'refresh' | 'signOut'>>({
    loading: true, authUserId: null, email: null, personId: null, isGuest: false, isAdmin: false, pendingCount: 0,
  })
  const seq = useRef(0)
  const retries = useRef(0)
  const lastToken = useRef<string | null | undefined>(undefined)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    const { data: { session } } = await supabase.auth.getSession()
    lastToken.current = session?.access_token ?? null
    const claims = readViewerClaims(session?.access_token)
    let isAdmin = false
    let pendingCount = 0
    if (claims.personId) {
      const [adminRes, countRes] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.from('links').select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .or(`big_id.eq.${claims.personId},little_id.eq.${claims.personId}`)
          .neq('proposed_by', claims.personId),
      ])
      if (mine !== seq.current) return
      if (adminRes.error || countRes.error) {
        // A transient failure must not demote an admin. Retry a few times before giving up.
        if (retries.current < MAX_RETRIES) {
          retries.current += 1
          setTimeout(() => { void refreshRef.current() }, RETRY_MS)
          return
        }
        console.warn('viewer: could not load admin status', adminRes.error ?? countRes.error)
      } else {
        isAdmin = adminRes.data === true
        pendingCount = countRes.count ?? 0
      }
    }
    if (mine !== seq.current) return
    retries.current = 0
    setState({ loading: false, authUserId: claims.sub, email: claims.email, personId: claims.personId, isGuest: claims.guest, isAdmin, pendingCount })
  }, [supabase])
  refreshRef.current = refresh

  useEffect(() => {
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Never call client methods synchronously inside this callback (auth lock contention).
      if (event === 'INITIAL_SESSION') return
      const token = session?.access_token ?? null
      if (event !== 'SIGNED_OUT' && token === lastToken.current) return
      setTimeout(() => { void refreshRef.current() }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase, refresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const value = useMemo<Viewer>(() => ({ ...state, refresh, signOut }), [state, refresh, signOut])
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export function useViewer(): Viewer {
  const v = useContext(ViewerContext)
  if (!v) throw new Error('useViewer must be used inside ViewerProvider')
  return v
}
