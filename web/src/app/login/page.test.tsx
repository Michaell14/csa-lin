import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signInWithOAuth: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}))

import LoginPage from '@/app/login/page'

describe('local development login', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_DEV_LOGIN', 'true')
    vi.stubEnv('NEXT_PUBLIC_NURSING_EMAIL_LOGIN_ENABLED', 'true')
    auth.signInWithPassword.mockReset().mockResolvedValue({ error: null })
    router.push.mockReset()
    router.refresh.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('shows the password form beside sign-in and uses it for seeded accounts', async () => {
    render(<LoginPage />)
    expect(screen.getByText('Local dev login')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /In the Nursing School/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Dev account email'), { target: { value: 'alice@upenn.edu' } })
    fireEvent.change(screen.getByLabelText('Dev account password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with dev account' }))
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@upenn.edu', password: 'password123',
    }))
    expect(router.push).toHaveBeenCalledWith('/')
  })
})
