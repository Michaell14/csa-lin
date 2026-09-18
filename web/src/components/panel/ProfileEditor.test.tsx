import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileEditor } from '@/components/panel/ProfileEditor'
import type { Person } from '@/lib/types'

const me: Person = {
  id: 'me', display_name: 'Derek Zhang', grad_year: 2024, penn_email: 'derek@upenn.edu', personal_email: null, auth_user_id: 'u', personal_auth_user_id: null, claimed_at: '2026-01-01T00:00:00Z',
  photo_path: null, major: 'Econ', hometown: null, bio: null, instagram: null, linkedin: null, hidden: false,
  show_location: true, show_bio_interests: true, show_socials: true, show_professional: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('ProfileEditor', () => {
  it('shows only the retained profile fields and matching visibility controls', () => {
    render(<ProfileEditor person={me} onSave={vi.fn()} onCancel={() => {}} />)
    for (const label of ['Preferred name', 'Pronouns', 'Penn school', 'CSA role', 'Current city', 'Interests / ask me about']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    }
    for (const label of ['Show hometown', 'Show bio', 'Show Instagram', 'Show major and LinkedIn']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument()
    }
  })
  it('submits only changed, allowed fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Hometown'), { target: { value: 'Queens, NY' } })
    fireEvent.change(screen.getByLabelText('Personal email'), { target: { value: 'Derek@Gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ hometown: 'Queens, NY', personal_email: 'derek@gmail.com' }, null))
  })
  it('rejects a bad photo before saving', async () => {
    const onSave = vi.fn()
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    const bad = new File([new Uint8Array(10)], 'x.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [bad] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPEG, PNG, or WebP/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })
  it('shows a save error verbatim', async () => {
    const onSave = vi.fn().mockRejectedValue({ message: 'not allowed to change protected fields' })
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Major'), { target: { value: 'Math' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed to change protected fields')
  })
  it('normalizes socials before saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@derek.z' } })
    fireEvent.change(screen.getByLabelText('LinkedIn URL'), { target: { value: 'www.linkedin.com/in/derek' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ instagram: 'derek.z', linkedin: 'https://www.linkedin.com/in/derek' }, null))
  })
  it('rejects a non-LinkedIn link and a bad handle before saving', async () => {
    const onSave = vi.fn()
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('LinkedIn URL'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/LinkedIn/)
    fireEvent.change(screen.getByLabelText('LinkedIn URL'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: 'not a handle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Instagram/)
    expect(onSave).not.toHaveBeenCalled()
  })
  it('requires a name and a plausible grad year', async () => {
    const onSave = vi.fn()
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/name/i)
    expect(onSave).not.toHaveBeenCalled()
  })
  it('reflects stored privacy settings in the checkboxes', () => {
    // The regression this guards: when the contact view dropped the show_* columns,
    // these arrived undefined and every box rendered unchecked regardless of the stored value.
    const stored: Person = { ...me, show_location: false, show_bio_interests: true, show_socials: false, show_professional: true }
    render(<ProfileEditor person={stored} onSave={vi.fn()} onCancel={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Show hometown' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Show bio' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Show Instagram' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Show major and LinkedIn' })).toBeChecked()
  })
  it('sends only the toggled privacy flag on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileEditor person={me} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show bio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ show_bio_interests: false }, null))
  })
})
