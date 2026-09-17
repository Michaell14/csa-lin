'use client'
import type { GraphPerson, LinGraph, MembersStatus } from '@/lib/types'
import { initials } from '@/components/graph/PersonNode'
import { yearColor } from '@/lib/graph/colors'

export function groupPeopleByYear(people: GraphPerson[]): [number | null, GraphPerson[]][] {
  const groups = new Map<number | null, GraphPerson[]>()
  for (const person of people) groups.set(person.grad_year, [...(groups.get(person.grad_year) ?? []), person])
  return [...groups.entries()].sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity)).map(([year, members]) => [year, members.sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''))])
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
              <h2 id={`class-${year}`} className="heading text-sm">{year === null ? 'Hidden members' : `Class of ${year}`}</h2>
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-muted tabular-nums">{people.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {people.map(person => {
                const name = person.placeholder ? '?' : (person.display_name ?? 'Unnamed')
                const photoUrl = person.photo_path ? photoUrls.get(person.photo_path) : null
                const content = <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs text-ink-body" style={{ backgroundColor: year === null ? '#837a7026' : `${yearColor(year)}26`, boxShadow: `0 0 0 2px ${year === null ? '#837a70' : yearColor(year)}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {person.placeholder ? '?' : photoUrl ? <img src={photoUrl} alt="" className="photo h-full w-full rounded-full object-cover" /> : initials(person.display_name)}
                    </span>
                    {!person.placeholder && <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{name}{person.is_founder ? ' · Founder' : ''}</span>
                      <span className="block truncate text-xs text-ink-muted">{person.major || (person.claimed === false ? 'Profile not claimed' : 'View profile')}</span>
                    </span>}
                  </>
                return person.placeholder ? <div key={person.id} aria-label="Hidden person" className="card flex min-h-14 items-center gap-3 p-2.5 text-left">{content}</div> : (
                  <button key={person.id} onClick={() => onSelect(person.id)} aria-current={person.id === selectedId}
                    className={`card flex min-h-14 items-center gap-3 p-2.5 text-left transition-[background-color,box-shadow] duration-100 hover:bg-surface-hover hover:shadow-border-hover ${person.id === selectedId ? 'ring-2 ring-accent' : ''}`}>
                    {content}
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
