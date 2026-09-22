import type { Supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import type { OwnProfilePatch, Person } from '@/lib/types'
import { assertUuid } from '@/lib/ids'

// `people_with_contact` is `select p.*`, so it must expose every column of
// `people`. A view freezes its column list when it is created, so a migration
// that adds a column to `people` without recreating the view silently drops it
// here. When that happens the regenerated view type loses the key and this
// assertion stops compiling, naming the missing columns -- the failure the
// `data as Person` cast in fetchPerson would otherwise hide until the profile
// editor read `undefined` at runtime. Recreate the view in a migration.
type Assert<T extends true> = T
type ContactViewRow = Database['public']['Views']['people_with_contact']['Row']
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type-only assertion; its evaluation is the check
type _ContactViewCoversPerson = Assert<
  [Exclude<keyof Person, keyof ContactViewRow>] extends [never] ? true : false
>

export type PersonHit = Pick<Person, 'id' | 'display_name' | 'grad_year' | 'hidden'> &
  Partial<Pick<Person, 'major'>>

/**
 * Columns any signed-in viewer may read through the `people_public` view.
 *
 * This is not the list granted on the `people` table itself: the profile
 * columns (major, hometown, bio, ...) were revoked from the table by
 * `..._profile_privacy.sql` and are readable only through the view, which
 * blanks the ones a person has opted out of showing. A query that reads the
 * table directly, including a PostgREST embed such as `people!<fk>(...)`,
 * gets "permission denied for table people" if it names one of them.
 * penn_email, personal_email and auth_user_id are readable only through the
 * `people_with_contact` view (own row for members, every row for admins).
 */
export const PUBLIC_PERSON_COLUMNS =
  'id, display_name, grad_year, claimed_at, photo_path, major, hometown, bio, instagram, linkedin, show_location, show_bio_interests, show_socials, show_professional, show_linkedin, hidden, created_at, updated_at'

const PRIVATE_NULLS = { penn_email: null, personal_email: null, auth_user_id: null, personal_auth_user_id: null }

export async function fetchPerson(sb: Supabase, id: string, opts: { includeContact?: boolean } = {}): Promise<Person | null> {
  assertUuid(id, 'person id')
  if (opts.includeContact) {
    // The view only returns rows the caller may see contact columns for; anyone else gets null here.
    const { data, error } = await sb.from('people_with_contact').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? (data as Person) : null
  }
  const { data, error } = await sb.from('people_public').select(PUBLIC_PERSON_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? ({ ...PRIVATE_NULLS, ...data }) : null
}

export async function fetchPeopleByIds(sb: Supabase, ids: string[]): Promise<Person[]> {
  if (ids.length === 0) return []
  ids.forEach(i => assertUuid(i, 'person id'))
  const { data, error } = await sb.from('people_public').select(PUBLIC_PERSON_COLUMNS).in('id', ids)
  if (error) throw error
  return data.map(row => ({ ...PRIVATE_NULLS, ...row }))
}

/** Match correction submitters to claimed profiles; admins can read these binding columns. */
export async function fetchPeopleByAuthUserIds(sb: Supabase, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  ids.forEach(i => assertUuid(i, 'auth user id'))
  const columns = 'display_name, auth_user_id, personal_auth_user_id' as const
  const [penn, personal] = await Promise.all([
    sb.from('people_with_contact').select(columns).in('auth_user_id', ids),
    sb.from('people_with_contact').select(columns).in('personal_auth_user_id', ids),
  ])
  if (penn.error) throw penn.error
  if (personal.error) throw personal.error
  const requested = new Set(ids)
  const names = new Map<string, string>()
  for (const row of [...penn.data, ...personal.data]) {
    if (!row.display_name) continue
    if (row.auth_user_id && requested.has(row.auth_user_id)) names.set(row.auth_user_id, row.display_name)
    if (row.personal_auth_user_id && requested.has(row.personal_auth_user_id)) names.set(row.personal_auth_user_id, row.display_name)
  }
  return names
}

export async function searchPeople(sb: Supabase, q: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<PersonHit[]> {
  const { limit = 10, signal } = opts
  const term = q.trim()
  if (!term) return []
  // PostgREST parses `.or()` as a grammar, so quote the pattern and escape the
  // two characters that remain structural inside a quoted value.
  const pattern = `"%${term.replace(/[%_]/g, '').replace(/[\\"]/g, '\\$&')}%"`
  let query = sb.from('people_public')
    .select('id, display_name, grad_year, major, hidden')
    .or(['display_name', 'major'].map(column => `${column}.ilike.${pattern}`).join(','))
    .order('display_name').limit(limit)
  // A caller that has moved on (another keystroke) cancels the request rather
  // than letting the database finish a scan nobody will read.
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function updateOwnProfile(sb: Supabase, id: string, patch: OwnProfilePatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}
