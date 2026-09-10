import type { LinGraph } from '@/lib/types'

// The people and links on one person's line: everyone above them through their
// bigs, everyone below them through their littles, and nobody off to the side.
export type Lineage = { people: Set<string>; links: Set<string> }

export const EMPTY_LINEAGE: Lineage = { people: new Set(), links: new Set() }

export function lineageOf(graph: LinGraph, selectedId: string | null): Lineage {
  if (!selectedId || !graph.people.some(p => p.id === selectedId)) return EMPTY_LINEAGE
  const known = new Set(graph.people.map(p => p.id))
  const people = new Set([selectedId])
  const links = new Set<string>()
  walk(graph, known, people, links, selectedId, 'up')
  walk(graph, known, people, links, selectedId, 'down')
  return { people, links }
}

function walk(
  graph: LinGraph,
  known: Set<string>,
  people: Set<string>,
  links: Set<string>,
  start: string,
  dir: 'up' | 'down',
) {
  const stack = [start]
  const seen = new Set([start])
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const l of graph.links) {
      const from = dir === 'up' ? l.little_id : l.big_id
      const to = dir === 'up' ? l.big_id : l.little_id
      if (from !== id || !known.has(to)) continue
      links.add(l.id)
      people.add(to)
      if (!seen.has(to)) { seen.add(to); stack.push(to) }
    }
  }
}
