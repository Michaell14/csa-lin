import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth, rpc: auth.rpc }) }))
vi.mock('@/lib/jwt', () => ({ readViewerClaims: () => ({ personId: 'new-person' }) }))

import { ProfileSetup } from '@/components/ProfileSetup'

it('requires a class year, creates a profile, and refreshes the session before continuing', async () => {
  auth.getUser.mockResolvedValue({ data: { user: { user_metadata: { full_name: 'New Member' } } } })
  auth.rpc.mockResolvedValue({ error: null })
  auth.refreshSession.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
  const onReady = vi.fn().mockResolvedValue(undefined)
  render(<ProfileSetup email="new@upenn.edu" onReady={onReady} onSignOut={vi.fn()} />)

  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Full Name' })).toHaveValue('New Member'))
  fireEvent.submit(screen.getByRole('button', { name: 'Create profile' }).closest('form')!)
  expect(auth.rpc).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('class year')

  fireEvent.change(screen.getByLabelText('Class of'), { target: { value: '2028' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Create profile' }).closest('form')!)
  await waitFor(() => expect(onReady).toHaveBeenCalledOnce())
  expect(auth.rpc).toHaveBeenCalledWith('create_my_profile', { profile_name: 'New Member', class_year: 2028 })
  expect(auth.refreshSession).toHaveBeenCalledOnce()
})
