import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBox } from '@/components/SearchBox'

describe('SearchBox', () => {
  it('searches after typing and picks a result', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onPick = vi.fn()
    render(<SearchBox search={search} onPick={onPick} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ali' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('ali'))
    const option = await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.click(option)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })
  it('moves through results with the arrow keys and picks with Enter', async () => {
    const hits = [
      { id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false },
      { id: 'p2', display_name: 'Alice Zhou', grad_year: 2024, hidden: false },
    ]
    const search = vi.fn().mockResolvedValue(hits)
    const onPick = vi.fn()
    render(<SearchBox search={search} onPick={onPick} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })

    expect(screen.getByRole('option', { name: /Alice Wang/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Alice Zhou/ })).toHaveAttribute('aria-selected', 'true')
    expect(input.getAttribute('aria-activedescendant')).toContain('p2')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }))
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('wraps around at the ends of the list', async () => {
    const hits = [
      { id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false },
      { id: 'p2', display_name: 'Alice Zhou', grad_year: 2024, hidden: false },
    ]
    render(<SearchBox search={vi.fn().mockResolvedValue(hits)} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('option', { name: /Alice Zhou/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('closes the list on Escape and reports expansion', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    render(<SearchBox search={search} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('says what it searches before anything is typed', () => {
    render(<SearchBox search={vi.fn()} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    expect(screen.queryByText(/Type a name/)).toBeNull()
    fireEvent.focus(input)
    expect(screen.getByText(/Type a name to search/)).toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.queryByText(/Type a name/)).toBeNull()
  })

  it('shows an empty state', async () => {
    const search = vi.fn().mockResolvedValue([])
    render(<SearchBox search={search} onPick={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(await screen.findByText('No one found')).toBeInTheDocument()
  })
})
