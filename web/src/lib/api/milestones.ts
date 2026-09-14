import type { Supabase } from '@/lib/supabase/client'
export type Milestone = { id: string; lin_id: string; title: string; event_date: string; description: string | null; photo_path: string | null; created_by: string | null; created_at: string }
export async function listMilestones(sb: Supabase, linId?: string): Promise<Milestone[]> { let q = sb.from('lin_milestones').select('*').order('event_date', { ascending: false }); if (linId) q = q.eq('lin_id', linId); const { data, error } = await q; if (error) throw error; return data }
export async function createMilestone(sb: Supabase, input: { lin_id: string; title: string; event_date: string; description: string | null }): Promise<void> { const { error } = await sb.from('lin_milestones').insert(input); if (error) throw error }
export async function deleteMilestone(sb: Supabase, id: string): Promise<void> { const { error } = await sb.from('lin_milestones').delete().eq('id', id); if (error) throw error }
