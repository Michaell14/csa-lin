import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { Person } from '@/lib/types'

const state = vi.hoisted(() => ({ personId: 'me' as string | null, isAdmin: false }))
vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'a@upenn.edu', personId: state.personId, isAdmin: state.isAdmin, pendingCount: 0, refresh: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
const person = (id: string): Person => ({
  id, display_name: 'Derek Zhang', grad_year: 2024, penn_email: null, personal_email: null, auth_user_id: null, personal_auth_user_id: null, claimed_at: '2026-01-01T00:00:00Z',
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null, preferred_name: null, pronouns: null, school: null, current_city: null, interests: null, csa_role: null, show_location: true, show_bio_interests: true, show_socials: true, show_professional: true, created_at: '', updated_at: '',
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
  onSelectPerson: vi.fn(), onSelectLin: vi.fn(), onClose: vi.fn(), onGraphChanged: vi.fn(),
}

describe('SidePanel own-profile gating', () => {
  beforeEach(() => { hookCalls.length = 0 })

  it('shows edit and link controls on the viewer’s own profile', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="me" />)
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a big' })).toBeInTheDocument()
  })
  it('hides them on someone else’s profile', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="other" />)
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a big' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
  })

  it('reads supplied details instead of fetching its own copy', () => {
    state.personId = 'me'
    const shared = { person: person('me'), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [], photoUrl: null, loading: false, error: null, reload: vi.fn() }
    render(<SidePanel {...props} personId="me" details={shared} />)
    expect(hookCalls.every(call => !call.enabled)).toBe(true)
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
  })

  it('fetches its own copy for someone who is not the viewer', () => {
    state.personId = 'me'
    render(<SidePanel {...props} personId="other" />)
    expect(hookCalls).toContainEqual({ id: 'other', enabled: true })
  })
})
