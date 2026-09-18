import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { BulkAddForm } from '@/components/admin/BulkAddForm'

it('shows the added count, duplicate people, and invalid rows after a partial import', async () => {
  const onAdd = vi.fn().mockResolvedValue({
    added: 1,
    duplicates: [{ display_name: 'Existing', grad_year: 2028, penn_email: 'existing@upenn.edu' }],
    failed: [],
  })
  render(<BulkAddForm onAdd={onAdd} />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New,2028,new@upenn.edu\nExisting,2028,existing@upenn.edu\nInvalid,not-a-year,bad@upenn.edu' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 people' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added 1 person.'))
  expect(screen.getByRole('status')).toHaveTextContent('Existing (existing@upenn.edu)')
  expect(screen.getByRole('status')).toHaveTextContent('Line 3: grad year must be a four-digit year')
  expect(onAdd).toHaveBeenCalledWith([
    { display_name: 'New', grad_year: 2028, penn_email: 'new@upenn.edu' },
    { display_name: 'Existing', grad_year: 2028, penn_email: 'existing@upenn.edu' },
  ])
})
