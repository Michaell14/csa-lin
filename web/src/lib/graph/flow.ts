import type { Edge, Node } from '@xyflow/react'
import type { GraphPerson, LinGraph } from '@/lib/types'
import type { Positioned } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'

export type PersonNodeData = { person: GraphPerson; photoUrl: string | null; selected: boolean; color: string }
export type PersonFlowNode = Node<PersonNodeData, 'person'>

export function buildFlowElements(
  graph: LinGraph,
  layout: { nodes: Positioned[] },
  opts: { selectedId: string | null; photoUrls: Map<string, string> },
): { nodes: PersonFlowNode[]; edges: Edge[] } {
  const pos = new Map(layout.nodes.map(n => [n.id, n]))
  const nodes: PersonFlowNode[] = graph.people.map(person => {
    const p = pos.get(person.id) ?? { x: 0, y: 0 }
    return {
      id: person.id,
      type: 'person',
      position: { x: p.x, y: p.y },
      draggable: false,
      data: {
        person,
        photoUrl: person.photo_path ? opts.photoUrls.get(person.photo_path) ?? null : null,
        selected: person.id === opts.selectedId,
        color: yearColor(person.grad_year),
      },
    }
  })
  const edges: Edge[] = graph.links.map(l => ({
    id: l.id, source: l.big_id, target: l.little_id, type: 'smoothstep',
    style: { stroke: '#9ca3af', strokeWidth: 1.5 },
  }))
  return { nodes, edges }
}
