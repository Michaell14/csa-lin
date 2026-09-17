import type { Supabase } from '@/lib/supabase/client'
import type { Lin } from '@/lib/types'
import { assertUuid } from '@/lib/ids'

export async function fetchLins(sb: Supabase): Promise<Lin[]> {
  const { data, error } = await sb.from('lins').select('id, name, color, founder_id').order('name')
  if (error) throw error
  return data
}

/** Counts the same members that the graph draws, including hidden placeholders. */
export async function fetchLinMemberCounts(sb: Supabase): Promise<Record<string, number>> {
  const { data, error } = await sb.rpc('lin_member_counts')
  if (error) throw error
  return Object.fromEntries(data.map(row => [row.lin_id, row.member_count]))
}

export async function fetchLinsOf(sb: Supabase, personId: string): Promise<string[]> {
  assertUuid(personId, 'person id')
  const { data, error } = await sb.rpc('lins_of', { p: personId })
  if (error) throw error
  return (data ?? []) as string[]
}

export type LinPatch = { name?: string; color?: string }

/**
 * Renames or recolours a lin. The database lets only the lin's founder (or an
 * admin) do this; for anyone else the update simply reaches no row, so an
 * empty result is reported as the refusal it is.
 */
export async function updateLin(sb: Supabase, id: string, patch: LinPatch): Promise<void> {
  assertUuid(id, 'lin id')
  const { data, error } = await sb.from('lins').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Only the founder of a lin can edit it')
}
