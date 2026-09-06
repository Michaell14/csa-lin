'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPerson, fetchPeopleByIds } from '@/lib/api/people'
import { fetchLinksFor, splitLinks } from '@/lib/api/links'
import { fetchLinsOf } from '@/lib/api/lins'
import { signedPhotoUrls } from '@/lib/api/photos'
import { errorMessage } from '@/lib/errors'
import type { Link, Person } from '@/lib/types'
import type { Related } from '@/components/panel/ProfileView'

export function usePersonDetails(personId: string) {
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

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, links, lins] = await Promise.all([fetchPerson(sb, personId), fetchLinksFor(sb, personId), fetchLinsOf(sb, personId)])
      setPerson(p)
      setLinIds(lins)
      const other = (l: Link) => (l.big_id === personId ? l.little_id : l.big_id)
      const people = await fetchPeopleByIds(sb, [...new Set(links.map(other))])
      const byId = new Map(people.map(x => [x.id, x]))
      const join = (ls: Link[]): Related[] => ls.flatMap(l => { const q = byId.get(other(l)); return q ? [{ link: l, person: q }] : [] })
      const s = splitLinks(links, personId)
      setBigs(join(s.confirmedBigs)); setLittles(join(s.confirmedLittles))
      setIncoming(join(s.incoming)); setOutgoing(join(s.outgoing))
      setPhotoUrl(p?.photo_path ? (await signedPhotoUrls(sb, [p.photo_path])).get(p.photo_path) ?? null : null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sb, personId])

  useEffect(() => { void reload() }, [reload])
  return { person, bigs, littles, incoming, outgoing, linIds, photoUrl, loading, error, reload }
}
