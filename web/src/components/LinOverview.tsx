'use client'
import type { Lin, LinGraph, MembersStatus } from '@/lib/types'

export type LinView = 'graph' | 'list' | 'insights'

export function LinOverview({ lin, graph, view, hasSelf, membersStatus, onView, onFounder, onSelf }: {
  lin: Lin
  graph: LinGraph
  view: LinView
  hasSelf: boolean
  // Whether `graph` actually describes `lin` yet: the counts below would
  // otherwise report an established lin as empty while it loads, and go on
  // saying so after a request that failed outright.
  membersStatus: MembersStatus
  onView: (view: LinView) => void
  onFounder: () => void
  onSelf: () => void
}) {
  const years = graph.people.map(person => person.grad_year)
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : 'No members yet'
  // A placeholder founder is a stand-in with no profile behind it, so opening
  // one would swap whatever the member is reading for "This person is not
  // visible". Offer the shortcut only when it leads somewhere.
  const founder = graph.people.find(person => person.id === lin.founder_id)
  const canOpenFounder = Boolean(founder && !founder.placeholder)
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white px-3 py-2 sm:px-4">
      <div className="min-w-0">
        <h1 className="truncate font-semibold"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: lin.color }} />{lin.name}</h1>
        <p className="text-xs text-neutral-500">{
          membersStatus === 'loading' ? 'Loading members…'
          : membersStatus === 'unavailable' ? 'Members unavailable'
          : `${graph.people.length} ${graph.people.length === 1 ? 'member' : 'members'} · Classes ${span}`
        }</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {canOpenFounder && <button onClick={onFounder} className="hidden rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-50 sm:block">Founder</button>}
        {hasSelf && <button onClick={onSelf} className="rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-50">Find me</button>}
        <div aria-label="Lin view" className="flex rounded-md border p-0.5 text-sm">
          <button onClick={() => onView('graph')} aria-pressed={view === 'graph'} className={`rounded px-2 py-1 ${view === 'graph' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>Graph</button>
          <button onClick={() => onView('list')} aria-pressed={view === 'list'} className={`rounded px-2 py-1 ${view === 'list' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>List</button>
          <button onClick={() => onView('insights')} aria-pressed={view === 'insights'} className={`rounded px-2 py-1 ${view === 'insights' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}>Insights</button>
        </div>
      </div>
    </div>
  )
}
