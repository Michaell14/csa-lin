import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { RightRail, useRailWidth, RAIL_WIDTH_KEY } from './RightRail'

beforeEach(() => { localStorage.clear() })

it('is one landmark holding whatever it is given, sized by the shared width', () => {
  render(<RightRail label="Person profile" width={340} maxWidth={600} onResize={() => {}}><p>hello</p></RightRail>)
  const rail = screen.getByRole('complementary', { name: 'Person profile' })
  expect(rail).toHaveTextContent('hello')
  expect(rail.style.getPropertyValue('--rail-width')).toBe('340px')
})
it('grows and shrinks from the keyboard within its bounds', async () => {
  const user = userEvent.setup()
  const onResize = vi.fn()
  render(<RightRail label="Memories sidebar" width={300} maxWidth={320} onResize={onResize}><p /></RightRail>)
  const handle = screen.getByRole('separator', { name: 'Resize side panel' })
  handle.focus()
  await user.keyboard('{ArrowLeft}')
  expect(onResize).toHaveBeenLastCalledWith(320)
  await user.keyboard('{ArrowRight}{ArrowRight}')
  expect(onResize).toHaveBeenLastCalledWith(280)
  expect(handle).toHaveAttribute('aria-valuemin', '280')
  expect(handle).toHaveAttribute('aria-valuemax', '320')
})
it('remembers the width a viewer chose', () => {
  localStorage.setItem(RAIL_WIDTH_KEY, '420')
  const { result } = renderHook(() => useRailWidth(useRef<HTMLDivElement>(null)))
  expect(result.current.width).toBe(420)
  act(() => result.current.setWidth(455))
  expect(result.current.width).toBe(455)
  expect(localStorage.getItem(RAIL_WIDTH_KEY)).toBe('455')
})
it('ignores a stored width outside the allowed range', () => {
  localStorage.setItem(RAIL_WIDTH_KEY, '9999')
  const { result } = renderHook(() => useRailWidth(useRef<HTMLDivElement>(null)))
  expect(result.current.width).toBe(600)
})
