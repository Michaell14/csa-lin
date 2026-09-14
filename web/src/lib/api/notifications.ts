import type { Supabase } from '@/lib/supabase/client'
export type Notification = { id: string; kind: string; message: string; person_id: string | null; read_at: string | null; created_at: string }
export async function listNotifications(sb: Supabase): Promise<Notification[]> { const { data, error } = await sb.from('notifications').select('id, kind, message, person_id, read_at, created_at').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data }
export async function markRead(sb: Supabase, ids: string[]): Promise<void> { if (!ids.length) return; const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null); if (error) throw error }
