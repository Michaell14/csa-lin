import dagre from '@dagrejs/dagre'
import type { LinGraph } from '@/lib/types'

export const NODE_W = 180
export const NODE_H = 40
const ROW_GAP = 80
const COL_GAP = 32

export type Positioned = { id: string; x: number; y: number }

// dagre decides left-to-right order and x; grad year decides the row (y).
export function layoutLin(graph: LinGraph): { nodes: Positioned[]; rows: number[] } {
  if (graph.people.length === 0) return { nodes: [], rows: [] }
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: COL_GAP, ranksep: ROW_GAP })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(graph.people.map(p => p.id))
  for (const p of graph.people) g.setNode(p.id, { width: NODE_W, height: NODE_H })
  for (const l of graph.links) if (ids.has(l.big_id) && ids.has(l.little_id)) g.setEdge(l.big_id, l.little_id)
  dagre.layout(g)

  const rows = [...new Set(graph.people.map(p => p.grad_year))].sort((a, b) => a - b)
  const rowOf = new Map(rows.map((y, i) => [y, i]))
  const nodes = graph.people.map(p => {
    const n = g.node(p.id)
    return { id: p.id, x: (n?.x ?? 0) - NODE_W / 2, y: rowOf.get(p.grad_year)! * (NODE_H + ROW_GAP) }
  })

  // Dagre only keeps nodes apart within its own ranks; rows are ours.
  // Push apart any two pills that ended up overlapping on the same row.
  const byRow = new Map<number, Positioned[]>()
  for (const n of nodes) byRow.set(n.y, [...(byRow.get(n.y) ?? []), n])
  for (const row of byRow.values()) {
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) {
      const minX = row[i - 1].x + NODE_W + COL_GAP
      if (row[i].x < minX) row[i].x = minX
    }
  }

  return { nodes, rows }
}
