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
  it('shows an empty state', async () => {
    const search = vi.fn().mockResolvedValue([])
    render(<SearchBox search={search} onPick={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(await screen.findByText('No one found')).toBeInTheDocument()
  })
  it('supports keyboard navigation and selection', async () => {
    const hits = [{ id: 'p1', display_name: 'Alice', grad_year: 2022, hidden: false }, { id: 'p2', display_name: 'Bea', grad_year: 2023, hidden: false }]
    const onPick = vi.fn()
    render(<SearchBox search={vi.fn().mockResolvedValue(hits)} onPick={onPick} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'a' } })
    await screen.findByRole('option', { name: /Alice/ })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }))
  })
})
