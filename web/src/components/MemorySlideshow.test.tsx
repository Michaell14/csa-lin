import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemorySlideshow } from './MemorySlideshow'

const paths = ['lin/me/a.jpg', 'lin/me/b.mp4', 'lin/me/c.jpg']
const urls = ['A', 'B', 'C']
it('shows one item at a time with a counter', () => {
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  expect(screen.getByRole('img', { name: 'Dinner (1 of 3)' })).toHaveAttribute('src', 'A')
  expect(screen.queryByText('2 of 3')).not.toBeInTheDocument()
  expect(screen.getByText('1 of 3')).toBeInTheDocument()
  expect(document.querySelectorAll('img, video')).toHaveLength(1)
})
it('steps with the arrows and does not wrap', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(document.querySelector('video')).toHaveAttribute('src', 'B')
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(screen.getByRole('img', { name: 'Dinner (3 of 3)' })).toHaveAttribute('src', 'C')
})
it('keeps every item inside one fixed media frame', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  const frame = screen.getByTestId('memory-media-frame')
  expect(frame).toHaveClass('h-72')
  expect(screen.getByRole('img', { name: 'Dinner (1 of 3)' })).toHaveClass('h-full', 'w-full', 'object-contain')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByTestId('memory-media-frame')).toBe(frame)
  expect(screen.getByLabelText('Dinner (2 of 3)')).toHaveClass('h-full', 'w-full', 'object-contain')
})
it('steps with the arrow keys while focused', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  screen.getByRole('group', { name: 'Dinner, 3 items' }).focus()
  await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowLeft}')
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
})
it('jumps to an item from its dot', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  await user.click(screen.getByRole('button', { name: 'Go to item 3' }))
  expect(screen.getByText('3 of 3')).toBeInTheDocument()
})
it('says when an item is unavailable', () => {
  render(<MemorySlideshow paths={paths} urls={[null, 'B', 'C']} alt="Dinner" />)
  expect(screen.getByText(/unavailable/)).toBeInTheDocument()
})
