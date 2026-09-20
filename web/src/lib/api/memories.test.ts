import { describe, expect, it, vi } from 'vitest'
import type { Supabase } from '@/lib/supabase/client'
import { postMemory, validateMemory } from './memories'
import type { ReencodeEnv } from './photos'

const video = () => new File(['video'], 'dinner.mp4', { type: 'video/mp4' })
describe('memory uploads', () => {
  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateMemory(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toMatch(/Choose/)
    expect(validateMemory(new File([], 'x.mp4', { type: 'video/mp4' }))).toMatch(/empty/)
    expect(validateMemory({ type: 'video/mp4', size: 25 * 1024 * 1024 + 1 } as File)).toMatch(/25 MB/)
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
  it('stores every photo as a 2048px jpeg, png included', async () => {
    const c = client()
    const encode = vi.fn(async (_img: unknown, _w: number, _h: number, type: string) => new Blob(['p'], { type }))
    const env: ReencodeEnv = { decode: async () => ({ width: 4096, height: 2048 }), encode }
    await postMemory(c.sb, 'lin', 'author', new File(['png'], 'shot.png', { type: 'image/png' }), '', false, env)
    expect(encode).toHaveBeenCalledWith(expect.anything(), 2048, 1024, 'image/jpeg', 0.82)
    expect(c.upload.mock.calls[0][0]).toMatch(/\.jpg$/)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ media_type: 'image' }))
  })
  it('rejects a photo that is still over 8 MB after re-encoding', async () => {
    const c = client()
    const env: ReencodeEnv = { decode: async () => ({ width: 10, height: 10 }), encode: async () => ({ size: 8 * 1024 * 1024 + 1, type: 'image/jpeg' } as Blob) }
    await expect(postMemory(c.sb, 'lin', 'author', new File(['j'], 'x.jpg', { type: 'image/jpeg' }), '', false, env)).rejects.toThrow(/8 MB/)
    expect(c.upload).not.toHaveBeenCalled()
  })
  it('marks a lin-only post as private', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', video(), '', true)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ private_to_lin: true }))
  })
})
