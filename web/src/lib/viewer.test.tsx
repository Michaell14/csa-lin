import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

type Listener = (event: string, session: { access_token: string } | null) => void
const fake = vi.hoisted(() => ({
  token: 'tok-1',
  listeners: [] as Listener[],
  rpc: vi.fn(),
  count: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: fake.token } } }),
      onAuthStateChange: (cb: Listener) => { fake.listeners.push(cb); return { data: { subscription: { unsubscribe: () => {} } } } },
      signOut: async () => {},
    },
    rpc: fake.rpc,
    from: () => ({ select: () => ({ eq: () => ({ or: () => ({ neq: fake.count }) }) }) }),
  }),
}))
vi.mock('@/lib/jwt', () => ({
  readViewerClaims: (t: string | null | undefined) => (t ? { personId: 'p1', email: 'a@upenn.edu', sub: 'u1' } : { personId: null, email: null, sub: null }),
}))

import { ViewerProvider, useViewer } from '@/lib/viewer'

const wrapper = ({ children }: { children: ReactNode }) => <ViewerProvider>{children}</ViewerProvider>

describe('ViewerProvider', () => {
  beforeEach(() => {
    fake.listeners.length = 0
    fake.token = 'tok-1'
    fake.rpc.mockReset()
    fake.count.mockReset()
    fake.count.mockResolvedValue({ count: 2, error: null })
  })

  it('reports admin status and pending count on the happy path', async () => {
    fake.rpc.mockResolvedValue({ data: true, error: null })
    const { result } = renderHook(() => useViewer(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.pendingCount).toBe(2)
    expect(result.current.personId).toBe('p1')
  })

  it('does not demote an admin on a transient RPC failure; retries instead', async () => {
    fake.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'aborted' } })
      .mockResolvedValue({ data: true, error: null })
    const { result } = renderHook(() => useViewer(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 })
    expect(result.current.isAdmin).toBe(true)
    expect(fake.rpc).toHaveBeenCalledTimes(2)
  })

  it('ignores auth events that carry the same token', async () => {
    fake.rpc.mockResolvedValue({ data: false, error: null })
    const { result } = renderHook(() => useViewer(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const calls = fake.rpc.mock.calls.length
    await act(async () => { for (const l of fake.listeners) l('SIGNED_IN', { access_token: 'tok-1' }); await new Promise(r => setTimeout(r, 50)) })
    expect(fake.rpc.mock.calls.length).toBe(calls)
  })

  it('refreshes when the token changes', async () => {
    fake.rpc.mockResolvedValue({ data: false, error: null })
    const { result } = renderHook(() => useViewer(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const calls = fake.rpc.mock.calls.length
    fake.token = 'tok-2'
    await act(async () => { for (const l of fake.listeners) l('TOKEN_REFRESHED', { access_token: 'tok-2' }); await new Promise(r => setTimeout(r, 50)) })
    await waitFor(() => expect(fake.rpc.mock.calls.length).toBe(calls + 1))
  })
})
