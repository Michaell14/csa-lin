import type { Supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { stripPhotoMetadata, photoExtension, type ReencodeEnv } from './photos'

/** One memory as the timeline shows it: a signed URL per path, in order, or null where signing failed. */
export type Memory = Database['public']['Tables']['lin_memories']['Row'] & { urls: (string | null)[] }
export const MEMORY_PAGE_SIZE = 20
/** Objects one memory can carry; the database enforces the same. */
export const MAX_MEMORY_ITEMS = 5
/** Upload ceiling for a memory object, in bytes; the lin-memories bucket enforces the same. Videos go up as picked, so this is really the video cap. */
export const MAX_MEMORY_BYTES = 25 * 1024 * 1024
/**
 * Photos are re-encoded before upload so storage lasts: a phone photo lands
 * around half a megabyte instead of several. No transparency in a memory, so
 * PNG screenshots become JPEG too, which is where the biggest savings are.
 */
export const PHOTO_LIMITS = { maxEdge: 2048, maxBytes: 8 * 1024 * 1024, quality: 0.82, keepPng: false }

export function mediaKind(path: string): 'image' | 'video' {
  return /\.(mp4|webm)$/.test(path) ? 'video' : 'image'
}
export function validateMemory(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) return 'Choose a JPEG, PNG, WebP photo or MP4/WebM video.'
  if (!file.size) return 'This file is empty.'
  if (file.size > MAX_MEMORY_BYTES) return 'Choose a file smaller than 25 MB.'
  return null
}
export function validateMemorySet(files: File[]): string | null {
  if (!files.length) return 'Choose a photo or video.'
  if (files.length > MAX_MEMORY_ITEMS) return `Choose up to ${MAX_MEMORY_ITEMS} photos or videos.`
  for (const file of files) {
    const problem = validateMemory(file)
    if (problem) return problem
  }
  return null
}
export async function fetchMemories(sb: Supabase, linId: string, offset = 0): Promise<Memory[]> {
  const { data, error } = await sb.from('lin_memories').select('*').eq('lin_id', linId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + MEMORY_PAGE_SIZE - 1)
  if (error) throw error
  if (!data.length) return []
  const signed = await sb.storage.from('lin-memories').createSignedUrls(data.flatMap(row => row.media_paths), 3600)
  if (signed.error) throw signed.error
  const url = (path: string) => signed.data.find(item => item.path === path)?.signedUrl ?? null
  return data.map(row => ({ ...row, urls: row.media_paths.map(url) }))
}
export async function postMemory(sb: Supabase, linId: string, authorId: string, files: File[], caption: string, privateToLin = false, env?: ReencodeEnv): Promise<void> {
  const problem = validateMemorySet(files)
  if (problem) throw new Error(problem)
  if (caption.trim().length > 2000) throw new Error('Keep your caption under 2,000 characters.')
  // Re-encode before touching storage so a bad photo costs no upload.
  const blobs = await Promise.all(files.map(async file => file.type.startsWith('image/') ? await stripPhotoMetadata(file, env, PHOTO_LIMITS) : file))
  const paths = blobs.map(blob => {
    const ext = blob.type.startsWith('image/') ? photoExtension(blob) : blob.type === 'video/mp4' ? 'mp4' : 'webm'
    return `${linId}/${authorId}/${crypto.randomUUID()}.${ext}`
  })
  const bucket = sb.storage.from('lin-memories')
  // Settled, not all: upload reports a storage failure in its result, but were
  // one to reject outright, Promise.all would hand back the failure while the
  // other uploads were still in flight, and whatever landed afterwards would sit
  // in the bucket with no row naming it. Wait every upload out, then clean up.
  const settled = await Promise.allSettled(blobs.map((blob, i) => bucket.upload(paths[i], blob, { contentType: blob.type })))
  const errors: unknown[] = settled.map(result => result.status === 'rejected' ? result.reason : result.value.error)
  const failure = errors.find(Boolean)
  if (failure) {
    const landed = paths.filter((_, i) => !errors[i])
    if (landed.length) await bucket.remove(landed).catch(() => {})
    throw failure
  }
  const result = await sb.from('lin_memories').insert({ lin_id: linId, author_id: authorId, caption: caption.trim(), media_paths: paths, private_to_lin: privateToLin })
  if (result.error) {
    await bucket.remove(paths).catch(() => {})
    throw result.error
  }
}
export async function deleteMemory(sb: Supabase, memory: Memory): Promise<void> {
  const { data, error } = await sb.from('lin_memories').delete().eq('id', memory.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('This memory could not be deleted.')
  const removed = await sb.storage.from('lin-memories').remove(memory.media_paths)
  if (removed.error) console.warn('Could not remove memory media', removed.error)
}
