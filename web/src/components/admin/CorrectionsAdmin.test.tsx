import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const listCorrections = vi.hoisted(() => vi.fn())
const resolveCorrection = vi.hoisted(() => vi.fn())
const fetchPeopleByIds = vi.hoisted(() => vi.fn())
const fetchPeopleByAuthUserIds = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/corrections', () => ({ listCorrections, resolveCorrection }))
vi.mock('@/lib/api/people', () => ({ fetchPeopleByIds, fetchPeopleByAuthUserIds }))
vi.mock('@/lib/viewer', () => ({
  useViewer: () => ({ loading: false, authUserId: 'u', email: 'a@upenn.edu', personId: 'admin1', isAdmin: true, pendingCount: 0, refresh: vi.fn(), signOut: vi.fn() }),
}))

import { CorrectionsAdmin } from '@/components/admin/CorrectionsAdmin'

const report = (over: Record<string, unknown> = {}) => ({
  id: 'r1', reporter_user_id: 'u1', person_id: 'p4', kind: 'profile', details: 'Grad year is wrong.',
  status: 'pending', created_at: '2026-09-13T00:00:00Z', ...over,
})

describe('CorrectionsAdmin', () => {
  beforeEach(() => {
    listCorrections.mockReset(); resolveCorrection.mockReset(); fetchPeopleByIds.mockReset(); fetchPeopleByAuthUserIds.mockReset()
    resolveCorrection.mockResolvedValue(undefined)
    fetchPeopleByIds.mockResolvedValue([{ id: 'p4', display_name: 'Child One' }])
    fetchPeopleByAuthUserIds.mockResolvedValue(new Map([['u1', 'Reporter One']]))
  })

  it('names the person each report concerns', async () => {
    listCorrections.mockResolvedValue([report(), report({ id: 'r2', person_id: 'p4', kind: 'relationship' })])
    render(<CorrectionsAdmin />)
    await waitFor(() => expect(screen.getAllByText('About: Child One')).toHaveLength(2))
    expect(fetchPeopleByIds).toHaveBeenCalledWith(expect.anything(), ['p4'])
    expect(fetchPeopleByAuthUserIds).toHaveBeenCalledWith(expect.anything(), ['u1'])
    expect(screen.getAllByText(/Submitted by Reporter One/)).toHaveLength(2)
  })

  it('says so when a report names nobody yet', async () => {
    listCorrections.mockResolvedValue([report({ person_id: null, kind: 'missing_person' })])
    fetchPeopleByIds.mockResolvedValue([])
    render(<CorrectionsAdmin />)
    expect(await screen.findByText('About: No profile yet (missing-person request)')).toBeInTheDocument()
  })

  it('falls back to the id when the person cannot be loaded', async () => {
    listCorrections.mockResolvedValue([report({ person_id: 'deadbeef-0000-0000-0000-000000000000' })])
    fetchPeopleByIds.mockResolvedValue([])
    render(<CorrectionsAdmin />)
    expect(await screen.findByText('About: deadbeef')).toBeInTheDocument()
  })

  it('surfaces a decision another admin already made and reloads the queue', async () => {
    listCorrections.mockResolvedValue([report()])
    resolveCorrection.mockRejectedValue(new Error('Another admin already decided this report. Reloading the queue.'))
    render(<CorrectionsAdmin />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mark resolved' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/already decided/)
    await waitFor(() => expect(listCorrections).toHaveBeenCalledTimes(2))
  })
})
