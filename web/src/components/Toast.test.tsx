import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Toast } from '@/components/Toast'

describe('Toast', () => {
  it('announces the message and dismisses on request', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Could not load the lin" onDismiss={onDismiss} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the lin')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
