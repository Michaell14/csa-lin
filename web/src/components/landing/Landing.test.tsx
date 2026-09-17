import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Landing } from '@/components/landing/Landing'

describe('Landing', () => {
  it('repeats the call to action but shows a sign-in error only once', () => {
    render(
      <Landing
        cta={<button>Sign in with Penn Google</button>}
        onSignIn={() => {}}
        alert={<p role="alert">That account is not on a lin.</p>}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'Sign in with Penn Google' })).toHaveLength(2)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('links nowhere it cannot reach', () => {
    render(<Landing cta={<button>Sign in</button>} onSignIn={() => {}} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('#')
    }
  })
})
