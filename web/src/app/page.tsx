'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLins, fetchLinsOf } from '@/lib/api/lins'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { useLinGraph } from '@/lib/hooks/useLinGraph'
import { useViewer } from '@/lib/viewer'
import { errorMessage } from '@/lib/errors'
import type { Lin } from '@/lib/types'
import { TopBar } from '@/components/TopBar'
import { LinGraph } from '@/components/graph/LinGraph'
import { SidePanel } from '@/components/panel/SidePanel'

function Home() {
  const sb = useMemo(() => createClient(), [])
  const viewer = useViewer()
  const router = useRouter()
  const params = useSearchParams()
  const linId = params.get('lin')
  const personId = params.get('person')

  const [lins, setLins] = useState<Lin[]>([])
  const [error, setError] = useState<string | null>(null)
  const { graph, photoUrls, loading, error: graphError, reload } = useLinGraph(linId)

  const setQuery = useCallback((next: { lin?: string | null; person?: string | null }) => {
    const q = new URLSearchParams(params.toString())
    if (next.lin !== undefined) { if (next.lin) q.set('lin', next.lin); else q.delete('lin') }
    if (next.person !== undefined) { if (next.person) q.set('person', next.person); else q.delete('person') }
    router.replace(`/?${q.toString()}`)
  }, [params, router])

  // Load lins once; default to the viewer's own lin, else the first.
  useEffect(() => {
    if (viewer.loading) return
    ;(async () => {
      try {
        const all = await fetchLins(sb)
        setLins(all)
        if (!linId && all.length > 0) {
          const mine = viewer.personId ? await fetchLinsOf(sb, viewer.personId) : []
          setQuery({ lin: mine[0] ?? all[0].id })
        }
      } catch (e) { setError(errorMessage(e)) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loading, viewer.personId, sb])

  const openPerson = useCallback(async (id: string) => {
    try {
      const inCurrent = graph.people.some(p => p.id === id)
      if (inCurrent) { setQuery({ person: id }); return }
      const theirs = await fetchLinsOf(sb, id)
      setQuery({ lin: theirs[0] ?? linId, person: id })
    } catch (e) { setError(errorMessage(e)) }
  }, [graph.people, linId, sb, setQuery])

  const search = useCallback((q: string) => searchPeople(sb, q), [sb])
  const onPick = useCallback((hit: PersonHit) => { void openPerson(hit.id) }, [openPerson])

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        lins={lins}
        selectedLinId={linId}
        onSelectLin={id => setQuery({ lin: id, person: null })}
        search={search}
        onPick={onPick}
        onOpenSelf={() => { if (viewer.personId) void openPerson(viewer.personId) }}
      />
      {(error || graphError) && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error ?? graphError}</p>}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {!loading && lins.length === 0 && !error && (
            <p className="p-6 text-sm text-neutral-500">No lins yet. An admin can create the first one from the Admin page.</p>
          )}
          {loading && <p className="absolute left-4 top-2 z-10 text-sm text-neutral-500">Loading…</p>}
          {linId && <LinGraph graph={graph} photoUrls={photoUrls} selectedId={personId} onSelect={id => setQuery({ person: id })} linKey={linId} />}
        </div>
        {personId && (
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
