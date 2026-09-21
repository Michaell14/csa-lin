import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoriesTrigger, useMemoriesOpen, MEMORIES_OPEN_KEY } from './MemoriesTrigger'

beforeEach(() => { localStorage.clear() })

it('opens memories on click', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<MemoriesTrigger shifted={false} onOpen={onOpen} />)
  await user.click(screen.getByRole('button', { name: 'Show memories' }))
  expect(onOpen).toHaveBeenCalledOnce()
})
it('moves clear of the side panel while a profile occupies it', () => {
  const { rerender } = render(<MemoriesTrigger shifted={false} onOpen={() => {}} />)
  const button = () => screen.getByRole('button', { name: 'Show memories' })
  expect(button().className).not.toContain('--rail-width')
  rerender(<MemoriesTrigger shifted onOpen={() => {}} />)
  expect(button().className).toContain('--rail-width')
})
it('remembers whether the viewer left memories open', () => {
  localStorage.setItem(MEMORIES_OPEN_KEY, 'true')
  const { result } = renderHook(() => useMemoriesOpen())
  expect(result.current.open).toBe(true)
  act(() => result.current.setOpen(false))
  expect(result.current.open).toBe(false)
  expect(localStorage.getItem(MEMORIES_OPEN_KEY)).toBe('false')
})
