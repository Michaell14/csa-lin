import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBox } from '@/components/SearchBox'
import type { PersonHit } from '@/lib/api/people'

describe('SearchBox', () => {
  it('searches after typing and picks a result', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null }])
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
      { id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: 'CIS' },
      { id: 'p2', display_name: 'Alice Zhou', grad_year: 2024, hidden: false, major: null },
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
      { id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null },
      { id: 'p2', display_name: 'Alice Zhou', grad_year: 2024, hidden: false, major: null },
    ]
    render(<SearchBox search={vi.fn().mockResolvedValue(hits)} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ali' } })
    await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('option', { name: /Alice Zhou/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('closes the list on Escape and reports expansion', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null }])
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

  it('does not reopen when a request that was in flight at Escape lands', async () => {
    let resolve!: (v: PersonHit[]) => void
    const search = vi.fn(() => new Promise<PersonHit[]>(r => { resolve = r }))
    render(<SearchBox search={search} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ali' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('ali'))

    // Escape lands while the request is still out; its answer is no longer wanted.
    fireEvent.keyDown(input, { key: 'Escape' })
    await act(async () => { resolve([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: null }]) })

    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.queryByText(/Alice Wang/)).toBeNull()
    // Escape emptied the still-focused field, so all that is left is the hint.
    expect(screen.getByText(/Type a name to search/)).toBeInTheDocument()
  })

  it('gives each result a class year and a major to tell namesakes apart', async () => {
    const hits = [
      { id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: 'CIS' },
      { id: 'p2', display_name: 'Alice Wang', grad_year: 2022, hidden: false, major: 'Nursing' },
    ]
    render(<SearchBox search={vi.fn().mockResolvedValue(hits)} onPick={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'alice' } })
    const options = await screen.findAllByRole('option')
    expect(options[0]).toHaveTextContent("Alice Wang '22 · CIS")
    expect(options[1]).toHaveTextContent("Alice Wang '22 · Nursing")
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
