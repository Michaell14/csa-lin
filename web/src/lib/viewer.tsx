'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readViewerClaims } from '@/lib/jwt'

export type Viewer = {
  loading: boolean
  authUserId: string | null
  email: string | null
  personId: string | null
  isAdmin: boolean
  pendingCount: number
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const ViewerContext = createContext<Viewer | null>(null)

export function ViewerProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<Omit<Viewer, 'refresh' | 'signOut'>>({
    loading: true, authUserId: null, email: null, personId: null, isAdmin: false, pendingCount: 0,
  })

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const claims = readViewerClaims(session?.access_token)
    let isAdmin = false
    let pendingCount = 0
    if (claims.personId) {
      const [{ data: admin }, { count }] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.from('links').select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .or(`big_id.eq.${claims.personId},little_id.eq.${claims.personId}`)
          .neq('proposed_by', claims.personId),
      ])
      isAdmin = admin === true
      pendingCount = count ?? 0
    }
    setState({ loading: false, authUserId: claims.sub, email: claims.email, personId: claims.personId, isAdmin, pendingCount })
  }, [supabase])

  useEffect(() => {
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void refresh() })
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
