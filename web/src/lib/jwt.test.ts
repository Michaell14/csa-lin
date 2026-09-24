import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, readViewerClaims } from '@/lib/jwt'

function fakeJwt(payload: Record<string, unknown>) {
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.sig`
}

describe('decodeJwtPayload', () => {
  it('decodes a base64url payload', () => {
    expect(decodeJwtPayload(fakeJwt({ a: 1 }))).toEqual({ a: 1 })
  })
  it('returns null for garbage', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload('a.b.c')).toBeNull()
  })
})

describe('readViewerClaims', () => {
  it('reads person_id, email and sub', () => {
    const t = fakeJwt({ person_id: '00000000-0000-0000-0000-000000000001', email: 'a@upenn.edu', sub: 'u1' })
    expect(readViewerClaims(t)).toEqual({ personId: '00000000-0000-0000-0000-000000000001', email: 'a@upenn.edu', sub: 'u1', guest: false })
  })
  it('maps a null person_id claim to null', () => {
    expect(readViewerClaims(fakeJwt({ person_id: null, email: 'v@upenn.edu', sub: 'u2' })).personId).toBeNull()
  })
  it('handles a missing token', () => {
    expect(readViewerClaims(null)).toEqual({ personId: null, email: null, sub: null, guest: false })
  })
  it('reads the guest claim only when it is literally true', () => {
    expect(readViewerClaims(fakeJwt({ person_id: null, email: 'g@example.com', sub: 'u3', guest: true })).guest).toBe(true)
    expect(readViewerClaims(fakeJwt({ person_id: null, email: 'g@example.com', sub: 'u3', guest: 'true' })).guest).toBe(false)
  })
})
