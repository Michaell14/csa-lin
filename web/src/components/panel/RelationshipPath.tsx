'use client'
import type { LinGraph } from '@/lib/types'
import type { RelationshipPath as Path } from '@/lib/graph/relationship'
import { relationshipSummary } from '@/lib/graph/relationship'

export function RelationshipPath({ graph, path, onSelectPerson }: { graph: LinGraph; path: Path; onSelectPerson: (id: string) => void }) {
  const people = new Map(graph.people.map(person => [person.id, person]))
  return (
    <section className="rounded-lg border bg-neutral-50 p-3" aria-label="Your family connection">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your connection</p>
      <p className="mt-1 text-sm font-medium">{relationshipSummary(graph, path)}</p>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        {path.personIds.map((id, index) => {
          const person = people.get(id)
          const name = index === 0 ? 'You' : person?.display_name ?? 'Founder'
          return (
            <li key={id} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden className="text-neutral-400">→</span>}
              <button onClick={() => onSelectPerson(id)} className="rounded-full border bg-white px-2 py-0.5 hover:bg-neutral-100">{name}</button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
