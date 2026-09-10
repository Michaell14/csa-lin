import { describe, it, expect } from 'vitest'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements } from '@/lib/graph/flow'
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
  it('marks the selected node and resolves photo urls', () => {
    expect(nodes.find(n => n.id === ID.child1)!.data.selected).toBe(true)
    expect(nodes.find(n => n.id === ID.big2)!.data.selected).toBe(false)
    expect(nodes.find(n => n.id === ID.big1)!.data.photoUrl).toBe('https://x/1')
    expect(nodes.find(n => n.id === ID.big2)!.data.photoUrl).toBeNull()
  })
  it('uses the person node type and positions from the layout', () => {
    const n = nodes.find(n => n.id === ID.founder)!
    const p = layout.nodes.find(n => n.id === ID.founder)!
    expect(n.type).toBe('person')
    expect(n.position).toEqual({ x: p.x, y: p.y })
  })
})
