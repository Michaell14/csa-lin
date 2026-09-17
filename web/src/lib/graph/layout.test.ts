import { describe, it, expect } from 'vitest'
import { layoutLin, NODE_H, NODE_W } from '@/lib/graph/layout'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

describe('layoutLin', () => {
  const { nodes, rows } = layoutLin(linAGraph)
  const pos = new Map(nodes.map(n => [n.id, n]))

  it('positions every person exactly once', () => {
    expect(nodes.map(n => n.id).sort()).toEqual(linAGraph.people.map(p => p.id).sort())
  })
  it('lists connection generations as rows', () => {
    expect(rows).toEqual([0, 1, 2, 3])
  })
  it('puts siblings in the same generation', () => {
    expect(pos.get(ID.big1)!.y).toBe(pos.get(ID.big2)!.y)
    expect(pos.get(ID.child1)!.y).toBe(pos.get(ID.child2)!.y)
  })
  it('places each row strictly below the previous', () => {
    const ys = [ID.founder, ID.big1, ID.child1, ID.shared].map(id => pos.get(id)!.y)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(NODE_H)
  })
  it('gives every node finite coordinates', () => {
    for (const n of nodes) { expect(Number.isFinite(n.x)).toBe(true); expect(Number.isFinite(n.y)).toBe(true) }
  })
  it('handles a placeholder founder and an empty graph', () => {
    expect(layoutLin(hiddenFounderGraph).nodes).toHaveLength(2)
    expect(layoutLin({ people: [], links: [] })).toEqual({ nodes: [], rows: [] })
  })
  it('puts a little below their big even when they share a grad year', () => {
    const sameYear = {
      people: [
        { ...linAGraph.people[0], id: 'a', grad_year: 2022 },
        { ...linAGraph.people[0], id: 'b', grad_year: 2022 },
      ],
      links: [{ id: 'ab', big_id: 'a', little_id: 'b' }],
    }
    const { nodes } = layoutLin(sameYear)
    const [a, b] = ['a', 'b'].map(id => nodes.find(n => n.id === id)!)
    expect(b.y - a.y).toBe(NODE_H + 80)
  })
  it('puts littles from different class years immediately below the same big', () => {
    const graph = {
      people: [
        { ...linAGraph.people[0], id: 'big', grad_year: 2027 },
        { ...linAGraph.people[0], id: 'little-28', grad_year: 2028 },
        { ...linAGraph.people[0], id: 'little-29', grad_year: 2029 },
      ],
      links: [
        { id: 'a', big_id: 'big', little_id: 'little-28' },
        { id: 'b', big_id: 'big', little_id: 'little-29' },
      ],
    }
    const { nodes, rows } = layoutLin(graph)
    const byId = new Map(nodes.map(node => [node.id, node]))
    expect(rows).toEqual([0, 1])
    expect(byId.get('little-28')!.y).toBe(byId.get('little-29')!.y)
    expect(byId.get('little-28')!.y - byId.get('big')!.y).toBe(NODE_H + 80)
    expect(Math.abs(byId.get('little-28')!.x - byId.get('little-29')!.x)).toBeGreaterThanOrEqual(NODE_W)
  })
  it('places a shared little below both bigs even when their paths have different depths', () => {
    const graph = {
      people: [
        { ...linAGraph.people[0], id: 'root' },
        { ...linAGraph.people[0], id: 'first' },
        { ...linAGraph.people[0], id: 'second' },
        { ...linAGraph.people[0], id: 'shared' },
      ],
      links: [
        { id: 'a', big_id: 'root', little_id: 'first' },
        { id: 'b', big_id: 'first', little_id: 'second' },
        { id: 'c', big_id: 'root', little_id: 'shared' },
        { id: 'd', big_id: 'second', little_id: 'shared' },
      ],
    }
    const byId = new Map(layoutLin(graph).nodes.map(node => [node.id, node]))
    expect(byId.get('shared')!.y).toBeGreaterThan(byId.get('root')!.y)
    expect(byId.get('shared')!.y - byId.get('second')!.y).toBe(NODE_H + 80)
  })
})
