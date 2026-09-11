import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmButton } from '@/components/ConfirmButton'

const props = { label: 'Delete', question: 'Delete Wang Lin?', confirmLabel: 'Delete', onConfirm: vi.fn() }

describe('ConfirmButton', () => {
  it('asks before it acts', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton {...props} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Delete Wang Lin?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
  it('backs out and comes back as the original button', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton {...props} onConfirm={onConfirm} cancelLabel="Keep" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByText('Delete Wang Lin?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
  it('can be named for a screen reader when the label is a bare glyph', () => {
    render(<ConfirmButton {...props} label="Zed ×" ariaLabel="Remove Zed" />)
    expect(screen.getByRole('button', { name: 'Remove Zed' })).toBeInTheDocument()
  })
})
