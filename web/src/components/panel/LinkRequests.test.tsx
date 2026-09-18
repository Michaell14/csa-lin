import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { LinkRequests, describeExisting } from '@/components/panel/LinkRequests'
import type { Link, Person } from '@/lib/types'

const person = (id: string, name: string): Person => ({
  id, display_name: name, grad_year: 2024, penn_email: null, personal_email: null, auth_user_id: null, personal_auth_user_id: null, claimed_at: null,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false,
  show_location: true, show_bio_interests: true, show_socials: true, show_professional: true,
  created_at: '', updated_at: '',
})
const link = (id: string, big: string, little: string, status: 'pending' | 'confirmed', proposed_by: string | null): Link => ({
  id, big_id: big, little_id: little, status, proposed_by, confirmed_by: null, confirmed_at: null, created_at: '',
})

describe('LinkRequests', () => {
  const handlers = { onAccept: vi.fn(), onDecline: vi.fn(), onWithdraw: vi.fn(), onWithdrawRemoval: vi.fn(), onRemove: vi.fn() }
  afterEach(() => { vi.clearAllMocks() })
  const props = {
    me: 'me',
    incoming: [{ link: link('i1', 'x', 'me', 'pending', 'x'), person: person('x', 'Xavier') }],
    outgoing: [{ link: link('o1', 'me', 'y', 'pending', 'me'), person: person('y', 'Yara') }],
    bigs: [{ link: link('b1', 'z', 'me', 'confirmed', null), person: person('z', 'Zed') }],
    littles: [],
    ...handlers,
  }
  it('describes incoming requests with the right role and offers accept/decline', () => {
    render(<LinkRequests {...props} />)
    expect(screen.getByText(/Xavier wants to be your big/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handlers.onAccept).toHaveBeenCalledWith(props.incoming[0].link)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(handlers.onDecline).toHaveBeenCalledWith(props.incoming[0].link)
  })
  it('lets me withdraw an outgoing request and request removal of a confirmed link', () => {
    render(<LinkRequests {...props} />)
    expect(screen.getByText('Waiting for request to be approved: Yara as your little')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(handlers.onWithdraw).toHaveBeenCalledWith(props.outgoing[0].link)
    const remove = screen.getByRole('button', { name: 'Request removal of Zed' })
    expect(remove).toHaveClass('border-accent', 'bg-paper')
    fireEvent.click(remove)
    expect(handlers.onRemove).toHaveBeenCalledWith(props.bigs[0].link)
  })
  it('turns my pending removal button into a cancel action', () => {
    render(<LinkRequests {...props} pendingRemovals={new Map([['b1', { id: 'request-1', requestedBy: 'me' }]])} />)
    expect(screen.queryByRole('button', { name: 'Request removal of Zed' })).not.toBeInTheDocument()
    const cancel = screen.getByRole('button', { name: 'Cancel removal request for Zed' })
    expect(cancel).toBeEnabled()
    expect(cancel).toHaveTextContent('Zed · Cancel removal request')
    expect(cancel).toHaveClass('border-accent', 'bg-accent-tint', 'text-accent')
    fireEvent.click(cancel)
    expect(handlers.onWithdrawRemoval).toHaveBeenCalledWith('b1', 'request-1')
  })
  it('shows another member’s pending request without offering withdrawal', () => {
    render(<LinkRequests {...props} pendingRemovals={new Map([['b1', { id: 'request-1', requestedBy: 'z' }]])} />)
    expect(screen.getByRole('button', { name: 'Request removal of Zed' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cancel removal request for Zed' })).not.toBeInTheDocument()
  })
})

describe('describeExisting', () => {
  it('names the state of an existing link', () => {
    expect(describeExisting(link('1', 'a', 'me', 'confirmed', null), 'me')).toBe('This link is already confirmed')
    expect(describeExisting(link('2', 'a', 'me', 'pending', 'me'), 'me')).toBe('You already requested this link')
    expect(describeExisting(link('3', 'a', 'me', 'pending', 'a'), 'me')).toBe('They already requested this link; accept it below')
  })
})
