import type { Supabase } from '@/lib/supabase/client'

const MAX_BYTES = 2 * 1024 * 1024
/** Longest edge of a stored avatar, in pixels. Big enough for the side panel, small enough to keep uploads tiny. */
export const MAX_EDGE = 1024
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const ALL_EXTS = ['jpg', 'jpeg', 'png', 'webp']

export function photoExtension(file: Blob): string | null {
  return EXT[file.type] ?? null
}

export function validatePhoto(file: File): string | null {
  if (!photoExtension(file)) return 'Photo must be a JPEG, PNG, or WebP image'
  if (file.size > MAX_BYTES) return 'Photo must be 2 MB or smaller'
  return null
}

export async function signedPhotoUrls(sb: Supabase, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await sb.storage.from('photos').createSignedUrls(unique, 3600)
  if (error) throw error
  const out = new Map<string, string>()
  for (const row of data) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl)
  return out
}

/** Minimal drawing surface so the re-encode can be unit tested without a real canvas. */
export type ImageSource = { width: number; height: number; close?: () => void }
export type ReencodeEnv = {
  decode: (file: Blob) => Promise<ImageSource>
  encode: (img: ImageSource, width: number, height: number, type: string) => Promise<Blob | null>
}

function browserEnv(): ReencodeEnv {
  return {
    decode: file => new Promise<ImageSource>((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image')) }
      img.src = url
    }),
    encode: (img, width, height, type) => new Promise<Blob | null>(resolve => {
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img as CanvasImageSource, 0, 0, width, height)
      canvas.toBlob(resolve, type, 0.9)
    }),
  }
}

/** Target size for an image so its longest edge is at most MAX_EDGE, never upscaling. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Decodes the picture and re-encodes it from pixels. That drops EXIF and other
 * metadata (camera GPS coordinates included), applies the EXIF orientation, and
 * caps the dimensions. PNG stays PNG so transparency survives; everything else
 * becomes JPEG. Anything that is not really an image fails to decode.
 */
export async function stripPhotoMetadata(file: File, env: ReencodeEnv = browserEnv()): Promise<Blob> {
  const img = await env.decode(file)
  const { width, height } = fitWithin(img.width, img.height)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await env.encode(img, width, height, type)
  img.close?.()
  if (!blob) throw new Error('Could not process that photo')
  if (blob.size > MAX_BYTES) throw new Error('Photo must be 2 MB or smaller')
  return blob
}

/**
 * Uploads a member's avatar as <personId>/avatar.<ext> (the only object the
 * storage policies and the people.photo_path constraint accept). An avatar
 * stored under a different extension is left where it is, because
 * people.photo_path still names it until the profile update lands; the caller
 * clears it with removeStalePhotos once that update has succeeded.
 */
export async function uploadOwnPhoto(sb: Supabase, personId: string, file: File, env?: ReencodeEnv): Promise<string> {
  const problem = validatePhoto(file)
  if (problem) throw new Error(problem)
  const blob = await stripPhotoMetadata(file, env)
  const ext = photoExtension(blob)
  if (!ext) throw new Error('Could not process that photo')
  const path = `${personId}/avatar.${ext}`
  const { error } = await sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: blob.type })
  if (error) throw error
  return path
}

/**
 * Drops the avatars in the person's folder that keepPath has replaced, so the
 * folder holds one photo. Call this only once people.photo_path names keepPath:
 * deleting earlier strands the profile on an object that no longer exists when
 * the update that repoints it fails.
 */
export async function removeStalePhotos(sb: Supabase, personId: string, keepPath: string): Promise<void> {
  const stale = ALL_EXTS.map(e => `${personId}/avatar.${e}`).filter(p => p !== keepPath)
  // Best effort: the profile already points at the new photo, so a leftover is
  // harmless and must not fail a save that has already succeeded. It is still
  // worth saying out loud -- remove() reports a storage failure in the resolved
  // error rather than by rejecting, so the quiet version of this dropped every
  // failure on the floor and let the leftovers pile up unnoticed.
  const { error } = await sb.storage.from('photos').remove(stale)
    .catch((e: unknown) => ({ error: e }))
  if (error) console.warn('Could not remove stale profile photos', error)
}
