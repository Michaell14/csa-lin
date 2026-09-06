import { describe, it, expect } from 'vitest'
import { errorMessage } from '@/lib/errors'

describe('errorMessage', () => {
  it('uses a Supabase error message verbatim', () => {
    expect(errorMessage({ message: 'link would create a cycle', code: '23514' })).toBe('link would create a cycle')
  })
  it('uses Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })
  it('falls back for unknown shapes', () => {
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })
})
