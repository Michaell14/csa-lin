import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { Person } from '@/lib/types'

const state = vi.hoisted(() => ({ personId: 'me' as string | null, isAdmin: false }))
vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'a@upenn.edu', personId: state.personId, isAdmin: state.isAdmin, pendingCount: 0, refresh: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
const linkApi = vi.hoisted(() => ({
  pendingRemovalRequests: vi.fn<() => Promise<Map<string, { id: string; requestedBy: string }>>>(),
  withdrawLinkRemoval: vi.fn<() => Promise<void>>(),
}))
vi.mock('@/lib/api/links', () => ({ pendingRemovalRequests: linkApi.pendingRemovalRequests, withdrawLinkRemoval: linkApi.withdrawLinkRemoval }))
const person = (id: string): Person => ({
  id, display_name: 'Derek Zhang', grad_year: 2024, penn_email: null, personal_email: null, auth_user_id: null, personal_auth_user_id: null, claimed_at: '2026-01-01T00:00:00Z',
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null, show_location: true, show_bio_interests: true, show_socials: true, show_professional: true, created_at: '', updated_at: '',
})
const hookCalls = vi.hoisted(() => [] as Array<{ id: string; enabled: boolean }>)
vi.mock('@/lib/hooks/usePersonDetails', () => ({
  usePersonDetails: (id: string, ...rest: [boolean?, boolean?]) => {
    hookCalls.push({ id, enabled: rest[1] ?? true })
    return { person: person(id), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [], photoUrl: null, loading: false, error: null, reload: vi.fn() }
  },
}))

import { SidePanel } from '@/components/panel/SidePanel'

const props = {
  graph: { people: [], links: [] }, photoUrls: new Map<string, string>(), lins: [], currentLinId: null,
  viewerLinIds: [] as string[],
  onSelectPerson: vi.fn(), onSelectLin: vi.fn(), onClose: vi.fn(), onGraphChanged: vi.fn(),
}

describe('SidePanel own-profile gating', () => {
  beforeEach(() => {
    hookCalls.length = 0
    linkApi.pendingRemovalRequests.mockReset().mockResolvedValue(new Map())
    linkApi.withdrawLinkRemoval.mockReset().mockResolvedValue(undefined)
  })

  it('shows edit and link controls on the viewer’s own profile', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="me" />)
    expect(screen.getByRole('button', { name: 'Edit profile' })).toHaveClass('btn-sm')
    expect(screen.getByRole('button', { name: 'Edit profile' })).not.toHaveClass('border-accent')
    expect(screen.getByRole('button', { name: 'Add a big' })).toBeInTheDocument()
  })
  it('shows an alumni sign-in reminder only on my profile while personal email is missing', () => {
    state.personId = 'me'
    const details = { person: person('me'), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [],
      photoUrl: null, loading: false, error: null, reload: vi.fn() }
    const view = render(<SidePanel {...props} personId="me" details={details} />)
    expect(screen.getByText(/sign in after your Penn email expires/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add email' }))
    expect(screen.getByLabelText('Personal email')).toBeInTheDocument()
    view.unmount()

    render(<SidePanel {...props} personId="me" details={{ ...details, person: { ...person('me'), personal_email: 'me@gmail.com' } }} />)
    expect(screen.queryByRole('button', { name: 'Add email' })).not.toBeInTheDocument()
  })
  it('returns from the editor to the profile before closing the panel', () => {
    state.personId = 'me'
    const onClose = vi.fn()
    render(<SidePanel {...props} personId="me" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    expect(screen.getByRole('button', { name: 'Back to profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to profile' }))
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('uses Escape to leave the editor before closing the profile', () => {
    state.personId = 'me'
    const onClose = vi.fn()
    render(<SidePanel {...props} personId="me" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('hides them on someone else’s profile', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="other" />)
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a big' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add email' })).not.toBeInTheDocument()
  })

  it('reads supplied details instead of fetching its own copy', () => {
    state.personId = 'me'
    const shared = { person: person('me'), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [], photoUrl: null, loading: false, error: null, reload: vi.fn() }
    render(<SidePanel {...props} personId="me" details={shared} />)
    expect(hookCalls.every(call => !call.enabled)).toBe(true)
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
  })

  it('tells a viewer with no lin how one starts, and only them', () => {
    state.personId = 'me'
    const details = { person: person('me'), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [] as string[], photoUrl: null, loading: false, error: null, reload: vi.fn() }
    const { unmount } = render(<SidePanel {...props} personId="me" details={details} />)
    expect(screen.getByText(/Not in a lin yet\?/)).toBeInTheDocument()
    unmount()
    render(<SidePanel {...props} personId="me" details={{ ...details, linIds: ['lin-1'] }} />)
    expect(screen.queryByText(/Not in a lin yet\?/)).not.toBeInTheDocument()
  })

  it('fetches its own copy for someone who is not the viewer', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="other" />)
    expect(hookCalls).toContainEqual({ id: 'other', enabled: true })
  })

  it('enables removal again when a refreshed request is no longer pending', async () => {
    state.personId = 'me'
    linkApi.pendingRemovalRequests.mockResolvedValueOnce(new Map([['link-1', { id: 'request-1', requestedBy: 'me' }]])).mockResolvedValueOnce(new Map())
    const big = { link: { id: 'link-1', big_id: 'other', little_id: 'me', status: 'confirmed' as const,
      proposed_by: null, confirmed_by: null, confirmed_at: null, created_at: '' }, person: person('other') }
    const details = { person: person('me'), bigs: [big], littles: [], incoming: [], outgoing: [], linIds: [],
      photoUrl: null, loading: false, error: null, reload: vi.fn() }
    render(<SidePanel {...props} personId="me" details={details} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel removal request for Derek Zhang' })).toBeInTheDocument())
    fireEvent.focus(window)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request removal of Derek Zhang' })).toBeEnabled())
  })

  it('withdraws my pending removal request and enables a new one', async () => {
    state.personId = 'me'
    linkApi.pendingRemovalRequests.mockResolvedValue(new Map([['link-1', { id: 'request-1', requestedBy: 'me' }]]))
    const big = { link: { id: 'link-1', big_id: 'other', little_id: 'me', status: 'confirmed' as const,
      proposed_by: null, confirmed_by: null, confirmed_at: null, created_at: '' }, person: person('other') }
    const details = { person: person('me'), bigs: [big], littles: [], incoming: [], outgoing: [], linIds: [],
      photoUrl: null, loading: false, error: null, reload: vi.fn() }
    render(<SidePanel {...props} personId="me" details={details} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel removal request for Derek Zhang' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel removal request for Derek Zhang' }))
    await waitFor(() => expect(linkApi.withdrawLinkRemoval).toHaveBeenCalledWith(expect.anything(), 'request-1'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request removal of Derek Zhang' })).toBeEnabled())
  })

  it('offers corrections only when the viewer and profile share a lin', () => {
    state.personId = 'me'
    const details = { person: person('other'), bigs: [], littles: [], incoming: [], outgoing: [], linIds: ['lin-1'], photoUrl: null, loading: false, error: null, reload: vi.fn() }
    const { rerender } = render(<SidePanel {...props} personId="other" details={details} />)
    expect(screen.queryByRole('button', { name: 'Suggest a correction' })).not.toBeInTheDocument()
    rerender(<SidePanel {...props} viewerLinIds={['lin-1']} personId="other" details={details} />)
    expect(screen.getByRole('button', { name: 'Suggest a correction' })).toBeInTheDocument()
  })
})
