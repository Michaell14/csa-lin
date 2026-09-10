import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBox } from '@/components/SearchBox'

describe('SearchBox', () => {
  it('searches after typing and picks a result', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onPick = vi.fn()
    render(<SearchBox search={search} onPick={onPick} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ali' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('ali'))
    const option = await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.click(option)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })
  it('shows an empty state', async () => {
    const search = vi.fn().mockResolvedValue([])
    render(<SearchBox search={search} onPick={() => {}} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(await screen.findByText('No one found')).toBeInTheDocument()
  })
})
