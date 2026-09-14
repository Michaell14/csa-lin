import { describe, it, expect, vi } from 'vitest'
import { resolveCorrection } from '@/lib/api/corrections'
import type { Supabase } from '@/lib/supabase/client'

const ID = 'cccccccc-0000-4000-8000-000000000001'
const ADMIN = 'aaaaaaaa-0000-4000-8000-000000000001'

/** Records the predicate the update is filtered by, and replays `rows` as the result. */
function fakeClient(rows: { id: string }[]) {
  const filters: string[] = []
  const update = vi.fn((patch: Record<string, unknown>) => {
    const chain = {
      eq: (column: string, value: string) => { filters.push(`${column}=${value}`); return chain },
      select: async () => ({ data: rows, error: null }),
    }
    return Object.assign(chain, { patch })
  })
  const sb = { from: () => ({ update }) } as unknown as Supabase
  return { sb, filters, update }
}

describe('resolveCorrection', () => {
  it('only decides a report that is still pending', async () => {
    const { sb, filters, update } = fakeClient([{ id: ID }])
    await resolveCorrection(sb, ID, 'resolved', ADMIN)
    expect(filters).toEqual([`id=${ID}`, 'status=pending'])
    expect(update.mock.calls[0][0]).toMatchObject({ status: 'resolved', resolved_by: ADMIN })
  })

  it('reports a decision another admin already recorded instead of appearing to succeed', async () => {
    const { sb } = fakeClient([])
    await expect(resolveCorrection(sb, ID, 'dismissed', ADMIN)).rejects.toThrow(/already decided/)
  })
})
