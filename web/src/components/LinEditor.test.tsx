import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lin } from '@/lib/types'
import { LinEditor } from '@/components/LinEditor'

const lin: Lin = { id: 'lin-1', name: 'Dragons', color: '#c63d2f', founder_id: 'f' }

describe('LinEditor', () => {
  it('starts from the lin as it is', () => {
    render(<LinEditor lin={lin} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText('Lin name')).toHaveValue('Dragons')
    expect(screen.getByLabelText('Color')).toHaveValue('#c63d2f')
  })

  it('saves the trimmed name and the colour', async () => {
    const onSave = vi.fn(async () => {})
    render(<LinEditor lin={lin} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Lin name'), { target: { value: '  Phoenix Lin  ' } })
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#123abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ name: 'Phoenix Lin', color: '#123abc' }))
  })

  it('will not save a blank name', () => {
    const onSave = vi.fn(async () => {})
    render(<LinEditor lin={lin} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Lin name'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Edit lin' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows why a save was refused, translated', async () => {
    const onSave = vi.fn(async () => { throw { message: 'duplicate key value violates unique constraint "lins_name_key"' } })
    render(<LinEditor lin={lin} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A lin with that name already exists')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('cancels', () => {
    const onCancel = vi.fn()
    render(<LinEditor lin={lin} onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
