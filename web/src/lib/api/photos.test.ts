import { describe, it, expect, vi } from 'vitest'
import { fitWithin, photoExtension, removeStalePhotos, stripPhotoMetadata, uploadOwnPhoto, validatePhoto, type ReencodeEnv } from '@/lib/api/photos'
import type { Supabase } from '@/lib/supabase/client'

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type })

describe('validatePhoto', () => {
  it('accepts a small jpeg', () => expect(validatePhoto(file('image/jpeg', 1000))).toBeNull())
  it('rejects a gif', () => expect(validatePhoto(file('image/gif', 1000))).toMatch(/JPEG, PNG, or WebP/))
  it('rejects over 2 MB', () => expect(validatePhoto(file('image/png', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/))
})

describe('photoExtension', () => {
  it('maps mime types to extensions', () => {
    expect(photoExtension(file('image/jpeg', 1))).toBe('jpg')
    expect(photoExtension(file('image/png', 1))).toBe('png')
    expect(photoExtension(file('image/webp', 1))).toBe('webp')
    expect(photoExtension(file('text/plain', 1))).toBeNull()
  })
})

describe('fitWithin', () => {
  it('shrinks the long edge to the cap', () => expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 }))
  it('never upscales', () => expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 }))
})

function fakeEnv(width: number, height: number, out: (type: string) => Blob | null): ReencodeEnv & { encode: ReturnType<typeof vi.fn> } {
  const close = vi.fn()
  const encode = vi.fn(async (_img: unknown, _w: number, _h: number, type: string) => out(type))
  return { decode: vi.fn(async () => ({ width, height, close })), encode }
}

describe('stripPhotoMetadata', () => {
  it('re-encodes a jpeg from pixels at a capped size', async () => {
    const env = fakeEnv(3000, 1500, type => new Blob(['pixels'], { type }))
    const out = await stripPhotoMetadata(file('image/jpeg', 10), env)
    expect(out.type).toBe('image/jpeg')
    expect(env.encode).toHaveBeenCalledWith(expect.anything(), 1024, 512, 'image/jpeg')
  })
  it('keeps png as png and turns webp into jpeg', async () => {
    const env = fakeEnv(10, 10, type => new Blob([''], { type }))
    expect((await stripPhotoMetadata(file('image/png', 10), env)).type).toBe('image/png')
    expect((await stripPhotoMetadata(file('image/webp', 10), env)).type).toBe('image/jpeg')
  })
  it('fails when the browser cannot encode', async () => {
    await expect(stripPhotoMetadata(file('image/jpeg', 10), fakeEnv(10, 10, () => null))).rejects.toThrow(/process/)
  })
  it('fails when the file is not a decodable image', async () => {
    const env: ReencodeEnv = { decode: async () => { throw new Error('That file is not a readable image') }, encode: async () => null }
    await expect(stripPhotoMetadata(file('image/jpeg', 10), env)).rejects.toThrow(/readable image/)
  })
})

describe('uploadOwnPhoto', () => {
  function fakeStorage() {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const remove = vi.fn().mockResolvedValue({ error: null })
    const sb = { storage: { from: () => ({ upload, remove }) } } as unknown as Supabase
    return { sb, upload, remove }
  }
  it('uploads the re-encoded blob to <id>/avatar.<ext>', async () => {
    const { sb, upload } = fakeStorage()
    const env = fakeEnv(10, 10, type => new Blob(['p'], { type }))
    const path = await uploadOwnPhoto(sb, 'me', file('image/webp', 10), env)
    expect(path).toBe('me/avatar.jpg')
    expect(upload).toHaveBeenCalledWith('me/avatar.jpg', expect.any(Blob), { upsert: true, contentType: 'image/jpeg' })
  })
  it('leaves the avatar photo_path still names in place', async () => {
    const { sb, remove } = fakeStorage()
    const env = fakeEnv(10, 10, type => new Blob(['p'], { type }))
    await uploadOwnPhoto(sb, 'me', file('image/webp', 10), env)
    expect(remove).not.toHaveBeenCalled()
  })
  it('does not upload the original bytes', async () => {
    const { sb, upload } = fakeStorage()
    const original = file('image/jpeg', 500)
    const env = fakeEnv(10, 10, type => new Blob(['tiny'], { type }))
    await uploadOwnPhoto(sb, 'me', original, env)
    const sent = upload.mock.calls[0][1] as Blob
    expect(sent).not.toBe(original)
    expect(sent.size).toBe(4)
  })
  it('rejects a bad type before touching storage', async () => {
    const { sb, upload } = fakeStorage()
    await expect(uploadOwnPhoto(sb, 'me', file('image/gif', 10))).rejects.toThrow(/JPEG, PNG, or WebP/)
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('removeStalePhotos', () => {
  it('clears every other extension once the profile points at the new one', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const sb = { storage: { from: () => ({ remove }) } } as unknown as Supabase
    await removeStalePhotos(sb, 'me', 'me/avatar.jpg')
    expect(remove).toHaveBeenCalledWith(['me/avatar.jpeg', 'me/avatar.png', 'me/avatar.webp'])
  })

  it('warns rather than throws when storage reports the removal failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const remove = vi.fn().mockResolvedValue({ error: new Error('storage down') })
    const sb = { storage: { from: () => ({ remove }) } } as unknown as Supabase
    await expect(removeStalePhotos(sb, 'me', 'me/avatar.jpg')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('warns rather than throws when the removal call itself rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const remove = vi.fn().mockRejectedValue(new Error('offline'))
    const sb = { storage: { from: () => ({ remove }) } } as unknown as Supabase
    await expect(removeStalePhotos(sb, 'me', 'me/avatar.jpg')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
