import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinSidebar } from '@/components/LinSidebar'

const lins = [
  { id: 'a', name: 'Wang Lin', color: '#6366f1', founder_id: 'f1' },
  { id: 'b', name: 'Wu Lin', color: '#14b8a6', founder_id: 'f2' },
]

describe('LinSidebar', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('renders a tab per lin and marks the selected one', () => {
    render(<LinSidebar lins={lins} selectedId="b" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Wang Lin' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Wu Lin' })).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onSelect with the lin id', () => {
    const onSelect = vi.fn()
    render(<LinSidebar lins={lins} selectedId="a" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Wu Lin' }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('collapses and reopens, remembering the state', () => {
    const { unmount } = render(<LinSidebar lins={lins} selectedId="a" onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide lins' }))
    expect(screen.queryByRole('tab', { name: 'Wang Lin' })).toBeNull()

    unmount()
    render(<LinSidebar lins={lins} selectedId="a" onSelect={() => {}} />)
    const show = screen.getByRole('button', { name: 'Show lins' })
    fireEvent.click(show)
    expect(screen.getByRole('tab', { name: 'Wang Lin' })).toBeInTheDocument()
  })

  it('resizes with the keyboard and clamps to the minimum width', () => {
    render(<LinSidebar lins={lins} selectedId="a" onSelect={() => {}} />)
    const handle = screen.getByRole('separator', { name: 'Resize lins panel' })
    const aside = handle.closest('aside')!
    expect(aside).toHaveStyle({ width: '220px' })

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(aside).toHaveStyle({ width: '236px' })

    for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(aside).toHaveStyle({ width: '160px' })
    expect(window.localStorage.getItem('lins.sidebar.width')).toBe('160')
  })
})
