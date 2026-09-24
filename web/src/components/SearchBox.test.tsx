import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBox } from '@/components/SearchBox'

describe('SearchBox', () => {
  it('searches after typing and picks a result', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onPick = vi.fn()
    render(<SearchBox search={search} onPick={onPick} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ali' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('ali', expect.any(AbortSignal)))
    const option = await screen.findByRole('option', { name: /Alice Wang/ })
    fireEvent.click(option)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })
  it('cancels a request the next keystroke has superseded', async () => {
    const signals: AbortSignal[] = []
    const search = vi.fn((_q: string, signal: AbortSignal) => { signals.push(signal); return new Promise<never>(() => {}) })
    render(<SearchBox search={search} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'al' } })
    await waitFor(() => expect(signals).toHaveLength(1))
    fireEvent.change(input, { target: { value: 'ali' } })
    expect(signals[0]!.aborted).toBe(true)
    await waitFor(() => expect(signals).toHaveLength(2))
    expect(signals[1]!.aborted).toBe(false)
  })
  it('does not report a request that Escape cancelled mid-flight', async () => {
    let reject: (reason: unknown) => void = () => {}
    const search = vi.fn((_q: string, signal: AbortSignal) => new Promise<never>((_resolve, rej) => {
      reject = rej
      signal.addEventListener('abort', () => rej(new DOMException('The operation was aborted.', 'AbortError')))
    }))
    render(<SearchBox search={search} onPick={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'al' } })
    await waitFor(() => expect(search).toHaveBeenCalledOnce())
    fireEvent.keyDown(input, { key: 'Escape' })
    await Promise.resolve()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveValue('')
    reject(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
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
  it('uses unique listbox ids and clears stale results immediately', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice', grad_year: 2022, hidden: false }])
    render(<><SearchBox search={search} onPick={() => {}} /><SearchBox search={search} onPick={() => {}} /></>)
    const [first, second] = screen.getAllByRole('combobox')
    expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'))
    fireEvent.change(first, { target: { value: 'a' } })
    await screen.findByRole('option', { name: /Alice/ })
    fireEvent.change(first, { target: { value: 'b' } })
    expect(screen.queryByRole('option', { name: /Alice/ })).not.toBeInTheDocument()
  })
  it('closes the results when the search is abandoned and brings them back on return', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice', grad_year: 2022, hidden: false }])
    render(<><SearchBox search={search} onPick={() => {}} /><p>Elsewhere</p></>)
    const input = screen.getByRole('combobox')
    input.focus()
    fireEvent.change(input, { target: { value: 'a' } })
    await screen.findByRole('option', { name: /Alice/ })

    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')

    fireEvent.focus(input)
    expect(screen.getByRole('option', { name: /Alice/ })).toBeInTheDocument()

    fireEvent.blur(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(search).toHaveBeenCalledTimes(1)
  })
})
