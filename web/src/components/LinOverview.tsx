'use client'
import type { Lin, LinGraph } from '@/lib/types'

export type LinView = 'graph' | 'list'

export function LinOverview({ lin, graph, view, hasSelf, onView, onFounder, onSelf }: {
  lin: Lin
  graph: LinGraph
  view: LinView
  hasSelf: boolean
  onView: (view: LinView) => void
  onFounder: () => void
  onSelf: () => void
}) {
  const years = graph.people.map(person => person.grad_year)
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'No members yet'
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white px-3 py-2 sm:px-4">
      <div className="min-w-0">
        <h1 className="truncate font-semibold"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: lin.color }} />{lin.name}</h1>
        <p className="text-xs text-neutral-500">{graph.people.length} {graph.people.length === 1 ? 'member' : 'members'} · Classes {span}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onFounder} className="hidden rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-50 sm:block">Founder</button>
        {hasSelf && <button onClick={onSelf} className="rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-50">Find me</button>}
        <div aria-label="Lin view" className="flex rounded-md border p-0.5 text-sm">
          <button onClick={() => onView('graph')} aria-pressed={view === 'graph'} className={`rounded px-2 py-1 ${view === 'graph' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>Graph</button>
          <button onClick={() => onView('list')} aria-pressed={view === 'list'} className={`rounded px-2 py-1 ${view === 'list' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>List</button>
        </div>
      </div>
    </div>
  )
}
