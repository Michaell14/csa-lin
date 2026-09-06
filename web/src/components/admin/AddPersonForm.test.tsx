import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddPersonForm } from '@/components/admin/AddPersonForm'

describe('AddPersonForm', () => {
  it('warns about near matches and still allows adding', async () => {
    const nearMatches = vi.fn().mockResolvedValue([{ id: 'p1', display_name: 'Alice Wang', grad_year: 2022, hidden: false }])
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<AddPersonForm nearMatches={nearMatches} onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice Wong' } })
    fireEvent.blur(screen.getByLabelText('Name'))
    expect(await screen.findByText(/Similar names already exist/)).toBeInTheDocument()
    expect(screen.getByText(/Alice Wang/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Grad year'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Penn email'), { target: { value: 'AWong@upenn.edu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ display_name: 'Alice Wong', grad_year: 2026, penn_email: 'awong@upenn.edu' }))
  })
  it('shows a database error verbatim', async () => {
    const onAdd = vi.fn().mockRejectedValue({ message: 'duplicate key value violates unique constraint "people_penn_email_key"' })
    render(<AddPersonForm nearMatches={vi.fn().mockResolvedValue([])} onAdd={onAdd} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dup' } })
    fireEvent.change(screen.getByLabelText('Grad year'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Penn email'), { target: { value: 'dup@upenn.edu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/people_penn_email_key/)
  })
})
