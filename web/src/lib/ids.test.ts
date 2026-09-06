import { describe, it, expect } from 'vitest'
import { assertUuid, isUuid } from '@/lib/ids'

describe('ids', () => {
  it('accepts uuids in either case', () => {
    expect(isUuid('10000000-0000-0000-0000-000000000001')).toBe(true)
    expect(isUuid('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true)
  })
  it('rejects filter injection and junk', () => {
    expect(isUuid('10000000-0000-0000-0000-000000000001,proposed_by.not.is.null')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(() => assertUuid('nope', 'person id')).toThrow('Invalid person id')
  })
})
