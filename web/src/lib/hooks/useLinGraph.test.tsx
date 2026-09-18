import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LinGraph } from '@/lib/types'

const api = vi.hoisted(() => ({ fetchLinGraph: vi.fn(), signedPhotoUrls: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/graph', () => ({ fetchLinGraph: api.fetchLinGraph }))
vi.mock('@/lib/api/photos', () => ({ signedPhotoUrls: api.signedPhotoUrls }))

import { useLinGraph } from '@/lib/hooks/useLinGraph'

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const graphOf = (name: string): LinGraph => ({ people: [{ id: name, display_name: name, grad_year: 2024, is_founder: true, placeholder: false, photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, claimed: true }], links: [] })

describe('useLinGraph', () => {
  beforeEach(() => { vi.clearAllMocks(); api.signedPhotoUrls.mockResolvedValue(new Map()) })
  afterEach(() => { vi.restoreAllMocks() })

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
    // so the marker has to stop vouching for them until the new graph arrives.
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.graph.people[0]?.id).toBe('a')
    expect(result.current.loadedLin).toBeNull()

    await act(async () => { b.resolve(graphOf('b')) })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
  })

  it('stops vouching for the people on screen while the same lin reloads', async () => {
    const again = deferred<LinGraph>()
    let calls = 0
    api.fetchLinGraph.mockImplementation(() => (++calls === 1 ? Promise.resolve(graphOf('a')) : again.promise))
    const { result } = renderHook(() => useLinGraph('a'))
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))

    // A relationship change reloads the same lin: its people are on screen but
    // no longer known to be current.
    await act(async () => { void result.current.reload() })
    await waitFor(() => expect(result.current.loadedLin).toBeNull())
    expect(result.current.graph.people[0]?.id).toBe('a')

    await act(async () => { again.resolve(graphOf('a')) })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
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

  it('shows the graph before photo signing finishes', async () => {
    const photos = deferred<Map<string, string>>()
    api.fetchLinGraph.mockResolvedValue({ ...graphOf('a'), people: [{ ...graphOf('a').people[0], photo_path: 'a/avatar.jpg' }] })
    api.signedPhotoUrls.mockReturnValue(photos.promise)
    const { result } = renderHook(() => useLinGraph('a', 'account'))
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    expect(result.current.loading).toBe(false)
    expect(result.current.photoUrls.size).toBe(0)
    expect(api.signedPhotoUrls).toHaveBeenCalledWith(expect.anything(), ['a/avatar.jpg'])

    await act(async () => { photos.resolve(new Map([['a/avatar.jpg', 'signed-url']])) })
    expect(result.current.photoUrls.get('a/avatar.jpg')).toBe('signed-url')
  })

  it('reuses a fresh lin within the session and forces a network read after an edit', async () => {
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => Promise.resolve(graphOf(id)))
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    rerender({ id: 'a' })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    expect(api.fetchLinGraph.mock.calls.filter(([, id]) => id === 'a')).toHaveLength(1)

    await act(async () => { await result.current.reload() })
    expect(api.fetchLinGraph.mock.calls.filter(([, id]) => id === 'a')).toHaveLength(2)
  })

  it('shows an aging cached lin immediately while refreshing it in the background', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const updated = deferred<LinGraph>()
    let aReads = 0
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => {
      if (id === 'b') return Promise.resolve(graphOf('b'))
      return ++aReads === 1 ? Promise.resolve(graphOf('a')) : updated.promise
    })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    now.mockReturnValue(32_000)
    rerender({ id: 'a' })
    await waitFor(() => expect(aReads).toBe(2))
    expect(result.current.loadedLin).toBe('a')
    expect(result.current.graph.people[0]?.id).toBe('a')
    expect(result.current.loading).toBe(false)

    await act(async () => { updated.resolve(graphOf('a-updated')) })
    expect(result.current.graph.people[0]?.id).toBe('a-updated')
  })

  it('does not mark a graph cached over five minutes ago as current', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const updated = deferred<LinGraph>()
    let aReads = 0
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => {
      if (id === 'b') return Promise.resolve(graphOf('b'))
      return ++aReads === 1 ? Promise.resolve(graphOf('a')) : updated.promise
    })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    now.mockReturnValue(302_000)
    rerender({ id: 'a' })
    expect(result.current.loadedLin).toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => { updated.resolve(graphOf('a-updated')) })
    expect(result.current.graph.people[0]?.id).toBe('a-updated')
  })

  it('opens a prefetched lin from the cache without a second read', async () => {
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => Promise.resolve(graphOf(id)))
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    act(() => { result.current.prefetch('b'); result.current.prefetch('b') })
    await waitFor(() => expect(api.fetchLinGraph.mock.calls.filter(([, id]) => id === 'b')).toHaveLength(1))
    // Prefetching changes nothing on screen.
    expect(result.current.loadedLin).toBe('a')
    expect(result.current.loading).toBe(false)
    await act(async () => { await Promise.resolve() })
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    expect(result.current.graph.people[0]?.id).toBe('b')
    expect(api.fetchLinGraph.mock.calls.filter(([, id]) => id === 'b')).toHaveLength(1)
  })

  it('joins a prefetch still in flight when its lin is selected', async () => {
    const b = deferred<LinGraph>()
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => (id === 'b' ? b.promise : Promise.resolve(graphOf(id))))
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    act(() => { result.current.prefetch('b') })
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loading).toBe(true))
    await act(async () => { b.resolve(graphOf('b')) })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    expect(api.fetchLinGraph.mock.calls.filter(([, id]) => id === 'b')).toHaveLength(1)
  })

  it('reads normally when a prefetch failed', async () => {
    let bReads = 0
    api.fetchLinGraph.mockImplementation((_sb: unknown, id: string) => {
      if (id === 'b') return ++bReads === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(graphOf('b'))
      return Promise.resolve(graphOf(id))
    })
    const { result, rerender } = renderHook(({ id }) => useLinGraph(id, 'account'), { initialProps: { id: 'a' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    act(() => { result.current.prefetch('b') })
    await waitFor(() => expect(bReads).toBe(1))
    expect(result.current.error).toBeNull()
    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.loadedLin).toBe('b'))
    expect(bReads).toBe(2)
  })

  it('does not use another account’s cached graph', async () => {
    api.fetchLinGraph.mockResolvedValue(graphOf('a'))
    const { result, rerender } = renderHook(({ viewer }) => useLinGraph('a', viewer), { initialProps: { viewer: 'one' } })
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
    rerender({ viewer: 'two' })
    expect(result.current.graph.people).toHaveLength(0)
    await waitFor(() => expect(api.fetchLinGraph).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.loadedLin).toBe('a'))
  })
})
