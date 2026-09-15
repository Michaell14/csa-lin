import { describe, it, expect, vi } from 'vitest'
import { updateLin } from '@/lib/api/lins'
import type { Supabase } from '@/lib/supabase/client'

const LIN = 'aaaaaaaa-0000-4000-8000-000000000001'

function fakeClient(result: { data: { id: string }[] | null; error: Error | null }) {
  const update = vi.fn((patch: unknown) => ({ eq: (column: string, value: string) => ({ select: async () => { calls.push({ patch, column, value }); return result } }) }))
  const calls: { patch: unknown; column: string; value: string }[] = []
  const sb = { from: (table: string) => { tables.push(table); return { update } } } as unknown as Supabase
  const tables: string[] = []
  return { sb, calls, tables }
}

describe('updateLin', () => {
  it('sends only the name and colour for the one lin', async () => {
    const { sb, calls, tables } = fakeClient({ data: [{ id: LIN }], error: null })
    await updateLin(sb, LIN, { name: 'Dragons', color: '#123abc' })
    expect(tables).toEqual(['lins'])
    expect(calls).toEqual([{ patch: { name: 'Dragons', color: '#123abc' }, column: 'id', value: LIN }])
  })

  it('reports an update that reached no row as a refusal', async () => {
    const { sb } = fakeClient({ data: [], error: null })
    await expect(updateLin(sb, LIN, { name: 'Dragons' })).rejects.toThrow(/founder/)
  })

  it('passes a database error through', async () => {
    const { sb } = fakeClient({ data: null, error: new Error('duplicate key value violates unique constraint "lins_name_key"') })
    await expect(updateLin(sb, LIN, { name: 'Dragons' })).rejects.toThrow(/lins_name_key/)
  })

  it('refuses an id that is not a uuid before touching the network', async () => {
    const { sb, calls } = fakeClient({ data: [{ id: LIN }], error: null })
    await expect(updateLin(sb, 'not-a-uuid', { name: 'Dragons' })).rejects.toThrow()
    expect(calls).toEqual([])
  })
})
