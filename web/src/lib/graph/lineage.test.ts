import { describe, it, expect } from 'vitest'
import { lineageOf } from '@/lib/graph/lineage'
import { linAGraph, ID } from '@/lib/testFixtures'

describe('lineageOf', () => {
  it('walks up through bigs and down through littles', () => {
    const { people, links } = lineageOf(linAGraph, ID.child1)
    expect([...people].sort()).toEqual([ID.founder, ID.big1, ID.child1, ID.shared].sort())
    expect([...links].sort()).toEqual(['l1', 'l3', 'l5'])
  })
  it('leaves siblings and their lines out', () => {
    const { people, links } = lineageOf(linAGraph, ID.child1)
    expect(people.has(ID.big2)).toBe(false)
    expect(people.has(ID.child2)).toBe(false)
    expect(links.has('l2')).toBe(false)
    expect(links.has('l4')).toBe(false)
  })
  it('covers the whole tree from the founder', () => {
    const { people, links } = lineageOf(linAGraph, ID.founder)
    expect(people.size).toBe(linAGraph.people.length)
    expect(links.size).toBe(linAGraph.links.length)
  })
  it('is empty with no selection or an unknown person', () => {
    expect(lineageOf(linAGraph, null).people.size).toBe(0)
    expect(lineageOf(linAGraph, 'nobody').people.size).toBe(0)
  })
  it('terminates on a cycle', () => {
    const cyclic = {
      people: linAGraph.people.slice(0, 2),
      links: [
        { id: 'a', big_id: ID.founder, little_id: ID.big1, academic_year: null },
        { id: 'b', big_id: ID.big1, little_id: ID.founder, academic_year: null },
      ],
    }
    expect(lineageOf(cyclic, ID.founder).people.size).toBe(2)
  })
})
