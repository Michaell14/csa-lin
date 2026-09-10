import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LinTabs } from '@/components/LinTabs'

const lins = [
  { id: 'a', name: 'Wang Lin', color: '#6366f1', founder_id: 'f1' },
  { id: 'b', name: 'Wu Lin', color: '#14b8a6', founder_id: 'f2' },
]

describe('LinTabs', () => {
  it('renders a tab per lin and marks the selected one', () => {
    render(<LinTabs lins={lins} selectedId="b" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Wang Lin' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Wu Lin' })).toHaveAttribute('aria-selected', 'true')
  })
  it('calls onSelect with the lin id', () => {
    const onSelect = vi.fn()
    render(<LinTabs lins={lins} selectedId="a" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Wu Lin' }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })
})
