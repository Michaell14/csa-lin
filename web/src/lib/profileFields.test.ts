import { describe, it, expect } from 'vitest'
import { instagramUrl, normalizeInstagram, normalizeLinkedin, safeLinkedinUrl, validateProfileFields } from '@/lib/profileFields'

describe('normalizeInstagram', () => {
  it('strips @ and whitespace', () => expect(normalizeInstagram('  @some.one_ ')).toBe('some.one_'))
  it('returns null for empty', () => expect(normalizeInstagram(' @ ')).toBeNull())
})

describe('normalizeLinkedin', () => {
  it('adds https to a bare address', () => expect(normalizeLinkedin('www.linkedin.com/in/x')).toBe('https://www.linkedin.com/in/x'))
  it('upgrades http', () => expect(normalizeLinkedin('http://linkedin.com/in/x')).toBe('https://linkedin.com/in/x'))
  it('leaves other strings for validation to reject', () => expect(normalizeLinkedin('javascript:alert(1)')).toBe('javascript:alert(1)'))
  it('returns null for empty', () => expect(normalizeLinkedin('  ')).toBeNull())
})

describe('instagramUrl', () => {
  it('links a valid handle', () => expect(instagramUrl('dz')).toBe('https://instagram.com/dz'))
  it('tolerates a stored leading @', () => expect(instagramUrl('@dz')).toBe('https://instagram.com/dz'))
  it('refuses path-like handles', () => expect(instagramUrl('../evil?x')).toBeNull())
  it('refuses null', () => expect(instagramUrl(null)).toBeNull())
})

describe('safeLinkedinUrl', () => {
  it('accepts https linkedin.com', () => expect(safeLinkedinUrl('https://linkedin.com/in/dz')).toBe('https://linkedin.com/in/dz'))
  it('accepts regional subdomains', () => expect(safeLinkedinUrl('https://uk.linkedin.com/in/dz')).toBe('https://uk.linkedin.com/in/dz'))
  it('refuses javascript:', () => expect(safeLinkedinUrl('javascript:alert(1)')).toBeNull())
  it('refuses http', () => expect(safeLinkedinUrl('http://linkedin.com/in/dz')).toBeNull())
  it('refuses lookalike hosts', () => expect(safeLinkedinUrl('https://linkedin.com.evil.io/in/dz')).toBeNull())
  it('refuses embedded quotes', () => expect(safeLinkedinUrl('https://linkedin.com/in/dz" onclick="x')).toBeNull())
})

describe('validateProfileFields', () => {
  it('passes normal values', () => {
    expect(validateProfileFields({ display_name: 'Derek', bio: 'hi', instagram: 'dz', linkedin: 'https://linkedin.com/in/dz' })).toBeNull()
  })
  it('passes nulls', () => expect(validateProfileFields({ instagram: null, linkedin: null })).toBeNull())
  it('rejects a long bio', () => expect(validateProfileFields({ bio: 'x'.repeat(1001) })).toMatch(/Bio/))
  it('rejects retained fields over their database limits', () => {
    expect(validateProfileFields({ major: 'x'.repeat(101) })).toMatch(/Major/)
    expect(validateProfileFields({ hometown: 'x'.repeat(101) })).toMatch(/Hometown/)
  })
  it('rejects a bad handle', () => expect(validateProfileFields({ instagram: 'a b' })).toMatch(/Instagram/))
  it('rejects a bad linkedin', () => expect(validateProfileFields({ linkedin: 'https://example.com' })).toMatch(/LinkedIn/))
})
