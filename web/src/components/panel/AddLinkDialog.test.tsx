import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddLinkDialog } from '@/components/panel/AddLinkDialog'

const hit = { id: 'p9', display_name: 'Nina Lu', grad_year: 2023, hidden: false }

describe('AddLinkDialog', () => {
  it('proposes after picking a person with no existing link', async () => {
    const search = vi.fn().mockResolvedValue([hit])
    const check = vi.fn().mockResolvedValue(null)
    const onPropose = vi.fn().mockResolvedValue(undefined)
    render(<AddLinkDialog role="big" search={search} check={check} onPropose={onPropose} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nin' } })
    fireEvent.click(await screen.findByRole('option', { name: /Nina Lu/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(onPropose).toHaveBeenCalledWith('p9'))
  })
  it('shows the existing link instead of proposing', async () => {
    const search = vi.fn().mockResolvedValue([hit])
    const check = vi.fn().mockResolvedValue({ id: 'l', big_id: 'p9', little_id: 'me', status: 'confirmed', proposed_by: null, confirmed_by: null, confirmed_at: null, academic_year: null, created_at: '' })
    const onPropose = vi.fn()
    render(<AddLinkDialog role="big" search={search} check={check} onPropose={onPropose} onClose={() => {}} me="me" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nin' } })
    fireEvent.click(await screen.findByRole('option', { name: /Nina Lu/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already confirmed')
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
    expect(onPropose).not.toHaveBeenCalled()
  })
})
