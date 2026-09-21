// Where to send someone after they sign in. The middleware records the page a
// signed-out visitor asked for, the login page carries it through the OAuth
// round trip, and the callback sends them there. Anything that is not a path
// on this site (an absolute URL, a protocol-relative `//host`, or a
// backslash variant browsers normalise to one) falls back to the home page,
// as do the sign-in pages themselves, which would only loop.
export const RETURN_PARAM = 'next'

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) return '/'
  if (/^\/[\/\\]/.test(value)) return '/'
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/') || value.startsWith('/auth/')) return '/'
  return value
}

// The path and query of a location, as the value `safeReturnPath` accepts.
export function returnPathFor(pathname: string, search: string): string | null {
  const path = `${pathname}${search}`
  return path === '/' ? null : path
}

// `/login?next=...` for a page worth coming back to, else plain `/login`.
export function loginUrlFor(pathname: string, search: string): string {
  const back = returnPathFor(pathname, search)
  return back ? `/login?${RETURN_PARAM}=${encodeURIComponent(back)}` : '/login'
}

// The callback URL for a sign-in, carrying the page to return to afterwards.
export function callbackUrl(origin: string, back: string): string {
  return back === '/' ? `${origin}/auth/callback` : `${origin}/auth/callback?${RETURN_PARAM}=${encodeURIComponent(back)}`
}
