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
  // Which lin the graph in state actually describes. A caller cannot tell that
  // from linId alone, which names the lin that is selected rather than the one
  // on screen, and those differ for as long as a switch is in the air.
  const [loadedLinId, setLoadedLinId] = useState<string | null>(null)
  // Mirrored in a ref so reload can read it without taking it as a dependency,
  // which would rebuild reload on every load and fetch the lin a second time.
  const loaded = useRef<string | null>(null)
  const remember = useCallback((id: string | null) => { loaded.current = id; setLoadedLinId(id) }, [])

  const clear = useCallback(() => { remember(null); setGraph(EMPTY); setPhotoUrls(new Map()) }, [remember])

  const reload = useCallback(async () => {
    const mine = ++seq.current
    // Clearing loading here rather than leaving it to the request already in
    // flight: that one's sequence no longer matches, so its finally block will
    // not touch it, and the page would stay busy for good.
    if (!linId) { clear(); setError(null); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const g = await fetchLinGraph(sb, linId)
      const urls = await signedPhotoUrls(sb, g.people.map(p => p.photo_path).filter((p): p is string => !!p))
      if (mine !== seq.current) return
      remember(linId)
      setGraph(g)
      setPhotoUrls(urls)
    } catch (e) {
      if (mine !== seq.current) return
      // A failed refresh of the lin already on screen leaves it alone. A failed
      // switch must not: holding the old lin's members under the newly selected
      // lin presents them as that lin's lineage.
      if (loaded.current !== linId) clear()
      setError(errorMessage(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [sb, linId, clear, remember])

  useEffect(() => { void reload() }, [reload])
  return { graph, photoUrls, loadedLinId, loading, error, reload }
}
