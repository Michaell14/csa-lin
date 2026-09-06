import { describe, it, expect } from 'vitest'
import { yearColor } from '@/lib/graph/colors'

describe('yearColor', () => {
  it('is deterministic and hex', () => {
    expect(yearColor(2024)).toBe(yearColor(2024))
    expect(yearColor(2024)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('differs for adjacent years', () => {
    expect(yearColor(2024)).not.toBe(yearColor(2025))
  })
})
