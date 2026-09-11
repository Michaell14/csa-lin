import type { Supabase } from '@/lib/supabase/client'
import type { OwnProfilePatch, Person } from '@/lib/types'
import { assertUuid } from '@/lib/ids'

export type PersonHit = Pick<Person, 'id' | 'display_name' | 'grad_year' | 'hidden' | 'major'>

/** Columns any signed-in viewer may see. Contact and auth columns are fetched only for the viewer's own profile. */
export const PUBLIC_PERSON_COLUMNS =
  'id, display_name, grad_year, claimed_at, photo_path, major, hometown, bio, instagram, linkedin, hidden, merged_into, created_at, updated_at'

const PRIVATE_NULLS = { penn_email: null, personal_email: null, auth_user_id: null }

export async function fetchPerson(sb: Supabase, id: string, opts: { includeContact?: boolean } = {}): Promise<Person | null> {
  assertUuid(id, 'person id')
  if (opts.includeContact) {
    const { data, error } = await sb.from('people').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }
  const { data, error } = await sb.from('people').select(PUBLIC_PERSON_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? ({ ...PRIVATE_NULLS, ...data }) : null
}

export async function fetchPeopleByIds(sb: Supabase, ids: string[]): Promise<Person[]> {
  if (ids.length === 0) return []
  ids.forEach(i => assertUuid(i, 'person id'))
  const { data, error } = await sb.from('people').select(PUBLIC_PERSON_COLUMNS).in('id', ids)
  if (error) throw error
  return data.map(row => ({ ...PRIVATE_NULLS, ...row }))
}

export async function searchPeople(sb: Supabase, q: string, limit = 10): Promise<PersonHit[]> {
  const term = q.trim()
  if (!term) return []
  const { data, error } = await sb.from('people')
    .select('id, display_name, grad_year, hidden, major')
    .ilike('display_name', `%${term.replace(/[%_]/g, '')}%`)
    .order('display_name').limit(limit)
  if (error) throw error
  return data
}

export async function updateOwnProfile(sb: Supabase, id: string, patch: OwnProfilePatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}
