import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useEscapeLayer } from '@/lib/hooks/useEscapeLayer'

function Layer({ active = true, onEscape }: { active?: boolean; onEscape: () => void }) {
  useEscapeLayer(active, onEscape)
  return null
}

describe('useEscapeLayer', () => {
  it('gives the key to the layer that opened last, and to no one else', () => {
    const under = vi.fn(), over = vi.fn()
    const { rerender } = render(<><Layer onEscape={under} /><Layer active={false} onEscape={over} /></>)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(under).toHaveBeenCalledTimes(1)
    expect(over).not.toHaveBeenCalled()

    rerender(<><Layer onEscape={under} /><Layer onEscape={over} /></>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(over).toHaveBeenCalledTimes(1)
    expect(under).toHaveBeenCalledTimes(1)
  })

  it('hands the key back to the layer underneath once the top one closes', () => {
    const under = vi.fn(), over = vi.fn()
    const { rerender } = render(<><Layer onEscape={under} /><Layer onEscape={over} /></>)
    rerender(<><Layer onEscape={under} /><Layer active={false} onEscape={over} /></>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(under).toHaveBeenCalledTimes(1)
    expect(over).not.toHaveBeenCalled()
  })

  it('calls the current handler, not the one the layer registered with', () => {
    const first = vi.fn(), second = vi.fn()
    const { rerender } = render(<Layer onEscape={first} />)
    rerender(<Layer onEscape={second} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys and stops listening once every layer is gone', () => {
    const onEscape = vi.fn()
    const { unmount } = render(<Layer onEscape={onEscape} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onEscape).not.toHaveBeenCalled()
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
