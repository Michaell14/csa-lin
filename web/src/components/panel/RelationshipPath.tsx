'use client'
import type { LinGraph } from '@/lib/types'
import type { RelationshipPath as Path } from '@/lib/graph/relationship'
import { relationshipSummary } from '@/lib/graph/relationship'

export function RelationshipPath({ graph, path, onSelectPerson }: { graph: LinGraph; path: Path; onSelectPerson: (id: string) => void }) {
  const people = new Map(graph.people.map(person => [person.id, person]))
  return (
    <section className="rounded-card border-[3px] border-ink bg-blush p-3 shadow-sticker-xs" aria-label="Your family connection">
      <p className="display text-xs font-bold uppercase tracking-wide text-ink-muted">Your connection</p>
      <p className="mt-1 text-sm font-bold text-ink">{relationshipSummary(graph, path)}</p>
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
              {index > 0 && <span aria-hidden className="font-bold text-ink-muted">→</span>}
              {openable
                ? <button onClick={() => onSelectPerson(id)} className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-sm font-bold hover:bg-gold-tint">{name}</button>
                : <span className="rounded-full border-2 border-ink bg-cream px-2.5 py-0.5 text-sm font-bold italic text-ink-muted">{name}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
