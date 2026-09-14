import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const submitCorrection = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/corrections', () => ({ submitCorrection }))

import { ReportIssue } from '@/components/panel/ReportIssue'

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Suggest a correction' }))
const write = (text: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })

describe('ReportIssue', () => {
  beforeEach(() => { submitCorrection.mockReset(); submitCorrection.mockResolvedValue(undefined) })

  // The side panel keeps one ReportIssue mounted as the viewer moves between
  // people, so everything below turns on a rerender rather than a remount.
  it('drops a draft written for one person when the panel moves to the next', async () => {
    const { rerender } = render(<ReportIssue personId="p1" />)
    open()
    write('Wrong grad year on this profile.')
    rerender(<ReportIssue personId="p2" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Suggest a correction' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('files the report against the person on screen after navigation', async () => {
    const { rerender } = render(<ReportIssue personId="p1" />)
    rerender(<ReportIssue personId="p2" />)
    open()
    write('Correct the major on this profile.')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(submitCorrection).toHaveBeenCalledWith(
      expect.anything(), { kind: 'profile', personId: 'p2', details: 'Correct the major on this profile.' }))
  })

  it('lets the next person receive a report after one was just submitted', async () => {
    const { rerender } = render(<ReportIssue personId="p1" />)
    open()
    write('This profile needs a fix.')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText(/admins received your report/)).toBeInTheDocument()
    rerender(<ReportIssue personId="p2" />)
    expect(await screen.findByRole('button', { name: 'Suggest a correction' })).toBeInTheDocument()
  })

  it('offers a missing-person request when no profile is in view', async () => {
    const { rerender } = render(<ReportIssue personId="p1" />)
    rerender(<ReportIssue />)
    fireEvent.click(await screen.findByRole('button', { name: 'Request a missing person' }))
    write('Jane Doe, class of 2025, little of Big One.')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(submitCorrection).toHaveBeenCalledWith(
      expect.anything(), { kind: 'missing_person', personId: undefined, details: 'Jane Doe, class of 2025, little of Big One.' }))
  })
})
