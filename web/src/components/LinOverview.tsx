'use client'
import type { Lin, LinGraph, MembersStatus } from '@/lib/types'

export type LinView = 'graph' | 'list' | 'insights'

const VIEWS: [LinView, string][] = [['graph', 'Graph'], ['list', 'List'], ['insights', 'Insights']]

export function LinOverview({ lin, graph, view, hasSelf, membersStatus, onView, onFounder, onSelf, onExport, exporting, canEdit, onEdit, editing }: {
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
  onExport?: () => void
  exporting?: boolean
  // The founder (or an admin) may rename and recolour the lin.
  canEdit?: boolean
  onEdit?: () => void
  editing?: boolean
}) {
  const years = graph.people.flatMap(person => person.grad_year === null ? [] : [person.grad_year])
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : graph.people.length ? 'hidden' : 'No members yet'
  // A placeholder founder is a stand-in with no profile behind it, so opening
  // one would swap whatever the member is reading for "This person is not
  // visible". Offer the shortcut only when it leads somewhere.
  const founder = graph.people.find(person => person.id === lin.founder_id)
  const canOpenFounder = Boolean(founder && !founder.placeholder)
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-3 py-2 sm:px-4">
      <div className="min-w-0">
        <h1 className="heading truncate text-base"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-baseline" style={{ backgroundColor: lin.color }} />{lin.name}</h1>
        <p className="text-xs text-ink-muted tabular-nums">{
          membersStatus === 'loading' ? 'Loading members…'
          : membersStatus === 'unavailable' ? 'Members unavailable'
          : `${graph.people.length} ${graph.people.length === 1 ? 'member' : 'members'} · Classes ${span}`
        }</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onExport && <button onClick={onExport} disabled={exporting} aria-label="Export lin as PNG" className="btn-sm">{exporting ? 'Exporting…' : <><span className="sm:hidden">PNG</span><span className="hidden sm:inline">Export PNG</span></>}</button>}
        {canOpenFounder && <button onClick={onFounder} className="btn-sm hidden sm:inline-flex">Founder</button>}
        {canEdit && onEdit && <button onClick={onEdit} aria-pressed={Boolean(editing)} className="btn-sm">Edit lin</button>}
        {hasSelf && <button onClick={onSelf} className="btn-sm">Find me</button>}
        <div aria-label="Lin view" className="flex rounded-md bg-surface-hover p-0.5 text-sm">
          {VIEWS.map(([key, name]) => (
            <button key={key} onClick={() => onView(key)} aria-pressed={view === key}
              className={`relative rounded px-2.5 py-1 transition-[background-color,color,box-shadow] duration-100 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${view === key ? 'bg-white font-medium text-ink shadow-border' : 'text-ink-body hover:text-ink'}`}>{name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
