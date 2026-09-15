'use client'
import type { GraphPerson, LinGraph, MembersStatus } from '@/lib/types'
import { initials } from '@/components/graph/PersonNode'
import { yearColor } from '@/lib/graph/colors'

export function groupPeopleByYear(people: GraphPerson[]): [number, GraphPerson[]][] {
  const groups = new Map<number, GraphPerson[]>()
  for (const person of people) groups.set(person.grad_year, [...(groups.get(person.grad_year) ?? []), person])
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([year, members]) => [year, members.sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''))])
}

export function LinMemberList({ graph, photoUrls, selectedId, membersStatus, onSelect }: {
  graph: LinGraph
  photoUrls: Map<string, string>
  selectedId: string | null
  // Whether `graph` describes the selected lin yet, so that an empty list is
  // only reported as "nobody here" when it actually is.
  membersStatus: MembersStatus
  onSelect: (id: string) => void
}) {
  const groups = groupPeopleByYear(graph.people)
  return (
    <div className="h-full overflow-y-auto bg-surface-muted px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {membersStatus === 'loading' && <p className="text-sm text-ink-muted">Loading members…</p>}
        {membersStatus === 'unavailable' && <p className="text-sm text-ink-muted">Members could not be loaded.</p>}
        {membersStatus === 'ready' && groups.length === 0 && <p className="text-sm text-ink-muted">No members yet.</p>}
        {membersStatus === 'ready' && groups.map(([year, people]) => (
          <section key={year} aria-labelledby={`class-${year}`}>
            <div className="mb-2 flex items-center gap-3">
              <h2 id={`class-${year}`} className="heading text-sm">Class of {year}</h2>
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-muted">{people.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {people.map(person => {
                const name = person.placeholder ? 'Founder' : (person.display_name ?? 'Unnamed')
                const photoUrl = person.photo_path ? photoUrls.get(person.photo_path) : null
                return (
                  <button key={person.id} onClick={() => onSelect(person.id)} aria-current={person.id === selectedId}
                    className={`flex min-h-14 items-center gap-3 rounded-lg border bg-white p-2.5 text-left hover:bg-surface-hover ${person.id === selectedId ? 'border-accent ring-1 ring-accent' : 'border-line'}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover text-xs text-ink-body" style={{ boxShadow: `0 0 0 2px ${yearColor(year)}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initials(person.placeholder ? null : person.display_name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{name}{!person.placeholder && person.is_founder ? ' · Founder' : ''}</span>
                      <span className="block truncate text-xs text-ink-muted">{person.major || (person.claimed === false ? 'Profile not claimed' : 'View profile')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
