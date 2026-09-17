import { describe, it, expect } from 'vitest'
import { parseLinGraph } from '@/lib/api/graph'
import { linAGraph } from '@/lib/testFixtures'

describe('parseLinGraph', () => {
  it('accepts a well-formed payload', () => {
    const g = parseLinGraph(JSON.parse(JSON.stringify(linAGraph)))
    expect(g.people).toHaveLength(6)
    expect(g.links).toHaveLength(5)
  })
  it('defaults missing arrays to empty', () => {
    expect(parseLinGraph({})).toEqual({ people: [], links: [] })
    expect(parseLinGraph(null)).toEqual({ people: [], links: [] })
  })
  it('rejects a person without an id', () => {
    expect(() => parseLinGraph({ people: [{ display_name: 'x' }], links: [] })).toThrow(/person/)
  })
  it('drops links whose endpoints are not in people', () => {
    const g = parseLinGraph({ people: linAGraph.people, links: [...linAGraph.links, { id: 'zz', big_id: 'nope', little_id: linAGraph.people[0].id }] })
    expect(g.links.map(l => l.id)).not.toContain('zz')
  })
})
