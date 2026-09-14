import { describe, expect, it } from 'vitest'
import { academicYearTimeline, linStats } from '@/components/LinInsights'
import type { LinGraph } from '@/lib/types'

describe('linStats', () => {
  it('summarizes students, alumni, claims, and class years', () => {
    const people = [{ id: 'a', grad_year: 2024, claimed: true }, { id: 'b', grad_year: 2027, claimed: false }, { id: 'c', grad_year: 2027, claimed: true }].map(p => ({ ...p, display_name: p.id, is_founder: p.id === 'a', placeholder: false, photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null }))
    expect(linStats({ people, links: [] } satisfies LinGraph, 2026)).toEqual({ members: 3, alumni: 1, students: 2, claimed: 2, years: [[2024, 1], [2027, 2]] })
  })
  it('normalizes equivalent academic-year spans and sorts chronologically', () => {
    const links = [
      { id: '1', big_id: 'a', little_id: 'b', academic_year: '2024-25' },
      { id: '2', big_id: 'a', little_id: 'c', academic_year: '2024-2025' },
      { id: '3', big_id: 'b', little_id: 'c', academic_year: 'Fall 2024' },
      { id: '4', big_id: 'c', little_id: 'd', academic_year: '2025-26' },
      { id: '5', big_id: 'd', little_id: 'e', academic_year: '2024-99' },
      { id: '6', big_id: 'e', little_id: 'f', academic_year: '2024-2099' },
    ]
    expect(academicYearTimeline({ people: [], links })).toEqual([
      { label: '2025–2026', sort: 20259, count: 1 },
      { label: '2024–2025', sort: 20249, count: 2 },
      { label: 'Fall 2024', sort: 20244, count: 1 },
      { label: '2024-99', sort: Number.NEGATIVE_INFINITY, count: 1 },
      { label: '2024-2099', sort: Number.NEGATIVE_INFINITY, count: 1 },
    ])
  })
})
