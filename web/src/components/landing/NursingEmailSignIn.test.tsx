import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithOtp = vi.hoisted(() => vi.fn())
const verifyOtp = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOtp, verifyOtp } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }))

import { NursingEmailSignIn } from '@/components/landing/NursingEmailSignIn'

describe('NursingEmailSignIn', () => {
  beforeEach(() => {
    signInWithOtp.mockReset().mockResolvedValue({ error: null })
    verifyOtp.mockReset().mockResolvedValue({ error: null })
    replace.mockReset()
    refresh.mockReset()
  })

  function showForm() {
    render(<NursingEmailSignIn />)
    fireEvent.click(screen.getByRole('button', { name: /In the Nursing School/ }))
  }

  it('sends a code to the normalized Nursing email, then verifies it and signs in', async () => {
    showForm()
    fireEvent.change(screen.getByLabelText('Your Nursing email'), { target: { value: 'Student@Nursing.UPenn.edu ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a code' }))
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'student@nursing.upenn.edu',
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }))
    expect(await screen.findByText(/Enter the code sent to/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({
      email: 'student@nursing.upenn.edu', token: '123456', type: 'email',
    }))
    expect(replace).toHaveBeenCalledWith('/')
    expect(refresh).toHaveBeenCalled()
  })

  it.each(['student@gmail.com', 'student@upenn.edu', 'student@seas.upenn.edu'])('rejects %s without sending a code', address => {
    showForm()
    fireEvent.change(screen.getByLabelText('Your Nursing email'), { target: { value: address } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('@nursing.upenn.edu')
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('keeps the code form open when Supabase rejects an incorrect code', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('Invalid code') })
    showForm()
    fireEvent.change(screen.getByLabelText('Your Nursing email'), { target: { value: 'student@nursing.upenn.edu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send a code' }))
    await screen.findByLabelText('Six-digit code')
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code')
    expect(replace).not.toHaveBeenCalled()
  })
})
