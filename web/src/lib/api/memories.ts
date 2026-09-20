import type { Supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { stripPhotoMetadata, photoExtension } from './photos'

export type Memory = Database['public']['Tables']['lin_memories']['Row'] & { url: string | null }
export const MEMORY_PAGE_SIZE = 20
export function validateMemory(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) return 'Choose a JPEG, PNG, WebP photo or MP4/WebM video.'
  if (!file.size) return 'This file is empty.'
  if (file.size > 50 * 1024 * 1024) return 'Choose a file smaller than 50 MB.'
  return null
}
export async function fetchMemories(sb: Supabase, linId: string, offset = 0): Promise<Memory[]> {
  const { data, error } = await sb.from('lin_memories').select('*').eq('lin_id', linId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + MEMORY_PAGE_SIZE - 1)
  if (error) throw error
  if (!data.length) return []
  const signed = await sb.storage.from('lin-memories').createSignedUrls(data.map(row => row.media_path), 3600)
  if (signed.error) throw signed.error
  return data.map(row => ({ ...row, url: signed.data.find(item => item.path === row.media_path)?.signedUrl ?? null }))
}
export async function postMemory(sb: Supabase, linId: string, authorId: string, file: File, caption: string, privateToLin = false): Promise<void> {
  const problem = validateMemory(file)
  if (problem) throw new Error(problem)
  if (caption.trim().length > 2000) throw new Error('Keep your caption under 2,000 characters.')
  const isImage = file.type.startsWith('image/')
  const blob = isImage ? await stripPhotoMetadata(file, undefined, { maxEdge: 2560, maxBytes: 50 * 1024 * 1024 }) : file
  const id = crypto.randomUUID()
  const ext = isImage ? photoExtension(blob) : file.type === 'video/mp4' ? 'mp4' : 'webm'
  const path = `${linId}/${authorId}/${id}.${ext}`
  const bucket = sb.storage.from('lin-memories')
  const uploaded = await bucket.upload(path, blob, { contentType: blob.type })
  if (uploaded.error) throw uploaded.error
  const result = await sb.from('lin_memories').insert({ id, lin_id: linId, author_id: authorId, caption: caption.trim(), media_path: path, media_type: isImage ? 'image' : 'video', private_to_lin: privateToLin })
  if (result.error) {
    await bucket.remove([path]).catch(() => {})
    throw result.error
  }
}
export async function deleteMemory(sb: Supabase, memory: Memory): Promise<void> {
  const { data, error } = await sb.from('lin_memories').delete().eq('id', memory.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('This memory could not be deleted.')
  const removed = await sb.storage.from('lin-memories').remove([memory.media_path])
  if (removed.error) console.warn('Could not remove memory media', removed.error)
}
