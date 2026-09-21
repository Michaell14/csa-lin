import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signInWithOAuth: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => search.params,
}))

import LoginPage from '@/app/login/page'

describe('local development login', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_DEV_LOGIN', 'true')
    vi.stubEnv('NEXT_PUBLIC_NURSING_EMAIL_LOGIN_ENABLED', 'true')
    auth.signInWithPassword.mockReset().mockResolvedValue({ error: null })
    auth.signInWithOAuth.mockReset().mockResolvedValue({ error: null })
    router.push.mockReset()
    router.refresh.mockReset()
    search.params = new URLSearchParams()
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

  it('returns to the page the visitor asked for before signing in', async () => {
    search.params = new URLSearchParams('next=%2F%3Flin%3Dabc%26person%3Ddef')
    render(<LoginPage />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in with Penn Google' })[0])
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled())
    expect(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo)
      .toBe(`${window.location.origin}/auth/callback?next=%2F%3Flin%3Dabc%26person%3Ddef`)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with dev account' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/?lin=abc&person=def'))
  })

  it('never follows a return path off the site', async () => {
    search.params = new URLSearchParams('next=https%3A%2F%2Fevil.example%2F')
    render(<LoginPage />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in with Penn Google' })[0])
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled())
    expect(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(`${window.location.origin}/auth/callback`)
  })
})
