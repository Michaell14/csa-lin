import { describe, expect, it } from 'vitest'
import type { LinGraph } from '@/lib/types'
import { relationshipSummary, shortestRelationshipPath } from '@/lib/graph/relationship'

const person = (id: string) => ({ id, display_name: id, grad_year: 2025, is_founder: id === 'a', placeholder: false, photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, claimed: true })
const graph: LinGraph = {
  people: ['a', 'b', 'c', 'd', 'e'].map(person),
  links: [
    { id: 'ab', big_id: 'a', little_id: 'b', academic_year: null },
    { id: 'bc', big_id: 'b', little_id: 'c', academic_year: null },
    { id: 'ad', big_id: 'a', little_id: 'd', academic_year: null },
    { id: 'de', big_id: 'd', little_id: 'e', academic_year: null },
  ],
}

describe('shortestRelationshipPath', () => {
  it('finds a shortest path across ancestors and descendants', () => {
    expect(shortestRelationshipPath(graph, 'c', 'e')).toEqual({ personIds: ['c', 'b', 'a', 'd', 'e'], linkIds: ['bc', 'ab', 'ad', 'de'] })
  })

  it('returns null for self, absent, or disconnected people', () => {
    expect(shortestRelationshipPath(graph, 'a', 'a')).toBeNull()
    expect(shortestRelationshipPath(graph, 'a', 'missing')).toBeNull()
  })

  it('describes direct and generational relationships', () => {
    const big = shortestRelationshipPath(graph, 'c', 'b')!
    expect(relationshipSummary(graph, big)).toBe('Your big')
    expect(relationshipSummary(graph, shortestRelationshipPath(graph, 'c', 'a')!)).toBe('2 generations above you')
    expect(relationshipSummary(graph, shortestRelationshipPath(graph, 'c', 'e')!)).toBe('4 family links away')
  })
})
