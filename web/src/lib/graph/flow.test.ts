import { describe, it, expect } from 'vitest'
import { layoutLin, NODE_W } from '@/lib/graph/layout'
import { buildFlowElements, buildYearNodes, YEAR_LABEL_W } from '@/lib/graph/flow'
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
  it('gives every edge an arrowhead in its own colour', () => {
    for (const e of edges) {
      expect(e.markerEnd).toMatchObject({ type: 'arrowclosed', color: e.style!.stroke })
    }
  })
  it('marks the selected node and resolves photo urls', () => {
    expect(nodes.find(n => n.id === ID.child1)!.data.selected).toBe(true)
    expect(nodes.find(n => n.id === ID.big2)!.data.selected).toBe(false)
    expect(nodes.find(n => n.id === ID.big1)!.data.photoUrl).toBe('https://x/1')
    expect(nodes.find(n => n.id === ID.big2)!.data.photoUrl).toBeNull()
  })
  it('dims everyone off the selected line', () => {
    const dimmed = nodes.filter(n => n.data.dimmed).map(n => n.id).sort()
    expect(dimmed).toEqual([ID.big2, ID.child2].sort())
  })
  it('draws the selected line heavier than the rest', () => {
    const onLine = edges.find(e => e.id === 'l3')!
    const offLine = edges.find(e => e.id === 'l4')!
    expect(onLine.style!.strokeWidth).toBeGreaterThan(offLine.style!.strokeWidth as number)
    expect(onLine.style!.stroke).not.toBe(offLine.style!.stroke)
  })
  it('uses the person node type and positions from the layout', () => {
    const n = nodes.find(n => n.id === ID.founder)!
    const p = layout.nodes.find(n => n.id === ID.founder)!
    expect(n.type).toBe('person')
    expect(n.position).toEqual({ x: p.x, y: p.y })
  })

  it('dims nobody and keeps one edge weight when nothing is selected', () => {
    const plain = buildFlowElements(linAGraph, layout, { selectedId: null, photoUrls })
    expect(plain.nodes.some(n => n.data.dimmed)).toBe(false)
    expect(new Set(plain.edges.map(e => e.style!.stroke)).size).toBe(1)
  })
})

describe('buildYearNodes', () => {
  const layout = layoutLin(linAGraph)
  const years = buildYearNodes(linAGraph, layout)

  it('makes one label per graduating class, at each row', () => {
    expect(years.map(n => n.data.year).sort()).toEqual([2020, 2021, 2022, 2023])
    const rowYs = new Set(layout.nodes.map(n => n.y))
    for (const n of years) expect(rowYs.has(n.position.y)).toBe(true)
  })
  it('lines the labels up in a gutter left of every pill', () => {
    const minX = Math.min(...layout.nodes.map(n => n.x))
    expect(new Set(years.map(n => n.position.x)).size).toBe(1)
    expect(years[0].position.x).toBeLessThanOrEqual(minX - YEAR_LABEL_W)
  })
  it('spans the width of the graph and sits behind the pills', () => {
    const width = Math.max(...layout.nodes.map(n => n.x + NODE_W)) - Math.min(...layout.nodes.map(n => n.x))
    for (const n of years) {
      expect(n.data.width).toBeGreaterThanOrEqual(width)
      expect(n.zIndex).toBe(-1)
      expect(n.selectable).toBe(false)
    }
  })
  it('has nothing to label in an empty lin', () => {
    expect(buildYearNodes({ people: [], links: [] }, { nodes: [] })).toEqual([])
  })
})
