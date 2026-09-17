import type { Supabase } from '@/lib/supabase/client'

export type CorrectionKind = 'profile' | 'relationship' | 'missing_person'
export type CorrectionRequest = { id: string; reporter_user_id: string; person_id: string | null; kind: CorrectionKind; details: string; status: 'pending' | 'resolved' | 'dismissed'; created_at: string }

export async function submitCorrection(sb: Supabase, input: { kind: CorrectionKind; personId?: string; details: string }): Promise<void> {
  const { error } = await sb.from('correction_requests').insert({ kind: input.kind, person_id: input.personId ?? null, details: input.details.trim() })
  if (error) throw error
}

export async function listCorrections(sb: Supabase): Promise<CorrectionRequest[]> {
  const { data, error } = await sb.from('correction_requests').select('id, reporter_user_id, person_id, kind, details, status, created_at').eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
}

export async function resolveCorrection(sb: Supabase, id: string, status: 'resolved' | 'dismissed', adminId: string): Promise<void> {
  // Only a report that is still pending may be decided. Without the status
  // match, two admins working from stale queues would each overwrite the
  // other's decision, reviewer and timestamp, and both would appear to succeed.
  const { data, error } = await sb.from('correction_requests')
    .update({ status, resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('Another admin already decided this report. Reloading the queue.')
}
