import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const viewer = vi.hoisted(() => ({ personId: 'me' as string | null, isAdmin: false, pendingCount: 0 }))
vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'derek@upenn.edu', ...viewer, refresh: vi.fn(), signOut: vi.fn() }),
}))

import { TopBar } from '@/components/TopBar'

const props = { search: vi.fn().mockResolvedValue([]), onPick: vi.fn(), onOpenSelf: vi.fn() }

describe('TopBar account menu', () => {
  it('reports its expanded state', () => {
    render(<TopBar {...props} />)
    const button = screen.getByRole('button', { name: 'Account menu' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'My profile' })).toBeInTheDocument()
  })

  it('closes on Escape and hands focus back to the button', () => {
    render(<TopBar {...props} />)
    const button = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(button)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'My profile' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('closes on a click outside', () => {
    render(<TopBar {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('button', { name: 'My profile' })).toBeNull()
  })

  it('stays open when clicking inside itself', () => {
    render(<TopBar {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'My profile' }))
    expect(screen.getByRole('button', { name: 'My profile' })).toBeInTheDocument()
  })
})

describe('TopBar search on small screens', () => {
  it('toggles a second search field from the icon button', () => {
    render(<TopBar {...props} />)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    const toggle = screen.getByRole('button', { name: 'Search people' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })
})
