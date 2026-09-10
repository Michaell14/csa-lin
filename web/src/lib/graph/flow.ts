import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { GraphPerson, LinGraph } from '@/lib/types'
import { NODE_W, type Positioned } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'
import { lineageOf } from '@/lib/graph/lineage'

export type PersonNodeData = {
  person: GraphPerson
  photoUrl: string | null
  selected: boolean
  dimmed: boolean
  color: string
}
export type YearNodeData = { year: number; width: number }

export type PersonFlowNode = Node<PersonNodeData, 'person'>
export type YearFlowNode = Node<YearNodeData, 'year'>
export type LinFlowNode = PersonFlowNode | YearFlowNode

const EDGE_DEFAULT = '#9ca3af'
const EDGE_ON_LINE = '#4b5563'
const EDGE_DIMMED = '#e5e7eb'

export const YEAR_LABEL_W = 96
const YEAR_LABEL_GAP = 16

export function buildFlowElements(
  graph: LinGraph,
  layout: { nodes: Positioned[] },
  opts: { selectedId: string | null; photoUrls: Map<string, string> },
): { nodes: PersonFlowNode[]; edges: Edge[] } {
  const pos = new Map(layout.nodes.map(n => [n.id, n]))
  // With someone selected, their line stays lit and everything else recedes.
  const lineage = lineageOf(graph, opts.selectedId)
  const dimming = lineage.people.size > 0

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
        dimmed: dimming && !lineage.people.has(person.id),
        color: yearColor(person.grad_year),
      },
    }
  })

  const edges: Edge[] = graph.links.map(l => {
    const onLine = lineage.links.has(l.id)
    const stroke = onLine ? EDGE_ON_LINE : dimming ? EDGE_DIMMED : EDGE_DEFAULT
    return {
      id: l.id,
      source: l.big_id,
      target: l.little_id,
      type: 'smoothstep',
      // The arrow points from big down to little, which position alone only implies.
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      style: { stroke, strokeWidth: onLine ? 2.5 : 1.5 },
      zIndex: onLine ? 1 : 0,
    }
  })

  return { nodes, edges }
}

// One banded label per graduating class, behind the pills, so the rows read as
// class years instead of as an unexplained vertical order.
export function buildYearNodes(graph: LinGraph, layout: { nodes: Positioned[] }): YearFlowNode[] {
  if (layout.nodes.length === 0) return []
  const yearOf = new Map(graph.people.map(p => [p.id, p.grad_year]))
  const minX = Math.min(...layout.nodes.map(n => n.x))
  const maxX = Math.max(...layout.nodes.map(n => n.x + NODE_W))
  const gutter = YEAR_LABEL_W + YEAR_LABEL_GAP

  const yearByRow = new Map<number, number>()
  for (const n of layout.nodes) {
    const year = yearOf.get(n.id)
    if (year !== undefined) yearByRow.set(n.y, year)
  }

  return [...yearByRow].map(([y, year]) => ({
    id: `year-${year}`,
    type: 'year',
    position: { x: minX - gutter, y },
    data: { year, width: maxX - minX + gutter },
    draggable: false,
    selectable: false,
    focusable: false,
    zIndex: -1,
    style: { pointerEvents: 'none' as const },
  }))
}
