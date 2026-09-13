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
  const { graph, photoUrls, loading, error: graphError, reload, loadedLin } = useLinGraph(linId)
  // While a new lin loads, `graph` still holds the previous lin's people, so it
  // cannot answer "is this person in the lin on screen?" until it catches up.
  const graphIsCurrent = loadedLin === linId

  // One copy of the viewer's own profile, handed to both the checklist and the
  // panel: a single fetch, and an edit in the panel updates the checklist.
  const viewerId = viewer.personId
  const selfDetails = usePersonDetails(viewerId ?? '', true, Boolean(viewerId))

  // What the component last rendered with, mirrored during render so it is never
  // a beat behind. Navigation that waits on a request compares against it before
  // applying, and stands down if the account or the selection has moved on since
  // — including a move the app did not make itself, such as browser history.
  const latest = useRef({ viewerId, linId, personId })
  latest.current = { viewerId, linId, personId }
  // Two navigations can also be in flight at once, having seen the same render.
  // The newer one wins, so each takes a ticket before it waits.
  const navSeq = useRef(0)
  const supersedes = useCallback((at: typeof latest.current, ticket: number) =>
    ticket !== navSeq.current || latest.current.viewerId !== at.viewerId
    || latest.current.linId !== at.linId || latest.current.personId !== at.personId, [])

  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }) => {
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    router.replace(`/?${q.toString()}`)
  }, [params, router])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    let cancelled = false
    const at = latest.current
    const ticket = ++navSeq.current
    ;(async () => {
      try {
        const all = await fetchLins(sb)
        if (cancelled) return
        setLins(all)
        if (!linId && all.length > 0) {
          const mine = viewer.personId ? await fetchLinsOf(sb, viewer.personId) : []
          if (cancelled || supersedes(at, ticket)) return
          // Someone with no lin of their own falls back to the first lin, which
          // will not contain them: open it without a selection rather than on a
          // profile the graph cannot show.
          setQuery({ lin: mine[0] ?? all[0].id, person: mine.length > 0 ? viewer.personId : null })
        }
      } catch (e) { if (!cancelled) setError(errorMessage(e)) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    try {
      if (graphIsCurrent && graph.people.some(p => p.id === id)) { setQuery({ person: id }); return }
      const at = latest.current
      const ticket = ++navSeq.current
      const theirs = await fetchLinsOf(sb, id)
      if (supersedes(at, ticket)) return
      // Prefer the lin already on screen when they are in it: `lins_of` has no
      // defined order, so its first entry is an arbitrary choice.
      setQuery({ lin: (linId && theirs.includes(linId) ? linId : theirs[0]) ?? linId, person: id })
    } catch (e) { setError(errorMessage(e)) }
  }, [graphIsCurrent, graph.people, linId, sb, setQuery, supersedes])

  const openSelf = useCallback(async () => {
    if (!viewerId) return
    // `lins_of` has no defined order, so only reach for it when the lin on
    // screen doesn't already hold the viewer; otherwise recentre in place.
    if (graphIsCurrent && graph.people.some(p => p.id === viewerId)) {
      setFocusToken(token => token + 1)
      setQuery({ person: viewerId })
      return
    }
    try {
      const at = latest.current
      const ticket = ++navSeq.current
      const mine = await fetchLinsOf(sb, viewerId)
      if (supersedes(at, ticket)) return
      // Selecting themselves in a lin they are not part of would open the panel
      // on "This person is not visible", so say why instead of going nowhere.
      if (mine.length === 0) { setError('Your profile is not part of a lin yet.'); return }
      setError(null)
      setFocusToken(token => token + 1)
      setQuery({ lin: linId && mine.includes(linId) ? linId : mine[0], person: viewerId })
    } catch (e) { setError(errorMessage(e)) }
  }, [viewerId, graphIsCurrent, graph.people, linId, sb, setQuery, supersedes])

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
          {linId && isUuid(linId) && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={loadedLin} focusToken={focusToken} />}
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
