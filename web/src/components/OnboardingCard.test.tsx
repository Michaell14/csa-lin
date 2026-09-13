import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const details = vi.hoisted(() => ({
  person: { photo_path: null, bio: null, personal_email: null },
  bigs: [], littles: [], incoming: [], loading: false,
}))
vi.mock('@/lib/hooks/usePersonDetails', () => ({ usePersonDetails: () => details }))

import { OnboardingCard } from '@/components/OnboardingCard'

describe('OnboardingCard', () => {
  beforeEach(() => window.localStorage.removeItem('lins.onboarding.dismissed'))

  it('shows incomplete profile tasks and opens the profile', () => {
    const onOpenProfile = vi.fn()
    render(<OnboardingCard personId="person-1" onOpenProfile={onOpenProfile} />)
    expect(screen.getByText('Welcome to your lin')).toBeInTheDocument()
    expect(screen.getByText('Continue setup · 4 left')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Continue setup · 4 left'))
    expect(onOpenProfile).toHaveBeenCalledOnce()
  })

  it('can be dismissed', () => {
    render(<OnboardingCard personId="person-1" onOpenProfile={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss setup checklist' }))
    expect(screen.queryByText('Welcome to your lin')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('lins.onboarding.dismissed')).toBe('true')
  })
})
