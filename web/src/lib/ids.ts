const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Ids that reach PostgREST filter strings must be uuids; anything else is rejected before a query is built. */
export function assertUuid(value: unknown, what = 'id'): string {
  if (!isUuid(value)) throw new Error(`Invalid ${what}`)
  return value
}
