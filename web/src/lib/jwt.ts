export type ViewerClaims = { personId: string | null; email: string | null; sub: string | null }

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function readViewerClaims(token: string | null | undefined): ViewerClaims {
  const p = token ? decodeJwtPayload(token) : null
  const pid = p?.person_id
  return {
    personId: typeof pid === 'string' && pid.length > 0 ? pid : null,
    email: typeof p?.email === 'string' ? p.email : null,
    sub: typeof p?.sub === 'string' ? p.sub : null,
  }
}
