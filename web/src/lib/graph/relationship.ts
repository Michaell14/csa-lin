import type { GraphLink, LinGraph } from '@/lib/types'

export type RelationshipPath = { personIds: string[]; linkIds: string[] }

/** Finds the shortest family connection, treating big/little links as traversable in either direction. */
export function shortestRelationshipPath(graph: LinGraph, from: string | null, to: string | null): RelationshipPath | null {
  if (!from || !to || from === to) return null
  const people = new Set(graph.people.map(person => person.id))
  if (!people.has(from) || !people.has(to)) return null

  const adjacent = new Map<string, { personId: string; link: GraphLink }[]>()
  // Append into the existing bucket: rebuilding it per link would make
  // adjacency construction quadratic in the degree of a well-connected person.
  for (const link of graph.links) {
    const bigNeighbours = adjacent.get(link.big_id)
    if (bigNeighbours) bigNeighbours.push({ personId: link.little_id, link })
    else adjacent.set(link.big_id, [{ personId: link.little_id, link }])
    const littleNeighbours = adjacent.get(link.little_id)
    if (littleNeighbours) littleNeighbours.push({ personId: link.big_id, link })
    else adjacent.set(link.little_id, [{ personId: link.big_id, link }])
  }
  const queue = [from]
  const previous = new Map<string, { personId: string; linkId: string }>()
  const seen = new Set([from])
  while (queue.length) {
    const current = queue.shift()!
    for (const next of adjacent.get(current) ?? []) {
      if (seen.has(next.personId)) continue
      seen.add(next.personId)
      previous.set(next.personId, { personId: current, linkId: next.link.id })
      if (next.personId === to) {
        const personIds = [to]
        const linkIds: string[] = []
        let cursor = to
        while (cursor !== from) {
          const step = previous.get(cursor)!
          linkIds.unshift(step.linkId)
          personIds.unshift(step.personId)
          cursor = step.personId
        }
        return { personIds, linkIds }
      }
      queue.push(next.personId)
    }
  }
  return null
}

export function relationshipSummary(graph: LinGraph, path: RelationshipPath): string {
  const links = new Map(graph.links.map(link => [link.id, link]))
  const directions = path.linkIds.map((id, index) => links.get(id)?.big_id === path.personIds[index] ? 'down' : 'up')
  if (directions.every(direction => direction === 'up')) return directions.length === 1 ? 'Your big' : `${directions.length} generations above you`
  if (directions.every(direction => direction === 'down')) return directions.length === 1 ? 'Your little' : `${directions.length} generations below you`
  return `${path.linkIds.length} family links away`
}
