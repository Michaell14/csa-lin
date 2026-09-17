'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchLinGraph } from '@/lib/api/graph'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { LinGraph } from '@/lib/types'

const EMPTY: LinGraph = { people: [], links: [] }
const EMPTY_PHOTOS = new Map<string, string>()
const FRESH_MS = 30_000
const MAX_STALE_MS = 5 * 60_000
const MAX_CACHE_ENTRIES = 20
type CachedGraph = { graph: LinGraph; photoUrls: Map<string, string>; fetchedAt: number }

export function useLinGraph(linId: string | null, viewerKey: string | null = null) {
  const sb = useMemo(() => createClient(), [])
  const [graph, setGraph] = useState<LinGraph>(EMPTY)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  // The lin the graph above belongs to. The previous lin's people stay on screen
  // while a new one loads, so callers need to know when it is not this lin's.
  const [loadedLin, setLoadedLin] = useState<string | null>(null)
  const [loadedForViewer, setLoadedForViewer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  // This lives only as long as the page does. It is keyed by the signed-in
  // account, never persisted, and cannot serve another account's graph.
  const cache = useRef(new Map<string, CachedGraph>())

  useEffect(() => { cache.current.clear() }, [viewerKey])

  const load = useCallback(async (force: boolean) => {
    const mine = ++seq.current
    if (!linId) { setGraph(EMPTY); setPhotoUrls(new Map()); setLoadedLin(null); setLoadedForViewer(viewerKey); setLoading(false); setError(null); return }
    const key = viewerKey ? `${viewerKey}:${linId}` : null
    const cached = key ? cache.current.get(key) : undefined
    const age = cached ? Date.now() - cached.fetchedAt : Infinity
    const reusable = !force && cached && age < MAX_STALE_MS ? cached : null
    setError(null)
    if (reusable) {
      // Show a recent graph immediately; revalidate it in the background once
      // it is older than the fresh window.
      setGraph(reusable.graph)
      setPhotoUrls(reusable.photoUrls)
      setLoadedLin(linId)
      setLoadedForViewer(viewerKey)
      setLoading(false)
      if (age < FRESH_MS) return
    } else {
      // A mutation forces a network read, even if the previous graph is cached.
      if (force && key) cache.current.delete(key)
      setLoading(true)
      setLoadedLin(null)
    }
    try {
      const g = await fetchLinGraph(sb, linId)
      if (mine !== seq.current) return
      const paths = g.people.map(p => p.photo_path).filter((p): p is string => !!p)
      const previousUrls = reusable?.photoUrls ?? new Map<string, string>()
      const urls = new Map(paths.flatMap(path => previousUrls.has(path) ? [[path, previousUrls.get(path)!] as const] : []))
      setGraph(g)
      setPhotoUrls(urls)
      setLoadedLin(linId)
      setLoadedForViewer(viewerKey)
      setLoading(false)
      if (key) {
        cache.current.delete(key)
        cache.current.set(key, { graph: g, photoUrls: urls, fetchedAt: Date.now() })
        if (cache.current.size > MAX_CACHE_ENTRIES) cache.current.delete(cache.current.keys().next().value!)
      }
      // Signing avatars is another round trip, but it must not hold up the
      // family tree. The graph remains usable if storage is unavailable.
      // Re-sign on a background refresh too: an avatar can be overwritten at
      // the same storage path, and a new URL lets the browser show new bytes.
      const pathsToSign = reusable ? paths : paths.filter(path => !urls.has(path))
      if (pathsToSign.length > 0) void signedPhotoUrls(sb, pathsToSign).then(signed => {
        const allUrls = new Map(urls)
        for (const [path, url] of signed) allUrls.set(path, url)
        if (key) {
          const entry = cache.current.get(key)
          if (entry?.graph === g) cache.current.set(key, { ...entry, photoUrls: allUrls })
        }
        if (mine === seq.current) setPhotoUrls(allUrls)
      }).catch(e => { console.warn('Could not load graph photos', e) })
    } catch (e) {
      if (mine !== seq.current) return
      setError(errorMessage(e))
      setLoading(false)
    }
  }, [sb, linId, viewerKey])

  const reload = useCallback(() => load(true), [load])
  useEffect(() => { void load(false) }, [load])
  const sameViewer = loadedForViewer === viewerKey
  return {
    graph: sameViewer ? graph : EMPTY,
    photoUrls: sameViewer ? photoUrls : EMPTY_PHOTOS,
    loading,
    error: sameViewer ? error : null,
    reload,
    loadedLin: sameViewer ? loadedLin : null,
  }
}
