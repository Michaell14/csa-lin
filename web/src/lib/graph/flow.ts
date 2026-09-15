import type { Edge, Node } from '@xyflow/react'
import type { GraphPerson, LinGraph } from '@/lib/types'
import type { Positioned } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'

export type PersonNodeData = { person: GraphPerson; photoUrl: string | null; selected: boolean; color: string }
export type PersonFlowNode = Node<PersonNodeData, 'person'>
export type HandleSide = 'top' | 'bottom' | 'left' | 'right'

// Rows follow grad year, not lineage, so a big can sit below (or beside) their
// little. An edge always leaves the big on the side facing the little and
// enters the little on the side facing the big; otherwise smoothstep detours
// around both pills to reach a bottom-to-top pair that points the wrong way.
export function edgeSides(big: Pick<Positioned, 'x' | 'y'>, little: Pick<Positioned, 'x' | 'y'>): { source: HandleSide; target: HandleSide } {
  if (little.y > big.y) return { source: 'bottom', target: 'top' }
  if (little.y < big.y) return { source: 'top', target: 'bottom' }
  return little.x >= big.x ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
}

export function buildFlowElements(
  graph: LinGraph,
  layout: { nodes: Positioned[] },
  opts: { selectedId: string | null; photoUrls: Map<string, string>; highlightedLinkIds?: Set<string> },
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
  const edges: Edge[] = graph.links.map(l => {
    const sides = edgeSides(pos.get(l.big_id) ?? { x: 0, y: 0 }, pos.get(l.little_id) ?? { x: 0, y: 0 })
    // The connection to the viewer is drawn in the accent rather than the grey
    // every other link uses, so the path reads at a glance without changing the
    // shape of the tree. Both colours are the CSS tokens from globals.css.
    const highlighted = opts.highlightedLinkIds?.has(l.id) ?? false
    return {
      id: l.id, source: l.big_id, target: l.little_id, type: 'smoothstep',
      sourceHandle: `s-${sides.source}`, targetHandle: `t-${sides.target}`,
      animated: highlighted,
      style: highlighted ? { stroke: 'var(--color-accent)', strokeWidth: 3 } : { stroke: 'var(--color-ink-faint)', strokeWidth: 2 },
    }
  })
  return { nodes, edges }
}
