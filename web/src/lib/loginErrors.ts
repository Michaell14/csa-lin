// A sign-in that fails on the way back from the provider lands on /login with
// a code, never the provider's own words: the query string is anyone's to
// write, and a styled alert repeating it would lend a stranger's text the
// site's voice. The login page turns a known code into a fixed message and
// treats anything else as the general failure.
export const LOGIN_ERRORS = {
  cancelled: 'Sign-in was cancelled before it finished. Try again when you’re ready.',
  exchange: 'Sign-in could not be completed. Try again, and tell a CSA board member if it keeps happening.',
  failed: 'Sign-in failed. Try again.',
} as const

export type LoginErrorCode = keyof typeof LOGIN_ERRORS

export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  // An own-property check, so a code like `constructor` cannot reach the prototype.
  return Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code as LoginErrorCode] : LOGIN_ERRORS.failed
}
