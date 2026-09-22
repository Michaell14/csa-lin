import type { Edge, Node } from '@xyflow/react'
import type { GraphPerson, LinGraph } from '@/lib/types'
import type { Positioned } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'

export type PersonNodeData = {
  person: GraphPerson
  photoUrl: string | null
  selected: boolean
  color: string
  sourcePorts: string[]
  targetPorts: string[]
}
export type PersonFlowNode = Node<PersonNodeData, 'person'>

export const portFraction = (index: number, total: number) => (index + 1) / (total + 1)

export function buildFlowElements(
  graph: LinGraph,
  layout: { nodes: Positioned[] },
  opts: { selectedId: string | null; photoUrls: Map<string, string>; highlightedLinkIds?: Set<string> },
): { nodes: PersonFlowNode[]; edges: Edge[] } {
  const pos = new Map(layout.nodes.map(n => [n.id, n]))
  const outgoing = new Map(graph.people.map(p => [p.id, [] as { id: string; otherX: number }[]]))
  const incoming = new Map(graph.people.map(p => [p.id, [] as { id: string; otherX: number }[]]))
  for (const link of graph.links) {
    const big = pos.get(link.big_id), little = pos.get(link.little_id)
    if (!big || !little) continue
    outgoing.get(link.big_id)?.push({ id: link.id, otherX: little.x })
    incoming.get(link.little_id)?.push({ id: link.id, otherX: big.x })
  }
  const portOrder = (ports: { id: string; otherX: number }[] | undefined) =>
    (ports ?? []).sort((a, b) => a.otherX - b.otherX || a.id.localeCompare(b.id)).map(port => port.id)
  const nodes: PersonFlowNode[] = graph.people.map(person => {
    const p = pos.get(person.id) ?? { x: 0, y: 0 }
    const selected = person.id === opts.selectedId
    // React Flow's node wrapper is the element that takes focus, so it carries
    // the accessible name and state. A person is a button that opens their
    // profile; a hidden placeholder leads nowhere, so it is skipped over.
    const accessible = person.placeholder
      ? { focusable: false, ariaRole: 'img' as const, ariaLabel: 'Hidden person' }
      : { ariaRole: 'button' as const, ariaLabel: `${person.display_name ?? 'Unnamed'}${person.grad_year === null ? '' : `, class of ${person.grad_year}`}`, domAttributes: { 'aria-pressed': selected } }
    return {
      id: person.id,
      type: 'person',
      position: { x: p.x, y: p.y },
      draggable: false,
      ...accessible,
      data: {
        person,
        photoUrl: person.photo_path ? opts.photoUrls.get(person.photo_path) ?? null : null,
        selected,
        color: person.placeholder || person.grad_year === null ? '#837a70' : yearColor(person.grad_year),
        sourcePorts: portOrder(outgoing.get(person.id)),
        targetPorts: portOrder(incoming.get(person.id)),
      },
    }
  })
  const edges: Edge[] = graph.links.map(l => {
    // The connection to the viewer is drawn in the accent rather than the grey
    // every other link uses, so the path reads at a glance without changing the
    // shape of the tree. Both colours are the CSS tokens from globals.css.
    const highlighted = opts.highlightedLinkIds?.has(l.id) ?? false
    return {
      id: l.id, source: l.big_id, target: l.little_id, type: 'connection',
      sourceHandle: `s-${l.id}`, targetHandle: `t-${l.id}`,
      animated: highlighted,
      style: highlighted ? { stroke: 'var(--color-accent)', strokeWidth: 3 } : { stroke: 'var(--color-ink-faint)', strokeWidth: 2 },
    }
  })
  return { nodes, edges }
}
