import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { PALETTE, yearColor } from '@/lib/graph/colors'

describe('yearColor', () => {
  it('is deterministic and hex', () => {
    expect(yearColor(2024)).toBe(yearColor(2024))
    expect(yearColor(2024)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('differs for adjacent years', () => {
    expect(yearColor(2024)).not.toBe(yearColor(2025))
  })
})

describe('PALETTE', () => {
  it('matches the palette the database deals to new lins', () => {
    const migration = readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/20260915000001_member_lins.sql'), 'utf8')
    const sql = migration.match(/function public\.lin_palette\(\)[\s\S]*?select array\[([^\]]*)\]/)?.[1]
    expect(sql).toBeDefined()
    const dealt = [...sql!.matchAll(/'(#[0-9a-f]{6})'/g)].map(m => m[1])
    expect(dealt).toEqual(PALETTE)
  })
})
