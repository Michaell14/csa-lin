import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Person } from '@/lib/types'

const api = vi.hoisted(() => ({
  fetchPerson: vi.fn(),
  fetchPeopleByIds: vi.fn(),
  fetchLinksFor: vi.fn(),
  fetchLinsOf: vi.fn(),
  signedPhotoUrls: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/people', () => ({ fetchPerson: api.fetchPerson, fetchPeopleByIds: api.fetchPeopleByIds }))
vi.mock('@/lib/api/links', async importOriginal => ({ ...(await importOriginal<object>()), fetchLinksFor: api.fetchLinksFor }))
vi.mock('@/lib/api/lins', () => ({ fetchLinsOf: api.fetchLinsOf }))
vi.mock('@/lib/api/photos', () => ({ signedPhotoUrls: api.signedPhotoUrls }))

import { usePersonDetails } from '@/lib/hooks/usePersonDetails'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
const person = (id: string, name: string) => ({ id, display_name: name, grad_year: 2024, photo_path: null }) as unknown as Person

describe('usePersonDetails', () => {
  beforeEach(() => {
    api.fetchPeopleByIds.mockResolvedValue([])
    api.fetchLinksFor.mockResolvedValue([])
    api.fetchLinsOf.mockResolvedValue([])
    api.signedPhotoUrls.mockResolvedValue(new Map())
  })

  it('ignores a slow response for a person who is no longer selected', async () => {
    const a = deferred<Person | null>()
    const b = deferred<Person | null>()
    api.fetchPerson.mockImplementation((_sb: unknown, id: string) => (id === 'a' ? a.promise : b.promise))
    const { result, rerender } = renderHook(({ id }) => usePersonDetails(id), { initialProps: { id: 'a' } })
    rerender({ id: 'b' })
    await act(async () => { b.resolve(person('b', 'Bee')) })
    await waitFor(() => expect(result.current.person?.display_name).toBe('Bee'))
    await act(async () => { a.resolve(person('a', 'Ay')) })
    expect(result.current.person?.display_name).toBe('Bee')
    expect(result.current.loading).toBe(false)
  })

  it('clears the previous person while a new one loads', async () => {
    const b = deferred<Person | null>()
    api.fetchPerson.mockImplementation((_sb: unknown, id: string) => (id === 'a' ? Promise.resolve(person('a', 'Ay')) : b.promise))
    const { result, rerender } = renderHook(({ id }) => usePersonDetails(id), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.person?.display_name).toBe('Ay'))
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.person).toBeNull())
    expect(result.current.loading).toBe(true)
    await act(async () => { b.resolve(person('b', 'Bee')) })
    await waitFor(() => expect(result.current.person?.display_name).toBe('Bee'))
  })

  it('surfaces an error verbatim and stops loading', async () => {
    api.fetchPerson.mockRejectedValue({ message: 'permission denied for table people' })
    const { result } = renderHook(() => usePersonDetails('z'))
    await waitFor(() => expect(result.current.error).toBe('permission denied for table people'))
    expect(result.current.loading).toBe(false)
  })

  it('never exposes one person under another person’s id', async () => {
    // Every render is recorded, not just the settled one: an account can change
    // without the page remounting, and the render before the hook's effect runs
    // is the one that could pair old details with the new id.
    const seen: Array<{ asked: string; got: string | null }> = []
    api.fetchPerson.mockImplementation(async (_sb: unknown, id: string) => person(id, id === 'a' ? 'Ay' : 'Bee'))
    const { rerender } = renderHook(({ id }) => {
      const d = usePersonDetails(id, true)
      seen.push({ asked: id, got: d.person?.id ?? null })
      return d
    }, { initialProps: { id: 'a' } })

    await waitFor(() => expect(seen.at(-1)?.got).toBe('a'))
    rerender({ id: 'b' })
    await waitFor(() => expect(seen.at(-1)?.got).toBe('b'))

    expect(seen.filter(s => s.got !== null && s.got !== s.asked)).toEqual([])
  })

  it('fetches nothing and does not load when disabled', async () => {
    api.fetchPerson.mockResolvedValue(person('a', 'Ay'))
    api.fetchPerson.mockClear()
    const { result } = renderHook(() => usePersonDetails('a', true, false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.person).toBeNull()
    expect(api.fetchPerson).not.toHaveBeenCalled()
  })
})
