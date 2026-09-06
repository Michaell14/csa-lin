import type { Supabase } from '@/lib/supabase/client'
import type { Lin } from '@/lib/types'

export async function fetchLins(sb: Supabase): Promise<Lin[]> {
  const { data, error } = await sb.from('lins').select('id, name, color, founder_id').order('name')
  if (error) throw error
  return data
}

export async function fetchLinsOf(sb: Supabase, personId: string): Promise<string[]> {
  const { data, error } = await sb.rpc('lins_of', { p: personId })
  if (error) throw error
  return (data ?? []) as string[]
}
