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
    const { rerender } = render(<Page />)
    expect(screen.getByTestId('graph-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('lin-graph')).toBeNull()

    graphState.graph = { people: [person], links: [] }
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

  it('floats errors in a dismissible toast instead of shifting the layout', async () => {
    graphState.error = 'permission denied'
    render(<Page />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('permission denied')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
