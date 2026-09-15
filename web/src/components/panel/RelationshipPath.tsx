'use client'
import type { LinGraph } from '@/lib/types'
import type { RelationshipPath as Path } from '@/lib/graph/relationship'
import { relationshipSummary } from '@/lib/graph/relationship'

export function RelationshipPath({ graph, path, onSelectPerson }: { graph: LinGraph; path: Path; onSelectPerson: (id: string) => void }) {
  const people = new Map(graph.people.map(person => [person.id, person]))
  return (
    <section className="rounded-md border border-line bg-surface-muted p-3" aria-label="Your family connection">
      <p className="label">Your connection</p>
      <p className="mt-1 text-sm font-medium text-ink">{relationshipSummary(graph, path)}</p>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        {path.personIds.map((id, index) => {
          const person = people.get(id)
          // A placeholder founder has no profile, and someone absent from the
          // graph is hidden from this viewer. Selecting either would trade the
          // panel they are reading for "This person is not visible", so they are
          // labels rather than buttons.
          const openable = index === 0 || Boolean(person && !person.placeholder)
          const name = index === 0 ? 'You'
            : !person ? 'Hidden member'
            : person.placeholder ? 'Founder'
            : person.display_name ?? 'Unnamed'
          return (
            <li key={id} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden className="text-ink-muted">→</span>}
              {openable
                ? <button onClick={() => onSelectPerson(id)} className="rounded-full border border-line-strong bg-white px-2.5 py-0.5 text-sm text-ink hover:bg-surface-hover">{name}</button>
                : <span className="rounded-full border border-dashed border-ink-faint px-2.5 py-0.5 text-sm italic text-ink-muted">{name}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
