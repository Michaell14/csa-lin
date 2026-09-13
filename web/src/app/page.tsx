'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLins, fetchLinsOf } from '@/lib/api/lins'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { useLinGraph } from '@/lib/hooks/useLinGraph'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import { isUuid } from '@/lib/ids'
import type { Lin } from '@/lib/types'
import { TopBar } from '@/components/TopBar'
import { LinGraph } from '@/components/graph/LinGraph'
import { LinSidebar } from '@/components/LinSidebar'
import { SidePanel } from '@/components/panel/SidePanel'
import { OnboardingCard } from '@/components/OnboardingCard'

function Home() {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const router = useRouter()
  const params = useSearchParams()
  const linId = params.get('lin')
  const personId = params.get('person')

  const [lins, setLins] = useState<Lin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const { graph, photoUrls, loading, error: graphError, reload } = useLinGraph(linId)

  // One copy of the viewer's own profile, handed to both the checklist and the
  // panel: a single fetch, and an edit in the panel updates the checklist.
  const viewerId = viewer.personId
  const selfDetails = usePersonDetails(viewerId ?? '', true, Boolean(viewerId))

  // Navigation that waits on a request can land after the user has moved on, so
  // every navigation bumps this and a late reply checks it before applying.
  const navSeq = useRef(0)
  const viewerRef = useRef(viewerId)
  useEffect(() => { viewerRef.current = viewerId }, [viewerId])

  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }) => {
    navSeq.current += 1
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    router.replace(`/?${q.toString()}`)
  }, [params, router])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    ;(async () => {
      const request = navSeq.current
      try {
        const all = await fetchLins(sb)
        setLins(all)
        if (!linId && all.length > 0) {
          const mine = viewer.personId ? await fetchLinsOf(sb, viewer.personId) : []
          if (request !== navSeq.current || viewerRef.current !== viewer.personId) return
          // Someone with no lin of their own falls back to the first lin, which
          // will not contain them: open it without a selection rather than on a
          // profile the graph cannot show.
          setQuery({ lin: mine[0] ?? all[0].id, person: mine.length > 0 ? viewer.personId : null })
        }
      } catch (e) { setError(errorMessage(e)) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    try {
      const inCurrent = graph.people.some(p => p.id === id)
      if (inCurrent) { setQuery({ person: id }); return }
      const request = navSeq.current
      const theirs = await fetchLinsOf(sb, id)
      if (request !== navSeq.current) return
      setQuery({ lin: theirs[0] ?? linId, person: id })
    } catch (e) { setError(errorMessage(e)) }
  }, [graph.people, linId, sb, setQuery])

  const openSelf = useCallback(async () => {
    if (!viewerId) return
    // `lins_of` has no defined order, so only reach for it when the lin on
    // screen doesn't already hold the viewer; otherwise recentre in place.
    if (graph.people.some(p => p.id === viewerId)) {
      setFocusToken(token => token + 1)
      setQuery({ person: viewerId })
      return
    }
    try {
      const request = navSeq.current
      const mine = await fetchLinsOf(sb, viewerId)
      if (request !== navSeq.current || viewerRef.current !== viewerId) return
      // Selecting themselves in a lin they are not part of would open the panel
      // on "This person is not visible", so say why instead of going nowhere.
      if (mine.length === 0) { setError('Your profile is not part of a lin yet.'); return }
      setError(null)
      setFocusToken(token => token + 1)
      setQuery({ lin: mine[0], person: viewerId })
    } catch (e) { setError(errorMessage(e)) }
  }, [viewerId, graph.people, sb, setQuery])

  const search = useCallback((q: string) => searchPeople(sb, q), [sb])
  const onPick = useCallback((hit: PersonHit) => { void openPerson(hit.id) }, [openPerson])

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        search={search}
        onPick={onPick}
        onOpenSelf={() => { void openSelf() }}
      />
      {(error || graphError) && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error ?? graphError}</p>}
      <div className="relative flex min-h-0 flex-1">
        <LinSidebar lins={lins} selectedId={linId} onSelect={id => setQuery({ lin: id, person: null })} />
        <div className="relative min-w-0 flex-1">
          {viewerId && <OnboardingCard personId={viewerId} details={selfDetails} onOpenProfile={() => { void openSelf() }} />}
          {viewerId && (
            <button onClick={() => { void openSelf() }} className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-md hover:bg-neutral-50">
              Back to me
            </button>
          )}
          {!loading && lins.length === 0 && !error && (
            <p className="p-6 text-sm text-neutral-500">No lins yet. An admin can create the first one from the Admin page.</p>
          )}
          {loading && <p className="absolute left-4 top-2 z-10 text-sm text-neutral-500">Loading…</p>}
          {linId && isUuid(linId) && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={linId} focusToken={focusToken} />}
        </div>
        {personId && isUuid(personId) && (
          <SidePanel
            personId={personId}
            graph={graph}
            photoUrls={photoUrls}
            lins={lins}
            currentLinId={linId}
            onSelectPerson={id => { void openPerson(id) }}
            onSelectLin={id => setQuery({ lin: id })}
            onClose={() => setQuery({ person: null })}
            onGraphChanged={reload}
            details={personId === viewerId ? selfDetails : undefined}
          />
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
