import { describe, expect, it, vi } from 'vitest'
import { insertPeopleNonBlocking } from '@/lib/api/admin'
import type { NewPerson } from '@/lib/csv'
import type { Supabase } from '@/lib/supabase/client'

const person = (name: string, email: string, year = 2028): NewPerson =>
  ({ display_name: name, penn_email: email, grad_year: year })

describe('insertPeopleNonBlocking', () => {
  it('adds valid rows even when a batch contains an existing email and a bad row', async () => {
    const existing = new Set(['existing@upenn.edu'])
    const inserted: string[] = []
    const insert = vi.fn(async (batch: NewPerson[]) => {
      const duplicate = batch.find(row => row.penn_email && existing.has(row.penn_email))
      if (duplicate) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "people_penn_email_key"' } }
      if (batch.some(row => row.grad_year > 2200)) return { error: { code: '23514', message: 'grad year outside allowed range' } }
      for (const row of batch) { inserted.push(row.display_name); if (row.penn_email) existing.add(row.penn_email) }
      return { error: null }
    })
    const sb = { from: vi.fn(() => ({ insert })) } as unknown as Supabase
    const result = await insertPeopleNonBlocking(sb, [
      person('Alice', 'alice@upenn.edu'), person('Already Here', 'existing@upenn.edu'),
      person('Cara', 'cara@upenn.edu'), person('Bad Year', 'bad@upenn.edu', 2201),
    ])

    expect(inserted).toEqual(['Alice', 'Cara'])
    expect(result).toEqual({
      added: 2,
      duplicates: [person('Already Here', 'existing@upenn.edu')],
      failed: [{ person: person('Bad Year', 'bad@upenn.edu', 2201), reason: 'grad year outside allowed range' }],
    })
  })

  it('reports a repeated email within the pasted rows without discarding other people', async () => {
    const inserted = new Set<string>()
    const insert = vi.fn(async (batch: NewPerson[]) => {
      const emails = batch.map(row => row.penn_email).filter((email): email is string => email !== null)
      if (emails.some(email => inserted.has(email) || emails.indexOf(email) !== emails.lastIndexOf(email))) {
        return { error: { code: '23505', message: 'duplicate key value violates unique constraint "people_penn_email_canonical_key"' } }
      }
      emails.forEach(email => inserted.add(email))
      return { error: null }
    })
    const sb = { from: vi.fn(() => ({ insert })) } as unknown as Supabase
    const result = await insertPeopleNonBlocking(sb, [person('First', 'same@upenn.edu'), person('Second', 'same@upenn.edu'), person('Third', 'third@upenn.edu')])
    expect(result.added).toBe(2)
    expect(result.duplicates).toEqual([person('Second', 'same@upenn.edu')])
    expect(inserted).toEqual(new Set(['same@upenn.edu', 'third@upenn.edu']))
  })
})
