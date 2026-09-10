import type { Supabase } from '@/lib/supabase/client'

const MAX_BYTES = 2 * 1024 * 1024
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function photoExtension(file: File): string | null {
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

export async function uploadOwnPhoto(sb: Supabase, personId: string, file: File): Promise<string> {
  const problem = validatePhoto(file)
  if (problem) throw new Error(problem)
  const path = `${personId}/avatar.${photoExtension(file)}`
  const { error } = await sb.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}
