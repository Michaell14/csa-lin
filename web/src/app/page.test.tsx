import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LIN_A = '00000000-0000-0000-0000-0000000000aa'
const LIN_B = '00000000-0000-0000-0000-0000000000bb'

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: '' }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'a@upenn.edu', personId: null, isAdmin: false, pendingCount: 0, refresh: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/lib/api/lins', () => ({
  fetchLins: vi.fn(async () => [
    { id: LIN_A, name: 'Wang Lin', color: '#6366f1', founder_id: null },
    { id: LIN_B, name: 'Wu Lin', color: '#14b8a6', founder_id: null },
  ]),
  fetchLinsOf: vi.fn(async () => []),
}))
vi.mock('@/lib/api/people', () => ({ searchPeople: vi.fn(async () => []) }))
vi.mock('@/components/graph/LinGraph', () => ({ LinGraph: () => <div data-testid="lin-graph" /> }))

const graphState = vi.hoisted(() => ({
  graph: { people: [] as { id: string }[], links: [] }, loading: false, error: null as string | null,
  loadedLinId: null as string | null,
}))
vi.mock('@/lib/hooks/useLinGraph', () => ({
  useLinGraph: () => ({ ...graphState, photoUrls: new Map(), reload: vi.fn() }),
}))

import Page from '@/app/page'

const person = { id: 'p1' }

describe('the lin page', () => {
  beforeEach(() => {
    nav.push.mockClear(); nav.replace.mockClear()
    nav.search = `lin=${LIN_A}`
    graphState.graph = { people: [person], links: [] }
    graphState.loading = false
    graphState.error = null
    graphState.loadedLinId = LIN_A
  })

  it('replaces the url when it picks an opening lin, leaving no history entry', async () => {
    nav.search = ''
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/?lin=${LIN_A}`))
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('pushes when someone picks a lin, so back undoes it', async () => {
    render(<Page />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Wu Lin' }))
    expect(nav.push).toHaveBeenCalledWith(`/?lin=${LIN_B}`)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('shows a skeleton on the first load and the old tree on later ones', () => {
    graphState.loading = true
    graphState.graph = { people: [], links: [] }
    graphState.loadedLinId = null
    const { rerender } = render(<Page />)
    expect(screen.getByTestId('graph-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('lin-graph')).toBeNull()

    graphState.graph = { people: [person], links: [] }
    graphState.loadedLinId = LIN_A
    rerender(<Page />)
    expect(screen.queryByTestId('graph-skeleton')).toBeNull()
    expect(screen.getByTestId('lin-graph')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('says so when a lin has nobody on it', async () => {
    graphState.graph = { people: [], links: [] }
    render(<Page />)
    expect(await screen.findByText('Nobody is on this lin yet')).toBeInTheDocument()
    expect(screen.queryByTestId('lin-graph')).toBeNull()
  })

  it('waits for the new lin rather than showing the old one under its name', () => {
    // Mid-switch: lin b is selected and its request is out, but the graph in
    // hand is still lin a's. Showing it would label a's members as b's.
    nav.search = `lin=${LIN_B}`
    graphState.loading = true
    graphState.loadedLinId = LIN_A
    render(<Page />)
    expect(screen.getByTestId('graph-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('lin-graph')).toBeNull()
  })

  it('shows nothing under a lin whose request failed, not the lin before it', async () => {
    nav.search = `lin=${LIN_B}`
    graphState.loading = false
    graphState.loadedLinId = LIN_A
    graphState.error = 'permission denied'
    render(<Page />)
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
    expect(screen.queryByTestId('lin-graph')).toBeNull()
    expect(screen.queryByText('Nobody is on this lin yet')).toBeNull()
  })

  it('floats errors in a dismissible toast instead of shifting the layout', async () => {
    graphState.error = 'permission denied'
    render(<Page />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('permission denied')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces a later failure that happens to read like a dismissed one', async () => {
    graphState.error = 'permission denied'
    const { rerender } = render(<Page />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).toBeNull()

    // The first error clears, then an unrelated request fails with the same text.
    graphState.error = null
    rerender(<Page />)
    graphState.error = 'permission denied'
    rerender(<Page />)
    expect(screen.getByRole('alert')).toHaveTextContent('permission denied')
  })

  it('keeps one error dismissed for as long as it is the error on hand', async () => {
    graphState.error = 'permission denied'
    const { rerender } = render(<Page />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss error' }))
    rerender(<Page />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
