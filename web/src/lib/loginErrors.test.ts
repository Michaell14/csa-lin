import { describe, expect, it } from 'vitest'
import { LOGIN_ERRORS, loginErrorMessage } from '@/lib/loginErrors'

describe('loginErrorMessage', () => {
  it('turns a known code into its fixed message', () => {
    expect(loginErrorMessage('cancelled')).toBe(LOGIN_ERRORS.cancelled)
    expect(loginErrorMessage('exchange')).toBe(LOGIN_ERRORS.exchange)
  })

  it('never repeats text it does not recognise', () => {
    expect(loginErrorMessage('<b>Your account was suspended</b>')).toBe(LOGIN_ERRORS.failed)
    expect(loginErrorMessage('constructor')).toBe(LOGIN_ERRORS.failed)
  })

  it('is silent without a code', () => {
    expect(loginErrorMessage(null)).toBeNull()
    expect(loginErrorMessage('')).toBeNull()
  })
})
