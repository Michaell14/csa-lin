import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Person } from '@/lib/types'
import type { PersonDetails } from '@/lib/hooks/usePersonDetails'
import { OnboardingCard } from '@/components/OnboardingCard'

const person = (over: Partial<Person> = {}): Person => ({
  id: 'person-1', display_name: 'Derek Zhang', grad_year: 2024, penn_email: null, personal_email: null,
  auth_user_id: null, personal_auth_user_id: null, claimed_at: null, photo_path: null, major: null,
  hometown: null, bio: null, instagram: null, linkedin: null, hidden: false, merged_into: null,
  preferred_name: null, pronouns: null, school: null, current_city: null, interests: null, csa_role: null,
  created_at: '', updated_at: '', ...over,
})

const detailsOf = (over: Partial<PersonDetails> = {}): PersonDetails => ({
  person: person(), bigs: [], littles: [], incoming: [], outgoing: [], linIds: [],
  photoUrl: null, loading: false, error: null, reload: vi.fn(), ...over,
})

const keyFor = (personId: string) => `lins.onboarding.dismissed.${personId}`

describe('OnboardingCard', () => {
  beforeEach(() => window.localStorage.clear())

  it('shows incomplete profile tasks and opens the profile', () => {
    const onOpenProfile = vi.fn()
    render(<OnboardingCard personId="person-1" details={detailsOf()} onOpenProfile={onOpenProfile} />)
    expect(screen.getByText('Welcome to your lin')).toBeInTheDocument()
    expect(screen.getByText('Continue setup · 4 left')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Continue setup · 4 left'))
    expect(onOpenProfile).toHaveBeenCalledOnce()
  })

  it('can be dismissed', () => {
    render(<OnboardingCard personId="person-1" details={detailsOf()} onOpenProfile={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss setup checklist' }))
    expect(screen.queryByText('Welcome to your lin')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(keyFor('person-1'))).toBe('true')
  })

  it('keeps one person’s dismissal out of another person’s checklist', () => {
    const first = render(<OnboardingCard personId="person-1" details={detailsOf()} onOpenProfile={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss setup checklist' }))
    first.unmount()

    render(<OnboardingCard personId="person-2" details={detailsOf()} onOpenProfile={() => {}} />)
    expect(screen.getByText('Welcome to your lin')).toBeInTheDocument()
    expect(window.localStorage.getItem(keyFor('person-2'))).toBeNull()
  })

  it('ticks tasks off as the shared details are refreshed', () => {
    const view = render(<OnboardingCard personId="person-1" details={detailsOf()} onOpenProfile={() => {}} />)
    expect(screen.getByText('Continue setup · 4 left')).toBeInTheDocument()

    const saved = detailsOf({ person: person({ photo_path: 'me.jpg', bio: 'Hello' }) })
    view.rerender(<OnboardingCard personId="person-1" details={saved} onOpenProfile={() => {}} />)
    expect(screen.getByText('Continue setup · 2 left')).toBeInTheDocument()
  })

  it('disappears once every task is finished', () => {
    const done = detailsOf({
      person: person({ photo_path: 'me.jpg', bio: 'Hello', personal_email: 'a@b.c' }),
      bigs: [{ link: {}, person: person({ id: 'big' }) }] as PersonDetails['bigs'],
    })
    render(<OnboardingCard personId="person-1" details={done} onOpenProfile={() => {}} />)
    expect(screen.queryByText('Welcome to your lin')).not.toBeInTheDocument()
  })
})
