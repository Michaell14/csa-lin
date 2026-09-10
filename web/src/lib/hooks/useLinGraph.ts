'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchLinGraph } from '@/lib/api/graph'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { LinGraph } from '@/lib/types'

const EMPTY: LinGraph = { people: [], links: [] }

export function useLinGraph(linId: string | null) {
  const sb = useMemo(() => createClient(), [])
  const [graph, setGraph] = useState<LinGraph>(EMPTY)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const mine = ++seq.current
    if (!linId) { setGraph(EMPTY); setPhotoUrls(new Map()); setError(null); return }
    setLoading(true); setError(null)
    try {
      const g = await fetchLinGraph(sb, linId)
      const urls = await signedPhotoUrls(sb, g.people.map(p => p.photo_path).filter((p): p is string => !!p))
      if (mine !== seq.current) return
      setGraph(g)
      setPhotoUrls(urls)
    } catch (e) {
      if (mine !== seq.current) return
      setError(errorMessage(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [sb, linId])

  useEffect(() => { void reload() }, [reload])
  return { graph, photoUrls, loading, error, reload }
}
