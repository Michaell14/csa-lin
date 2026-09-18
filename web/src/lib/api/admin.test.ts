import { describe, it, expect, vi } from 'vitest'
import { listAdmins } from '@/lib/api/admin'
import type { Supabase } from '@/lib/supabase/client'

const PERSON_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

describe('listAdmins', () => {
  it('embeds only the people columns the table grants to signed-in users', async () => {
    const rows = [
      { granted_at: '2026-09-01T00:00:00Z', person: { id: PERSON_ID, display_name: 'Alice', grad_year: 2026 } },
      { granted_at: '2026-09-02T00:00:00Z', person: null },
    ]
    const select = vi.fn(() => ({ order: async () => ({ data: rows, error: null }) }))
    const from = vi.fn(() => ({ select }))
    const sb = { from } as unknown as Supabase

    const admins = await listAdmins(sb)

    expect(from).toHaveBeenCalledWith('admins')
    // The embed reads public.people itself, where authenticated holds a
    // column-list grant that stops at these three; naming a profile column
    // there fails the request with "permission denied for table people".
    expect(select).toHaveBeenCalledWith('granted_at, person:people!admins_person_id_fkey(id, display_name, grad_year)')
    expect(admins).toEqual([{ person: { id: PERSON_ID, display_name: 'Alice', grad_year: 2026 }, granted_at: '2026-09-01T00:00:00Z' }])
  })
})
