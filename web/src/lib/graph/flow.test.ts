import { describe, it, expect } from 'vitest'
import { layoutLin, NODE_H, NODE_W } from '@/lib/graph/layout'
import { buildFlowElements, portFraction } from '@/lib/graph/flow'
import { linAGraph, ID } from '@/lib/testFixtures'

describe('buildFlowElements', () => {
  const layout = layoutLin(linAGraph)
  const photoUrls = new Map([[`${ID.big1}/avatar.jpg`, 'https://x/1']])
  const { nodes, edges } = buildFlowElements({ ...linAGraph, people: linAGraph.people.map(p => p.id === ID.big1 ? { ...p, photo_path: `${ID.big1}/avatar.jpg` } : p) }, layout, { selectedId: ID.child1, photoUrls })

  it('creates one node per person and one edge per link', () => {
    expect(nodes.map(n => n.id).sort()).toEqual(linAGraph.people.map(p => p.id).sort())
    expect(edges.map(e => e.id).sort()).toEqual(linAGraph.links.map(l => l.id).sort())
  })
  it('directs edges from big to little', () => {
    const e = edges.find(e => e.id === 'l5')!
    expect(e.source).toBe(ID.child1)
    expect(e.target).toBe(ID.shared)
  })
  it('gives each link its own bottom and top attachment point', () => {
    const e = edges.find(e => e.id === 'l5')!
    expect(e.sourceHandle).toBe('s-l5')
    expect(e.targetHandle).toBe('t-l5')
    expect(e.type).toBe('straight')
    const founder = nodes.find(n => n.id === ID.founder)!
    const childX = new Map(layout.nodes.map(n => [n.id, n.x]))
    const expected = [...linAGraph.links.filter(l => l.big_id === ID.founder)]
      .sort((a, b) => childX.get(a.little_id)! - childX.get(b.little_id)!)
      .map(l => l.id)
    expect(founder.data.sourcePorts).toEqual(expected)
    expect(new Set(founder.data.sourcePorts).size).toBe(2)
  })
  it('marks the selected node and resolves photo urls', () => {
    expect(nodes.find(n => n.id === ID.child1)!.data.selected).toBe(true)
    expect(nodes.find(n => n.id === ID.big2)!.data.selected).toBe(false)
    expect(nodes.find(n => n.id === ID.big1)!.data.photoUrl).toBe('https://x/1')
    expect(nodes.find(n => n.id === ID.big2)!.data.photoUrl).toBeNull()
  })
  it('emphasizes links in the active relationship path', () => {
    const result = buildFlowElements(linAGraph, layout, { selectedId: null, photoUrls, highlightedLinkIds: new Set(['l5']) })
    const onPath = result.edges.find(e => e.id === 'l5')!
    const offPath = result.edges.find(e => e.id !== 'l5')!
    expect(onPath.animated).toBe(true)
    expect(onPath.style).toMatchObject({ stroke: 'var(--color-accent)', strokeWidth: 3 })
    expect(offPath.animated).toBe(false)
    // The emphasis has to be visible against the ordinary link, not just set.
    expect(offPath.style!.stroke).not.toBe(onPath.style!.stroke)
    expect(Number(onPath.style!.strokeWidth)).toBeGreaterThan(Number(offPath.style!.strokeWidth))
  })
  it('uses the person node type and positions from the layout', () => {
    const n = nodes.find(n => n.id === ID.founder)!
    const p = layout.nodes.find(n => n.id === ID.founder)!
    expect(n.type).toBe('person')
    expect(n.position).toEqual({ x: p.x, y: p.y })
  })
  it('keeps links between separate branches from crossing', () => {
    const positioned = new Map(nodes.map(n => [n.id, n]))
    const lines = edges.map(edge => {
      const big = positioned.get(edge.source)!, little = positioned.get(edge.target)!
      const sourceIndex = big.data.sourcePorts.indexOf(edge.id)
      const targetIndex = little.data.targetPorts.indexOf(edge.id)
      return {
        from: { x: big.position.x + NODE_W * portFraction(sourceIndex, big.data.sourcePorts.length), y: big.position.y + NODE_H },
        to: { x: little.position.x + NODE_W * portFraction(targetIndex, little.data.targetPorts.length), y: little.position.y },
      }
    })
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], b = lines[j]
      if (a.from.y !== b.from.y) continue
      // Within a generation gap, ordered endpoints mean straight segments
      // cannot cross. Sibling links also start at distinct ports.
      expect(a.from.x).not.toBe(b.from.x)
      expect((a.from.x - b.from.x) * (a.to.x - b.to.x)).toBeGreaterThan(0)
    }
  })
})
