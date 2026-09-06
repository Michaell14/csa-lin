import { describe, it, expect } from 'vitest'
import { layoutLin, NODE_H, NODE_W } from '@/lib/graph/layout'
import { linAGraph, hiddenFounderGraph, ID } from '@/lib/testFixtures'

describe('layoutLin', () => {
  const { nodes, rows } = layoutLin(linAGraph)
  const pos = new Map(nodes.map(n => [n.id, n]))

  it('positions every person exactly once', () => {
    expect(nodes.map(n => n.id).sort()).toEqual(linAGraph.people.map(p => p.id).sort())
  })
  it('lists grad years ascending as rows', () => {
    expect(rows).toEqual([2020, 2021, 2022, 2023])
  })
  it('puts people of the same grad year on the same y', () => {
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
  it('keeps a big and little who share a grad year from overlapping', () => {
    const sameYear = {
      people: [
        { ...linAGraph.people[0], id: 'a', grad_year: 2022 },
        { ...linAGraph.people[0], id: 'b', grad_year: 2022 },
      ],
      links: [{ id: 'ab', big_id: 'a', little_id: 'b', academic_year: null }],
    }
    const { nodes } = layoutLin(sameYear)
    const [a, b] = ['a', 'b'].map(id => nodes.find(n => n.id === id)!)
    expect(a.y).toBe(b.y)
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(NODE_W)
  })
})
