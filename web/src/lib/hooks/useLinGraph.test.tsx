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

  it('drops the previous lin when the newly selected one fails to load', async () => {
    api.fetchLinGraph.mockImplementation(async (_sb: unknown, id: string) => {
      if (id === 'a') return graphOf('a')
      throw { message: 'permission denied for function lin_graph' }
    })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id), { initialProps: { id: 'a' as string | null } })
    await waitFor(() => expect(result.current.graph.people[0]?.id).toBe('a'))

    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.error).toBe('permission denied for function lin_graph'))
    // Lin a's members must not sit under lin b as though they were b's lineage.
    expect(result.current.graph.people).toHaveLength(0)
    expect(result.current.photoUrls.size).toBe(0)
  })

  it('keeps the graph on screen when a refresh of that same lin fails', async () => {
    let calls = 0
    api.fetchLinGraph.mockImplementation(async () => {
      if (++calls === 1) return graphOf('a')
      throw { message: 'network error' }
    })
    const { result } = renderHook(() => useLinGraph('a'))
    await waitFor(() => expect(result.current.graph.people[0]?.id).toBe('a'))

    await act(async () => { await result.current.reload() })
    await waitFor(() => expect(result.current.error).toBe('network error'))
    expect(result.current.graph.people[0]?.id).toBe('a')
  })

  it('clears to an empty graph when the lin is null and surfaces errors verbatim', async () => {
    api.fetchLinGraph.mockRejectedValue({ message: 'permission denied for function lin_graph' })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id), { initialProps: { id: 'x' as string | null } })
    await waitFor(() => expect(result.current.error).toBe('permission denied for function lin_graph'))
    rerender({ id: null })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.graph.people).toHaveLength(0)
  })
})
