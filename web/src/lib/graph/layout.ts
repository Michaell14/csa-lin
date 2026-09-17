import dagre from '@dagrejs/dagre'
import type { LinGraph } from '@/lib/types'

export const NODE_W = 180
export const NODE_H = 40
const ROW_GAP = 80
const COL_GAP = 32

export type Positioned = { id: string; x: number; y: number }

// The vertical row is the longest path from a root, so every little is below
// each of their bigs and class year never inserts an empty generation between
// them. Ordinary trees get disjoint branch spans; shared descendants use Dagre
// to keep the general graph compact horizontally.
export function layoutLin(graph: LinGraph): { nodes: Positioned[]; rows: number[] } {
  if (graph.people.length === 0) return { nodes: [], rows: [] }
  const ids = new Set(graph.people.map(p => p.id))
  const children = new Map(graph.people.map(p => [p.id, new Set<string>()]))
  const remainingParents = new Map(graph.people.map(p => [p.id, 0]))
  const generation = new Map(graph.people.map(p => [p.id, 0]))
  for (const link of graph.links) {
    if (!ids.has(link.big_id) || !ids.has(link.little_id) || children.get(link.big_id)!.has(link.little_id)) continue
    children.get(link.big_id)!.add(link.little_id)
    remainingParents.set(link.little_id, remainingParents.get(link.little_id)! + 1)
  }
  const roots = graph.people.map(p => p.id).filter(id => remainingParents.get(id) === 0)
  const queue = [...roots]
  for (let i = 0; i < queue.length; i++) {
    const big = queue[i]
    for (const little of children.get(big)!) {
      generation.set(little, Math.max(generation.get(little)!, generation.get(big)! + 1))
      const remaining = remainingParents.get(little)! - 1
      remainingParents.set(little, remaining)
      if (remaining === 0) queue.push(little)
    }
  }

  const rows = [...new Set(generation.values())].sort((a, b) => a - b)
  // A family without shared littles is a forest. Reserve a separate horizontal
  // span for every branch, then center each big above their own descendants.
  // This makes ordinary trees crossing-free instead of relying on Dagre's
  // approximate crossing minimization.
  const edgeCount = [...children.values()].reduce((count, links) => count + links.size, 0)
  if (queue.length === graph.people.length && edgeCount === graph.people.length - roots.length) {
    const personById = new Map(graph.people.map(p => [p.id, p]))
    const order = (a: string, b: string) => {
      const pa = personById.get(a)!, pb = personById.get(b)!
      return (pa.grad_year ?? 0) - (pb.grad_year ?? 0) || (pa.display_name ?? '').localeCompare(pb.display_name ?? '') || a.localeCompare(b)
    }
    const sortedChildren = new Map([...children].map(([id, links]) => [id, [...links].sort(order)]))
    const widths = new Map<string, number>()
    const widthOf = (id: string): number => {
      const kids = sortedChildren.get(id)!
      const width = Math.max(NODE_W, kids.reduce((total, child) => total + widthOf(child), 0) + COL_GAP * Math.max(0, kids.length - 1))
      widths.set(id, width)
      return width
    }
    roots.sort(order)
    const placed = new Map<string, Positioned>()
    const place = (id: string, left: number) => {
      const width = widths.get(id)!
      placed.set(id, { id, x: left + (width - NODE_W) / 2, y: generation.get(id)! * (NODE_H + ROW_GAP) })
      const kids = sortedChildren.get(id)!
      const childrenWidth = kids.reduce((total, child) => total + widths.get(child)!, 0) + COL_GAP * Math.max(0, kids.length - 1)
      let childLeft = left + (width - childrenWidth) / 2
      for (const child of kids) {
        place(child, childLeft)
        childLeft += widths.get(child)! + COL_GAP
      }
    }
    let left = 0
    for (const root of roots) {
      const width = widthOf(root)
      place(root, left)
      left += width + COL_GAP
    }
    return { nodes: graph.people.map(p => placed.get(p.id)!), rows }
  }

  // A little with multiple bigs cannot belong to separate branch spans. Keep
  // that person once and use Dagre's order for the more general DAG.
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: COL_GAP, ranksep: ROW_GAP })
  g.setDefaultEdgeLabel(() => ({}))
  for (const p of graph.people) g.setNode(p.id, { width: NODE_W, height: NODE_H })
  for (const l of graph.links) if (ids.has(l.big_id) && ids.has(l.little_id)) g.setEdge(l.big_id, l.little_id)
  dagre.layout(g)

  const nodes = graph.people.map(p => {
    const n = g.node(p.id)
    return { id: p.id, x: (n?.x ?? 0) - NODE_W / 2, y: generation.get(p.id)! * (NODE_H + ROW_GAP) }
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
