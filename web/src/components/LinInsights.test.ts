import { describe, expect, it } from 'vitest'
import { linStats } from '@/components/LinInsights'
import type { LinGraph } from '@/lib/types'

describe('linStats', () => {
  it('summarizes students, alumni, claims, and class years', () => {
    const people = [{ id: 'a', grad_year: 2024, claimed: true }, { id: 'b', grad_year: 2026, claimed: false }, { id: 'c', grad_year: 2027, claimed: true }].map(p => ({ ...p, display_name: p.id, is_founder: p.id === 'a', placeholder: false, photo_path: null, major: null, hometown: null, bio: null, instagram: null }))
    expect(linStats({ people, links: [] } satisfies LinGraph, new Date(2026, 8, 1))).toEqual({ members: 3, alumni: 2, students: 1, claimed: 2, years: [[2024, 1], [2026, 1], [2027, 1]] })
  })
})
