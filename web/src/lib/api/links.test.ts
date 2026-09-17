import { describe, it, expect } from 'vitest'
import { splitLinks } from '@/lib/api/links'
import type { Link } from '@/lib/types'

const me = 'me', a = 'a', b = 'b', c = 'c'
const L = (id: string, big: string, little: string, status: 'pending' | 'confirmed', proposed_by: string | null): Link => ({
  id, big_id: big, little_id: little, status, proposed_by, confirmed_by: null, confirmed_at: null, created_at: '2026-01-01T00:00:00Z',
})

describe('splitLinks', () => {
  const links = [
    L('1', a, me, 'confirmed', null),      // a is my big
    L('2', me, b, 'confirmed', null),      // b is my little
    L('3', c, me, 'pending', c),           // c proposed to be my big -> incoming
    L('4', me, a, 'pending', me),          // I proposed a as my little -> outgoing
  ]
  it('sorts links into the four buckets', () => {
    const s = splitLinks(links, me)
    expect(s.confirmedBigs.map(l => l.id)).toEqual(['1'])
    expect(s.confirmedLittles.map(l => l.id)).toEqual(['2'])
    expect(s.incoming.map(l => l.id)).toEqual(['3'])
    expect(s.outgoing.map(l => l.id)).toEqual(['4'])
  })
})
