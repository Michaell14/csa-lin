import { describe, it, expect } from 'vitest'
import { layoutLin } from '@/lib/graph/layout'
import { buildFlowElements, edgeSides } from '@/lib/graph/flow'
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
  it('leaves the big from the bottom and enters the little from the top when the little is below', () => {
    const e = edges.find(e => e.id === 'l5')!
    expect(e.sourceHandle).toBe('s-bottom')
    expect(e.targetHandle).toBe('t-top')
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
})

describe('edgeSides', () => {
  it('points down when the little is on a lower row', () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 50, y: 120 })).toEqual({ source: 'bottom', target: 'top' })
  })
  it('points up when a younger-year big sits below their little', () => {
    expect(edgeSides({ x: 0, y: 120 }, { x: 0, y: 0 })).toEqual({ source: 'top', target: 'bottom' })
  })
  it('runs sideways between pills on the same row', () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 212, y: 0 })).toEqual({ source: 'right', target: 'left' })
    expect(edgeSides({ x: 212, y: 0 }, { x: 0, y: 0 })).toEqual({ source: 'left', target: 'right' })
  })
})
