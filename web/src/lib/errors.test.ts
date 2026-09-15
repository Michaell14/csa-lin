import { describe, it, expect } from 'vitest'
import { errorMessage } from '@/lib/errors'

describe('errorMessage', () => {
  it('uses a Supabase error message verbatim', () => {
    expect(errorMessage({ message: 'link would create a cycle', code: '23514' })).toBe('link would create a cycle')
  })
  it('uses Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })
  it('translates a profile check-constraint violation', () => {
    expect(errorMessage({ message: 'new row for relation "people" violates check constraint "people_linkedin_url"', code: '23514' }))
      .toMatch(/LinkedIn must be a link/)
  })
  it('translates the lin name and colour rules', () => {
    expect(errorMessage({ message: 'duplicate key value violates unique constraint "lins_name_key"', code: '23505' }))
      .toBe('A lin with that name already exists')
    expect(errorMessage({ message: 'new row for relation "lins" violates check constraint "lins_color_check"', code: '23514' }))
      .toMatch(/hex color/)
  })
  it('leaves unknown constraints verbatim', () => {
    expect(errorMessage({ message: 'violates check constraint "links_not_self"' })).toBe('violates check constraint "links_not_self"')
  })
  it('falls back for unknown shapes', () => {
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })
})
