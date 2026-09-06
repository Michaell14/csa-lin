import type { Supabase } from '@/lib/supabase/client'
import type { OwnProfilePatch, Person } from '@/lib/types'

export type PersonHit = Pick<Person, 'id' | 'display_name' | 'grad_year' | 'hidden'>

export async function fetchPerson(sb: Supabase, id: string): Promise<Person | null> {
  const { data, error } = await sb.from('people').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPeopleByIds(sb: Supabase, ids: string[]): Promise<Person[]> {
  if (ids.length === 0) return []
  const { data, error } = await sb.from('people').select('*').in('id', ids)
  if (error) throw error
  return data
}

export async function searchPeople(sb: Supabase, q: string, limit = 10): Promise<PersonHit[]> {
  const term = q.trim()
  if (!term) return []
  const { data, error } = await sb.from('people')
    .select('id, display_name, grad_year, hidden')
    .ilike('display_name', `%${term.replace(/[%_]/g, '')}%`)
    .order('display_name').limit(limit)
  if (error) throw error
  return data
}

export async function updateOwnProfile(sb: Supabase, id: string, patch: OwnProfilePatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}
