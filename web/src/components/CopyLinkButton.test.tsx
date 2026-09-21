import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyLinkButton } from '@/components/CopyLinkButton'

describe('CopyLinkButton', () => {
  const writeText = vi.fn()
  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })
  afterEach(() => { vi.useRealTimers() })

  it('copies the full URL of the page and confirms for a moment', async () => {
    render(<CopyLinkButton path="/?lin=abc&person=def" label="person" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this person' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?lin=abc&person=def`))
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument()
  })

  it('offers again once the confirmation has passed', async () => {
    vi.useFakeTimers()
    render(<CopyLinkButton path="/?lin=abc" label="lin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this lin' }))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByRole('button', { name: 'Copy link to this lin' })).toBeInTheDocument()
  })

  it('falls back to the copy command when the clipboard API is denied', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    render(<CopyLinkButton path="/?lin=abc" label="lin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this lin' }))
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('says so when every way of copying is refused', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
    render(<CopyLinkButton path="/?lin=abc" label="lin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this lin' }))
    expect(await screen.findByRole('button', { name: 'Could not copy link' })).toBeInTheDocument()
  })
})
