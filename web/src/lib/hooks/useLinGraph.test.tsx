import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LinGraph } from '@/lib/types'

const api = vi.hoisted(() => ({ fetchLinGraph: vi.fn(), signedPhotoUrls: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/graph', () => ({ fetchLinGraph: api.fetchLinGraph }))
vi.mock('@/lib/api/photos', () => ({ signedPhotoUrls: api.signedPhotoUrls }))

import { useLinGraph } from '@/lib/hooks/useLinGraph'

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const graphOf = (name: string): LinGraph => ({ people: [{ id: name, display_name: name, grad_year: 2024, is_founder: true, placeholder: false, photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, claimed: true }], links: [] })

describe('useLinGraph', () => {
  beforeEach(() => { api.signedPhotoUrls.mockResolvedValue(new Map()) })

  it('ignores a slow response for a lin that is no longer selected', async () => {
    const a = deferred<LinGraph>(), b = deferred<LinGraph>()
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => (id === 'a' ? a.promise : b.promise))
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id), { initialProps: { id: 'a' as string | null } })
    rerender({ id: 'b' })
    await act(async () => { b.resolve(graphOf('b')) })
    await waitFor(() => expect(result.current.graph.people[0]?.id).toBe('b'))
    await act(async () => { a.resolve(graphOf('a')) })
    expect(result.current.graph.people[0]?.id).toBe('b')
    expect(result.current.loading).toBe(false)
  })

  it('reports which lin the people on screen belong to', async () => {
    const b = deferred<LinGraph>()
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => (id === 'a' ? Promise.resolve(graphOf('a')) : b.promise))
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id), { initialProps: { id: 'a' as string | null } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))

    // Selecting another lin leaves the previous people on screen while it loads,
    // so `loadedLin` must stop matching until the new graph arrives.
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.graph.people[0]?.id).toBe('a')
    expect(result.current.loadedLin).toBe('a')

    await act(async () => { b.resolve(graphOf('b')) })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
  })

  it('clears to an empty graph when the lin is null and surfaces errors verbatim', async () => {
    api.fetchLinGraph.mockRejectedValue({ message: 'permission denied for function lin_graph' })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id), { initialProps: { id: 'x' as string | null } })
    await waitFor(() => expect(result.current.error).toBe('permission denied for function lin_graph'))
    rerender({ id: null })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.graph.people).toHaveLength(0)
    expect(result.current.loadedLin).toBeNull()
  })
})
