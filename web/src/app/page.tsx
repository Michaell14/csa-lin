'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLins, fetchLinsOf } from '@/lib/api/lins'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { useLinGraph } from '@/lib/hooks/useLinGraph'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import { isUuid } from '@/lib/ids'
import type { Lin } from '@/lib/types'
import { TopBar } from '@/components/TopBar'
import { LinGraph } from '@/components/graph/LinGraph'
import { LinSidebar } from '@/components/LinSidebar'
import { SidePanel } from '@/components/panel/SidePanel'
import { Toast } from '@/components/Toast'
import { GraphSkeleton } from '@/components/graph/GraphSkeleton'

function Home() {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const router = useRouter()
  const params = useSearchParams()
  const linId = params.get('lin')
  const personId = params.get('person')

  const [lins, setLins] = useState<Lin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const { graph, photoUrls, loading, error: graphError, reload } = useLinGraph(linId)

  // Picking a lin or a person is navigation, so it gets a history entry and the
  // back button undoes it. Only the opening redirect to a default lin replaces.
  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }, opts: { replace?: boolean } = {}) => {
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    const url = `/?${q.toString()}`
    if (opts.replace) router.replace(url)
    else router.push(url)
  }, [params, router])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    ;(async () => {
      try {
        setError(null)
        const all = await fetchLins(sb)
        setLins(all)
        if (!linId && all.length > 0) {
          const mine = viewer.personId ? await fetchLinsOf(sb, viewer.personId) : []
          setQuery({ lin: mine[0] ?? all[0].id }, { replace: true })
        }
      } catch (e) { setError(errorMessage(e)) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    try {
      setError(null)
      const inCurrent = graph.people.some(p => p.id === id)
      if (inCurrent) { setQuery({ person: id }); return }
      const theirs = await fetchLinsOf(sb, id)
      setQuery({ lin: theirs[0] ?? linId, person: id })
    } catch (e) { setError(errorMessage(e)) }
  }, [graph.people, linId, sb, setQuery])

  const message = (error ?? graphError) || null
  // Dismissal covers the error being shown, not its wording. Once the error
  // clears, an unrelated later failure that happens to read the same is a new
  // occurrence and has to be announced again.
  useEffect(() => { if (!message) setDismissed(null) }, [message])
  const showMessage = message && message !== dismissed ? message : null
  const firstLoad = loading && graph.people.length === 0
  const emptyLin = !loading && !graphError && !!linId && isUuid(linId) && graph.people.length === 0 && lins.length > 0

  const search = useCallback((q: string) => searchPeople(sb, q), [sb])
  const onPick = useCallback((hit: PersonHit) => { void openPerson(hit.id) }, [openPerson])

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        search={search}
        onPick={onPick}
        onOpenSelf={() => { if (viewer.personId) void openPerson(viewer.personId) }}
      />
      {showMessage && <Toast message={showMessage} onDismiss={() => setDismissed(showMessage)} />}
      <div className="relative flex min-h-0 flex-1">
        <LinSidebar lins={lins} selectedId={linId} onSelect={id => setQuery({ lin: id, person: null })} />
        <div className="relative min-w-0 flex-1" aria-busy={loading}>
          {!loading && lins.length === 0 && !error && (
            <p className="p-6 text-sm text-ink-faint">No lins yet. An admin can create the first one from the Admin page.</p>
          )}
          {firstLoad && <GraphSkeleton />}
          {emptyLin && (
            <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
              <p className="text-sm font-medium">Nobody is on this lin yet</p>
              <p className="text-sm text-ink-faint">An admin can add its founder and members from the Admin page.</p>
            </div>
          )}
          {/* The previous tree stays put while the next one loads, rather than blanking. */}
          {!firstLoad && !emptyLin && linId && isUuid(linId) && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={linId} />}
          {loading && !firstLoad && (
            <p className="absolute left-4 top-3 z-10 rounded-full border bg-surface px-3 py-1 text-xs text-ink-faint shadow-sm">Loading…</p>
          )}
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
          />
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><Home /></Suspense>
}
