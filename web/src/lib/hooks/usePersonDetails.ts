'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPerson, fetchPeopleByIds } from '@/lib/api/people'
import { fetchLinksFor, splitLinks } from '@/lib/api/links'
import { fetchLinsOf } from '@/lib/api/lins'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { Link, Person } from '@/lib/types'
import type { Related } from '@/components/panel/ProfileView'

const NO_RELATED: Related[] = []
const NO_IDS: string[] = []

// `enabled` lets a caller hold an inert instance when the details are supplied
// from above, so the viewer's own profile is fetched once rather than by every
// view that reads it.
export function usePersonDetails(personId: string, includeContact = false, enabled = true) {
  const sb = useMemo(() => createClient(), [])
  const [person, setPerson] = useState<Person | null>(null)
  const [bigs, setBigs] = useState<Related[]>([])
  const [littles, setLittles] = useState<Related[]>([])
  const [incoming, setIncoming] = useState<Related[]>([])
  const [outgoing, setOutgoing] = useState<Related[]>([])
  const [linIds, setLinIds] = useState<string[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const seq = useRef(0)
  const shownId = useRef<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    const mine = ++seq.current
    if (shownId.current !== personId) {
      // A different person: drop the old content so the panel shows "Loading…" instead of stale data.
      shownId.current = personId
      setPerson(null); setBigs([]); setLittles([]); setIncoming([]); setOutgoing([]); setLinIds([]); setPhotoUrl(null)
    }
    setLoading(true); setError(null)
    try {
      const [p, links, lins] = await Promise.all([fetchPerson(sb, personId, { includeContact }), fetchLinksFor(sb, personId), fetchLinsOf(sb, personId)])
      const other = (l: Link) => (l.big_id === personId ? l.little_id : l.big_id)
      const people = await fetchPeopleByIds(sb, [...new Set(links.map(other))])
      const url = p?.photo_path ? (await signedPhotoUrls(sb, [p.photo_path])).get(p.photo_path) ?? null : null
      if (mine !== seq.current) return  // a newer request superseded this one
      const byId = new Map(people.map(x => [x.id, x]))
      const join = (ls: Link[]): Related[] => ls.flatMap(l => { const q = byId.get(other(l)); return q ? [{ link: l, person: q }] : [] })
      const s = splitLinks(links, personId)
      setPerson(p)
      setLinIds(lins)
      setBigs(join(s.confirmedBigs)); setLittles(join(s.confirmedLittles))
      setIncoming(join(s.incoming)); setOutgoing(join(s.outgoing))
      setPhotoUrl(url)
    } catch (e) {
      if (mine !== seq.current) return
      setError(errorMessage(e))
    } finally {
      if (mine === seq.current) { setLoadedFor(personId); setLoading(false) }
    }
  }, [sb, personId, includeContact, enabled])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    void reload()
  }, [reload, enabled])

  // The state above is cleared by `reload`, which only runs after the render
  // that changed `personId`. Gate on the person the state actually belongs to so
  // a signed-in account is never shown the previous account's details, contact
  // fields included, for that one render.
  const current = loadedFor === personId
  return {
    person: current ? person : null,
    bigs: current ? bigs : NO_RELATED,
    littles: current ? littles : NO_RELATED,
    incoming: current ? incoming : NO_RELATED,
    outgoing: current ? outgoing : NO_RELATED,
    linIds: current ? linIds : NO_IDS,
    photoUrl: current ? photoUrl : null,
    loading: enabled && (loading || !current),
    error: current ? error : null,
    reload,
  }
}

export type PersonDetails = ReturnType<typeof usePersonDetails>
