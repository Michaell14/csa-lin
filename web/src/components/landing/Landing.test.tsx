import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Landing } from '@/components/landing/Landing'

describe('Landing', () => {
  it('offers sign-in in the header and hero but shows a sign-in error only once', () => {
    render(
      <Landing
        cta={<button>Sign in with Penn Google</button>}
        onSignIn={() => {}}
        alert={<p role="alert">That account is not in a lin.</p>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Sign in with Penn Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('sends the header button to the sign-in section once there is more than one way in', () => {
    const onSignIn = vi.fn()
    render(<Landing cta={<button>Google</button>} secondaryCta={<button>Email code</button>} nursingEmailEnabled onSignIn={onSignIn} />)
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#signin')
    expect(onSignIn).not.toHaveBeenCalled()
  })

  it('links nowhere it cannot reach', () => {
    render(<Landing cta={<button>Sign in</button>} onSignIn={() => {}} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('#')
    }
  })

  it('only mentions nursing email codes when that sign-in option is available', () => {
    const { rerender } = render(<Landing cta={<button>Google</button>} onSignIn={() => {}} />)
    expect(screen.queryByText(/email code if you’re in the Nursing School/)).not.toBeInTheDocument()
    rerender(<Landing cta={<button>Google</button>} secondaryCta={<button>Email code</button>} nursingEmailEnabled onSignIn={() => {}} />)
    expect(screen.getByText(/email code if you’re in the Nursing School/)).toBeInTheDocument()
    rerender(<Landing cta={<button>Google</button>} secondaryCta={<button>Local dev login</button>} onSignIn={() => {}} />)
    expect(screen.queryByText(/email code if you’re in the Nursing School/)).not.toBeInTheDocument()
  })
})
