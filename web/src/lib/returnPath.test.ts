import { describe, expect, it } from 'vitest'
import { callbackUrl, loginUrlFor, returnPathFor, safeReturnPath } from '@/lib/returnPath'

describe('safeReturnPath', () => {
  it('keeps a path on this site, query included', () => {
    expect(safeReturnPath('/?lin=abc&person=def')).toBe('/?lin=abc&person=def')
    expect(safeReturnPath('/admin')).toBe('/admin')
  })

  it('falls back to home for anything that could leave the site', () => {
    expect(safeReturnPath('https://evil.example/')).toBe('/')
    expect(safeReturnPath('//evil.example/')).toBe('/')
    expect(safeReturnPath('/\\evil.example/')).toBe('/')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/')
  })

  it('falls back to home for nothing, and for the sign-in pages themselves', () => {
    expect(safeReturnPath(null)).toBe('/')
    expect(safeReturnPath('')).toBe('/')
    expect(safeReturnPath('/login')).toBe('/')
    expect(safeReturnPath('/login?error=x')).toBe('/')
    expect(safeReturnPath('/auth/callback?code=1')).toBe('/')
  })
})

describe('loginUrlFor', () => {
  it('records the page a visitor asked for', () => {
    expect(loginUrlFor('/', '?lin=abc&person=def')).toBe('/login?next=%2F%3Flin%3Dabc%26person%3Ddef')
    expect(loginUrlFor('/admin', '')).toBe('/login?next=%2Fadmin')
  })

  it('leaves the home page implicit', () => {
    expect(loginUrlFor('/', '')).toBe('/login')
    expect(returnPathFor('/', '')).toBeNull()
  })
})

describe('callbackUrl', () => {
  it('carries the return path through the OAuth round trip', () => {
    expect(callbackUrl('https://lins.test', '/?lin=abc')).toBe('https://lins.test/auth/callback?next=%2F%3Flin%3Dabc')
  })

  it('stays plain when there is nowhere special to return to', () => {
    expect(callbackUrl('https://lins.test', '/')).toBe('https://lins.test/auth/callback')
  })
})
