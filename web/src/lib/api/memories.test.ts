import { describe, expect, it, vi } from 'vitest'
import type { Supabase } from '@/lib/supabase/client'
import { postMemory, validateMemory } from './memories'

const video = () => new File(['video'], 'dinner.mp4', { type: 'video/mp4' })
describe('memory uploads', () => {
  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateMemory(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toMatch(/Choose/)
    expect(validateMemory(new File([], 'x.mp4', { type: 'video/mp4' }))).toMatch(/empty/)
    expect(validateMemory({ type: 'video/mp4', size: 52428801 } as File)).toMatch(/50 MB/)
    expect(validateMemory(video())).toBeNull()
  })
  function client(uploadError: unknown = null, insertError: unknown = null) {
    const upload = vi.fn().mockResolvedValue({ error: uploadError })
    const remove = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: insertError })
    return { sb: { storage: { from: () => ({ upload, remove }) }, from: () => ({ insert }) } as unknown as Supabase, upload, remove, insert }
  }
  it('does not publish a post if uploading fails', async () => {
    const c = client(new Error('Upload failed'))
    await expect(postMemory(c.sb, 'lin', 'author', video(), 'Dinner')).rejects.toThrow('Upload failed')
    expect(c.insert).not.toHaveBeenCalled()
  })
  it('cleans up uploaded media if creating the post fails', async () => {
    const c = client(null, new Error('Not a member'))
    await expect(postMemory(c.sb, 'lin', 'author', video(), 'Dinner')).rejects.toThrow('Not a member')
    expect(c.remove).toHaveBeenCalledWith([c.upload.mock.calls[0][0]])
  })
  it('publishes the caption and uploaded video path without a client timestamp', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', video(), '  Dinner together  ')
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ caption: 'Dinner together', media_type: 'video', media_path: c.upload.mock.calls[0][0], private_to_lin: false }))
    expect(c.insert.mock.calls[0][0]).not.toHaveProperty('created_at')
    expect(c.remove).not.toHaveBeenCalled()
  })
  it('marks a lin-only post as private', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', video(), '', true)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ private_to_lin: true }))
  })
})
