'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLins, fetchLinMemberCounts, fetchLinsOf, updateLin, type LinPatch } from '@/lib/api/lins'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { useLinGraph } from '@/lib/hooks/useLinGraph'
import { usePersonDetails } from '@/lib/hooks/usePersonDetails'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import { isUuid } from '@/lib/ids'
import type { Lin, LinGraph as LinGraphData, MembersStatus } from '@/lib/types'
import { TopBar } from '@/components/TopBar'
import { LinGraph } from '@/components/graph/LinGraph'
import { LinSidebar } from '@/components/LinSidebar'
import { SidePanel } from '@/components/panel/SidePanel'
import { LinOverview, type LinView } from '@/components/LinOverview'
import { LinEditor } from '@/components/LinEditor'
import { LinMemberList } from '@/components/LinMemberList'
import { shortestRelationshipPath } from '@/lib/graph/relationship'
import { LinInsights } from '@/components/LinInsights'
import { downloadLinPng } from '@/lib/graph/exportPng'
import { ProfileSetup } from '@/components/ProfileSetup'

const EMPTY_GRAPH: LinGraphData = { people: [], links: [] }

function Home() {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const params = useSearchParams()
  const linId = params.get('lin')
  const personId = params.get('person')

  const [lins, setLins] = useState<Lin[]>([])
  const [linMemberCounts, setLinMemberCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const [view, setView] = useState<LinView>('graph')
  const [exporting, setExporting] = useState(false)
  const [editingLin, setEditingLin] = useState(false)
  const graphViewerKey = viewer.authUserId ? `${viewer.authUserId}:${viewer.personId ?? ''}:${viewer.isAdmin}` : null
  const { graph, photoUrls, loading, error: graphError, reload, prefetch, loadedLin } = useLinGraph(viewer.loading ? null : linId, graphViewerKey)
  // While a new lin loads, `graph` still holds the previous lin's people, so it
  // cannot answer "is this person in the lin on screen?" until it catches up.
  const graphIsCurrent = loadedLin === linId
  // A failed request also leaves `loadedLin` unset, so "not current" alone would
  // keep the overview and the list claiming to load forever behind the error.
  const membersStatus: MembersStatus = graphIsCurrent ? 'ready' : graphError ? 'unavailable' : 'loading'
  const currentGraph = graphIsCurrent ? graph : EMPTY_GRAPH

  // Keep the viewer's details available to the profile panel and lin actions.
  const viewerId = viewer.personId
  const selfDetails = usePersonDetails(viewerId ?? '', true, Boolean(viewerId))

  // Navigation freshness. Some navigation has to wait on `lins_of` first, and by
  // the time it answers the user may have asked for something else. Every
  // intention takes a ticket; a reply applies only while its ticket is the
  // newest one. Only an intention takes a ticket, never a re-render, so a reply
  // is never discarded merely because an earlier navigation has just painted.
  const navSeq = useRef(0)
  const supersedes = useCallback((ticket: number) => ticket !== navSeq.current, [])

  // Lin-list freshness, which is a separate order from navigation: the first
  // load and the refreshes that follow a graph change can overlap, and an
  // earlier request can answer last. Every read takes a number and only the
  // newest reply is applied, so the sidebar never falls back to a list that
  // predates what it is already showing.
  const linsSeq = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLinMemberCounts({})
    if (lins.length === 0) return
    void fetchLinMemberCounts(sb).then(counts => {
      if (!cancelled) setLinMemberCounts(counts)
    }).catch(() => { if (!cancelled) setLinMemberCounts({}) })
    return () => { cancelled = true }
  }, [sb, lins])

  // Back and forward are an intention this page never asked for, and popstate is
  // where they happen. Taking the ticket at the event keeps this off the render
  // path, where an abandoned render could spend one that was never committed.
  // An account change needs no equivalent: the lin-loading effect below runs on
  // every change of viewer and takes a ticket of its own.
  useEffect(() => {
    const onPopState = () => { navSeq.current += 1 }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }) => {
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    navSeq.current += 1
    // The page is drawn entirely on the client, so a query change has nothing
    // to ask the server for. router.replace would still fetch a fresh page
    // payload (and run the auth middleware) before the URL, and everything that
    // reads it, could change. The native call is picked up by useSearchParams
    // at once, so a lin switch starts loading on the click.
    window.history.replaceState(null, '', `/?${q.toString()}`)
  }, [params])

  // Which lin to open while none is: the one the URL's person names -- a link
  // like /?person=... names who to open, so find a lin for them rather than
  // replacing them with the viewer -- else one the viewer is in, else the first.
  // Someone with no lin of their own lands in a lin that will not contain them,
  // so it opens without a selection rather than on a profile the graph cannot
  // show. Below the side-by-side panel breakpoint, leave the profile unselected
  // so its sheet does not cover the graph; an explicit person link still opens it.
  const defaultLinQuery = useCallback(async (all: Lin[]) => {
    const requested = personId && isUuid(personId) ? personId : null
    const wanted = requested ?? viewer.personId
    const theirs = wanted ? await fetchLinsOf(sb, wanted) : []
    return {
      lin: theirs[0] ?? all[0].id,
      person: requested ?? (theirs.length > 0 && window.innerWidth >= 768 ? viewer.personId : null),
    }
  }, [sb, personId, viewer.personId])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    let cancelled = false
    const ticket = ++navSeq.current
    const seq = ++linsSeq.current
    ;(async () => {
      try {
        const all = await fetchLins(sb)
        if (cancelled || seq !== linsSeq.current) return
        setLins(all)
        if (!linId && all.length > 0) {
          const next = await defaultLinQuery(all)
          if (cancelled || supersedes(ticket)) return
          setQuery(next)
        }
      } catch (e) { if (!cancelled && !supersedes(ticket)) setError(errorMessage(e)) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    if (graphIsCurrent && graph.people.some(p => p.id === id)) { setQuery({ person: id }); return }
    const ticket = ++navSeq.current
    try {
      const theirs = await fetchLinsOf(sb, id)
      if (supersedes(ticket)) return
      // Prefer the lin already on screen when they are in it: `lins_of` has no
      // defined order, so its first entry is an arbitrary choice.
      setQuery({ lin: (linId && theirs.includes(linId) ? linId : theirs[0]) ?? linId, person: id })
      // A failure the user has already navigated away from is not their problem.
    } catch (e) { if (!supersedes(ticket)) setError(errorMessage(e)) }
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
    const ticket = ++navSeq.current
    try {
      const mine = await fetchLinsOf(sb, viewerId)
      if (supersedes(ticket)) return
      setFocusToken(token => token + 1)
      // A viewer who belongs to no lin still opens their own profile: the panel
      // loads the person, it does not read them out of the graph. Leave the lin
      // on screen alone in that case, and otherwise prefer a lin they are in.
      setQuery({ lin: (linId && mine.includes(linId) ? linId : mine[0]) ?? linId, person: viewerId })
    } catch (e) { if (!supersedes(ticket)) setError(errorMessage(e)) }
  }, [viewerId, graphIsCurrent, graph.people, linId, sb, setQuery, supersedes])

  const search = useCallback((q: string) => searchPeople(sb, q), [sb])
  const onPick = useCallback((hit: PersonHit) => { void openPerson(hit.id) }, [openPerson])
  const selectedLin = lins.find(lin => lin.id === linId) ?? null

  // Lins are founded by the database when a link is confirmed, so any change
  // to the graph may have added one (or moved a founder): re-read the list
  // whenever the graph is re-read, and after the founder edits it here.
  const reloadLins = useCallback(async () => {
    // Refreshing is not an intention to navigate, so this takes no navigation
    // ticket of its own -- spending one would discard a navigation already in
    // flight. It reads the newest ticket instead and stands down if anything
    // navigated while it waited, so a slow refresh cannot reopen a lin, or a
    // person, the user has since moved on from.
    const ticket = navSeq.current
    const seq = ++linsSeq.current
    const current = () => seq === linsSeq.current
    try {
      const all = await fetchLins(sb)
      if (!current()) return
      setLins(all)
      if (all.length === 0) {
        if (linId && !supersedes(ticket)) setQuery({ lin: null })
        return
      }
      // A confirmation can found a first lin or absorb the currently open lin
      // into an ancestor's. In either case, navigate to a lin the selected
      // person (or viewer) now belongs to instead of leaving an empty graph.
      if (supersedes(ticket) || (linId && all.some(l => l.id === linId))) return
      const next = await defaultLinQuery(all)
      if (!current() || supersedes(ticket)) return
      setQuery(next)
      // A failure that a newer refresh or a newer navigation has already left
      // behind is not the user's problem.
    } catch (e) { if (current() && !supersedes(ticket)) setError(errorMessage(e)) }
  }, [sb, linId, setQuery, defaultLinQuery, supersedes])
  const graphChanged = useCallback(async () => { await Promise.all([reload(), reloadLins()]) }, [reload, reloadLins])
  const canEditLin = Boolean(selectedLin && viewer.personId && (viewer.isAdmin || selectedLin.founder_id === viewer.personId))
  useEffect(() => { setEditingLin(false) }, [linId])
  const saveLin = useCallback(async (patch: Required<LinPatch>) => {
    if (!selectedLin) return
    await updateLin(sb, selectedLin.id, patch)
    await reloadLins()
    setEditingLin(false)
  }, [selectedLin, sb, reloadLins])
  // Computed from the lin actually on screen: while a new lin loads, `graph`
  // still holds the outgoing one, and a connection read out of it would claim a
  // family tie that does not exist in the lin the user is looking at.
  const relationshipPath = useMemo(() => shortestRelationshipPath(currentGraph, viewer.personId, personId), [currentGraph, viewer.personId, personId])
  const highlightedLinkIds = useMemo(() => new Set(relationshipPath?.linkIds ?? []), [relationshipPath])
  const exportPng = useCallback(async () => {
    if (!selectedLin) return
    setExporting(true); setError(null)
    try { await downloadLinPng(selectedLin, graph) } catch (e) { setError(errorMessage(e)) } finally { setExporting(false) }
  }, [selectedLin, graph])
  const chooseView = useCallback((next: LinView) => {
    setView(next)
    try { window.localStorage.setItem('lins.view', next) } catch { /* storage unavailable */ }
  }, [])

  useEffect(() => {
    try {
      // While the profile is a bottom sheet, open on the graph regardless of a
      // saved view choice. Other views remain available from the tabs.
      if (window.innerWidth < 768) return
      const saved = window.localStorage.getItem('lins.view')
      if (saved === 'graph' || saved === 'list' || saved === 'insights') setView(saved)
    } catch { /* storage unavailable */ }
  }, [])

  if (!viewer.loading && viewer.authUserId && !viewer.personId) {
    return <ProfileSetup email={viewer.email} onReady={viewer.refresh} onSignOut={viewer.signOut} />
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        search={search}
        onPick={onPick}
        onOpenSelf={() => { void openSelf() }}
      />
      {(error || graphError) && <p role="alert" className="border-b border-accent-line bg-accent-tint px-4 py-2 text-sm text-accent">{error ?? graphError}</p>}
      <div className="relative flex min-h-0 flex-1">
        <LinSidebar lins={lins} memberCounts={linMemberCounts} selectedId={linId} onSelect={id => setQuery({ lin: id, person: null })} onPrefetch={prefetch} />
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedLin && <LinOverview lin={selectedLin} graph={currentGraph} view={view} membersStatus={membersStatus}
            hasSelf={Boolean(viewer.personId && currentGraph.people.some(p => p.id === viewer.personId))}
            onView={chooseView} onFounder={() => { void openPerson(selectedLin.founder_id) }} onSelf={() => { void openSelf() }} onExport={graphIsCurrent ? () => { void exportPng() } : undefined} exporting={exporting}
            canEdit={canEditLin} editing={editingLin} onEdit={() => setEditingLin(e => !e)} />}
          {selectedLin && editingLin && <LinEditor key={selectedLin.id} lin={selectedLin} onSave={saveLin} onCancel={() => setEditingLin(false)} />}
          <div className="relative min-h-0 flex-1">
          {!loading && lins.length === 0 && !error && (
            <p className="card m-6 max-w-md p-4 text-sm text-ink-body">No lins yet. A lin starts on its own the moment a big and a little confirm their link from their profiles.</p>
          )}
          {loading && <p className="absolute top-3 left-4 z-10 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink-muted">Loading…</p>}
          {linId && isUuid(linId) && view === 'graph' && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={loadedLin} focusToken={focusToken} highlightedLinkIds={highlightedLinkIds} />}
          {linId && isUuid(linId) && view === 'list' && <LinMemberList graph={currentGraph} photoUrls={photoUrls} selectedId={personId} membersStatus={membersStatus} onSelect={id => setQuery({ person: id })} />}
          {linId && isUuid(linId) && view === 'insights' && <LinInsights graph={currentGraph} />}
          </div>
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
            onGraphChanged={graphChanged}
            relationshipPath={relationshipPath}
            details={personId === viewerId ? selfDetails : undefined}
            viewerLinIds={selfDetails.linIds}
          />
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
