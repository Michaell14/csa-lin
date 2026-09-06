import { describe, it, expect } from 'vitest'
import { photoExtension, validatePhoto } from '@/lib/api/photos'

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
