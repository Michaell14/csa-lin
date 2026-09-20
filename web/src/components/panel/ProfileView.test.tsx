import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileView } from '@/components/panel/ProfileView'
import type { Person, Link } from '@/lib/types'

const person = (id: string, name: string, year: number, extra: Partial<Person> = {}): Person => ({
  id, display_name: name, grad_year: year, penn_email: null, personal_email: null, auth_user_id: null, personal_auth_user_id: null, claimed_at: null,
  photo_path: null, major: null, hometown: null, bio: null, instagram: null, linkedin: null, hidden: false,
  show_location: true, show_bio_interests: true, show_socials: true, show_professional: true, show_linkedin: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra,
})
const link = (id: string, big: string, little: string): Link => ({
  id, big_id: big, little_id: little, status: 'confirmed', proposed_by: null, confirmed_by: null, confirmed_at: null, created_at: '2026-01-01T00:00:00Z',
})
const lins = [{ id: 'a', name: 'Wang Lin', color: '#6366f1', founder_id: 'x' }, { id: 'b', name: 'Wu Lin', color: '#14b8a6', founder_id: 'y' }]

describe('ProfileView', () => {
  const me = person('me', 'Derek Zhang', 2024, { major: 'Econ', hometown: 'Queens, NY', bio: 'hi', instagram: 'dz', linkedin: 'https://linkedin.com/in/dz' })
  const props = {
    person: me, photoUrl: null,
    bigs: [{ link: link('l1', 'b1', 'me'), person: person('b1', 'Bob Chen', 2023) }],
    littles: [{ link: link('l2', 'me', 'k1'), person: person('k1', 'Frank Lin', 2025) }],
    lins, currentLinId: 'a', onSelectPerson: vi.fn(), onSelectLin: vi.fn(),
  }
  it('shows profile fields and socials', () => {
    render(<ProfileView {...props} />)
    expect(screen.getByRole('heading', { name: 'Derek Zhang' })).toBeInTheDocument()
    expect(screen.getByText(/Econ/)).toBeInTheDocument()
    expect(screen.getByText(/Queens, NY/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '@dz' })).toHaveAttribute('href', 'https://instagram.com/dz')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://linkedin.com/in/dz')
  })
  it('never renders a non-LinkedIn URL or path-like handle as a link', () => {
    render(<ProfileView {...props} person={{ ...me, linkedin: 'javascript:alert(1)', instagram: '../x' }} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/LinkedIn link not shown/)).toBeInTheDocument()
  })
  it('lists bigs and littles as clickable pills', () => {
    render(<ProfileView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Bob Chen/ }))
    expect(props.onSelectPerson).toHaveBeenCalledWith('b1')
    fireEvent.click(screen.getByRole('button', { name: /Frank Lin/ }))
    expect(props.onSelectPerson).toHaveBeenCalledWith('k1')
  })
  it('shows lins and switches on click', () => {
    render(<ProfileView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wu Lin' }))
    expect(props.onSelectLin).toHaveBeenCalledWith('b')
  })
  it('shows an unclaimed note', () => {
    render(<ProfileView {...props} person={{ ...me, claimed_at: null }} />)
    expect(screen.getByText(/hasn.t claimed/)).toBeInTheDocument()
  })
})
