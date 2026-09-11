import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Person } from '@/lib/types'

vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'derek@upenn.edu', personId: 'me', isAdmin: false, pendingCount: 0, refresh: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
const person: Person = {
  id: 'me', display_name: 'Derek Zhang', grad_year: 2024, penn_email: null, personal_email: null, auth_user_id: null,
  personal_auth_user_id: null, claimed_at: '2026-01-01T00:00:00Z', photo_path: null, major: null, hometown: null,
  bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null, created_at: '', updated_at: '',
}
vi.mock('@/lib/hooks/usePersonDetails', () => ({
  usePersonDetails: () => ({ person, bigs: [], littles: [], incoming: [], outgoing: [], linIds: [], photoUrl: null, loading: false, error: null, reload: vi.fn() }),
}))

import { TopBar } from '@/components/TopBar'
import { SidePanel } from '@/components/panel/SidePanel'

const onClose = vi.fn()
const bar = { search: vi.fn().mockResolvedValue([]), onPick: vi.fn(), onOpenSelf: vi.fn() }
const panel = {
  personId: 'me', graph: { people: [], links: [] }, photoUrls: new Map<string, string>(), lins: [],
  currentLinId: null, onSelectPerson: vi.fn(), onSelectLin: vi.fn(), onClose, onGraphChanged: vi.fn(),
}

function Screen() {
  return <><TopBar {...bar} /><SidePanel {...panel} /></>
}

// The account menu and the person panel both used to answer window-level
// Escape, so one key press dismissed the menu and threw away the panel's state
// behind it.
describe('Escape with a menu open over the person panel', () => {
  beforeEach(() => { onClose.mockClear() })

  it('closes only the menu, leaving the panel open', () => {
    render(<Screen />)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('button', { name: 'My profile' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'My profile' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('complementary', { name: 'Person details' })).toBeInTheDocument()
  })

  it('closes the panel on the next Escape, once the menu is out of the way', () => {
    render(<Screen />)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not back out of a half-filled profile edit', () => {
    render(<Screen />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    const bio = screen.getByLabelText('Bio')
    fireEvent.change(bio, { target: { value: 'half a sentence' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'My profile' })).toBeNull()
    expect(screen.getByLabelText('Bio')).toHaveValue('half a sentence')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close the panel when Escape dismisses the search list', async () => {
    bar.search.mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null }])
    render(<Screen />)
    const input = screen.getAllByRole('combobox')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('hands Escape back to the panel once the search field has nothing left to dismiss', async () => {
    bar.search.mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null }])
    render(<Screen />)
    const input = screen.getAllByRole('combobox')[0]
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })

    fireEvent.keyDown(input, { key: 'Escape' })   // the list
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })   // the words still in the field
    expect(input).toHaveValue('')
    expect(onClose).not.toHaveBeenCalled()

    // The field is empty and holds nothing of its own now, so keyboard users
    // can still close the panel without having to move focus out first.
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
