import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Note = { id: string; kind: string; message: string; person_id: null; read_at: null; created_at: string }
const note = (i: number): Note => ({ id: `n${i}`, kind: 'link', message: `note ${i}`, person_id: null, read_at: null, created_at: '2026-09-01T00:00:00Z' })

const api = vi.hoisted(() => ({
  unreadNotificationCount: vi.fn<() => Promise<number>>(),
  listNotifications: vi.fn<() => Promise<Note[]>>(),
  markRead: vi.fn<(sb: unknown, ids: string[]) => Promise<void>>(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/api/notifications', () => api)

import { ActivityInbox } from '@/components/ActivityInbox'

describe('ActivityInbox', () => {
  beforeEach(() => { api.unreadNotificationCount.mockReset(); api.listNotifications.mockReset(); api.markRead.mockReset() })

  it('keeps the badge for unread notifications beyond the loaded page', async () => {
    // 31 unread, but the list endpoint caps at 30: one stays unread after opening.
    api.unreadNotificationCount.mockResolvedValueOnce(31).mockResolvedValueOnce(1)
    api.listNotifications.mockResolvedValue(Array.from({ length: 30 }, (_, i) => note(i)))
    api.markRead.mockResolvedValue()
    render(<ActivityInbox />)
    expect(await screen.findByText('31')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    await waitFor(() => expect(api.markRead).toHaveBeenCalledTimes(1))
    expect(api.markRead.mock.calls[0]![1]).toHaveLength(30)
    expect(await screen.findByText('1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activity, 1 unread' })).toBeInTheDocument()
  })

  it('clears the badge when every unread notification was loaded', async () => {
    api.unreadNotificationCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    api.listNotifications.mockResolvedValue([note(0), note(1)])
    api.markRead.mockResolvedValue()
    render(<ActivityInbox />)
    expect(await screen.findByText('2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument()
  })
})
