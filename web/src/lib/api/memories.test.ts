import { describe, expect, it, vi } from 'vitest'
import type { Supabase } from '@/lib/supabase/client'
import { deleteMemory, fetchMemories, mediaKind, postMemory, validateMemory, validateMemorySet, type Memory } from './memories'
import type { ReencodeEnv } from './photos'

const video = (name = 'dinner.mp4') => new File(['video'], name, { type: 'video/mp4' })
describe('memory uploads', () => {
  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateMemory(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toMatch(/Choose/)
    expect(validateMemory(new File([], 'x.mp4', { type: 'video/mp4' }))).toMatch(/empty/)
    expect(validateMemory({ type: 'video/mp4', size: 25 * 1024 * 1024 + 1 } as File)).toMatch(/25 MB/)
    expect(validateMemory(video())).toBeNull()
  })
  it('allows up to five files and names the first bad one', () => {
    expect(validateMemorySet([])).toMatch(/Choose/)
    expect(validateMemorySet(Array.from({ length: 5 }, video))).toBeNull()
    expect(validateMemorySet(Array.from({ length: 6 }, video))).toBe('Choose up to 5 photos or videos.')
    expect(validateMemorySet([video(), new File([], 'x.mp4', { type: 'video/mp4' })])).toMatch(/empty/)
  })
  it('knows a video from a photo by its path', () => {
    expect(mediaKind('lin/me/a.mp4')).toBe('video')
    expect(mediaKind('lin/me/a.webm')).toBe('video')
    expect(mediaKind('lin/me/a.jpg')).toBe('image')
  })
  function client(uploadErrors: unknown[] = [], insertError: unknown = null) {
    const upload = vi.fn().mockImplementation(async () => ({ error: uploadErrors.shift() ?? null }))
    const remove = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: insertError })
    return { sb: { storage: { from: () => ({ upload, remove }) }, from: () => ({ insert }) } as unknown as Supabase, upload, remove, insert }
  }
  it('does not publish a post if any upload fails, and removes the ones that landed', async () => {
    const c = client([null, new Error('Upload failed')])
    await expect(postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], 'Dinner')).rejects.toThrow('Upload failed')
    expect(c.insert).not.toHaveBeenCalled()
    expect(c.remove).toHaveBeenCalledWith([c.upload.mock.calls[0][0]])
  })
  it('cleans up every uploaded object if creating the post fails', async () => {
    const c = client([], new Error('Not a member'))
    await expect(postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], 'Dinner')).rejects.toThrow('Not a member')
    expect(c.remove).toHaveBeenCalledWith([c.upload.mock.calls[0][0], c.upload.mock.calls[1][0]])
  })
  it('publishes the caption and every uploaded path in the order chosen', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], '  Dinner together  ')
    const paths = c.upload.mock.calls.map(call => call[0] as string)
    expect(paths).toHaveLength(2)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ caption: 'Dinner together', media_paths: paths, private_to_lin: false }))
    expect(c.insert.mock.calls[0][0]).not.toHaveProperty('created_at')
    expect(c.insert.mock.calls[0][0]).not.toHaveProperty('media_type')
    expect(c.remove).not.toHaveBeenCalled()
  })
  it('stores every photo as a 2048px jpeg, png included', async () => {
    const c = client()
    const encode = vi.fn(async (_img: unknown, _w: number, _h: number, type: string) => new Blob(['p'], { type }))
    const env: ReencodeEnv = { decode: async () => ({ width: 4096, height: 2048 }), encode }
    await postMemory(c.sb, 'lin', 'author', [new File(['png'], 'shot.png', { type: 'image/png' })], '', false, env)
    expect(encode).toHaveBeenCalledWith(expect.anything(), 2048, 1024, 'image/jpeg', 0.82)
    expect(c.upload.mock.calls[0][0]).toMatch(/\.jpg$/)
  })
  it('rejects a photo that is still over 8 MB after re-encoding', async () => {
    const c = client()
    const env: ReencodeEnv = { decode: async () => ({ width: 10, height: 10 }), encode: async () => ({ size: 8 * 1024 * 1024 + 1, type: 'image/jpeg' } as Blob) }
    await expect(postMemory(c.sb, 'lin', 'author', [new File(['j'], 'x.jpg', { type: 'image/jpeg' })], '', false, env)).rejects.toThrow(/8 MB/)
    expect(c.upload).not.toHaveBeenCalled()
  })
  it('marks a lin-only post as private', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', [video()], '', true)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ private_to_lin: true }))
  })
})

describe('memory timeline', () => {
  const row = (id: string, paths: string[]) => ({ id, lin_id: 'lin', author_id: 'me', caption: '', media_paths: paths, private_to_lin: false, created_at: '2026-09-01T00:00:00Z' })
  it('signs every path on the page in one call and keeps them in order per memory', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [
      { path: 'lin/me/b.jpg', signedUrl: 'B' }, { path: 'lin/me/a.jpg', signedUrl: 'A' }, { path: 'lin/me/c.mp4', signedUrl: 'C' },
    ], error: null })
    const range = vi.fn().mockResolvedValue({ data: [row('1', ['lin/me/a.jpg', 'lin/me/b.jpg']), row('2', ['lin/me/c.mp4', 'lin/me/missing.jpg'])], error: null })
    const query = { select: () => query, eq: () => query, order: () => query, range }
    const sb = { from: () => query, storage: { from: () => ({ createSignedUrls }) } } as unknown as Supabase
    const memories = await fetchMemories(sb, 'lin')
    expect(createSignedUrls).toHaveBeenCalledWith(['lin/me/a.jpg', 'lin/me/b.jpg', 'lin/me/c.mp4', 'lin/me/missing.jpg'], 3600)
    expect(memories[0].urls).toEqual(['A', 'B'])
    expect(memories[1].urls).toEqual(['C', null])
  })
  it('removes every object of a deleted memory', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const select = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
    const sb = { from: () => ({ delete: () => ({ eq: () => ({ select }) }) }), storage: { from: () => ({ remove }) } } as unknown as Supabase
    await deleteMemory(sb, { ...row('1', ['lin/me/a.jpg', 'lin/me/b.jpg']), urls: ['A', 'B'] } as Memory)
    expect(remove).toHaveBeenCalledWith(['lin/me/a.jpg', 'lin/me/b.jpg'])
  })
})
