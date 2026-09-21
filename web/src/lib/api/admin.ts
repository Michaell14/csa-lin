import type { Supabase } from '@/lib/supabase/client'
import type { ChangelogRow, Lin, Link, Person } from '@/lib/types'
import type { NewPerson } from '@/lib/csv'
import type { Database } from '@/lib/database.types'
import { errorMessage } from '@/lib/errors'

export type AdminPersonPatch = Partial<Pick<Person,
  'display_name' | 'grad_year' | 'penn_email' | 'personal_email' | 'hidden' | 'major' | 'hometown' | 'bio' | 'instagram' | 'linkedin'>>

/** Admin listing including contact columns; reads the admin-only view rather than the table. */
export async function listPeople(sb: Supabase, opts: { q: string; includeHidden: boolean }): Promise<Person[]> {
  let query = sb.from('people_with_contact').select('*').order('grad_year', { ascending: false }).order('display_name')
  if (!opts.includeHidden) query = query.eq('hidden', false)
  if (opts.q.trim()) query = query.ilike('display_name', `%${opts.q.trim().replace(/[%_]/g, '')}%`)
  const { data, error } = await query.limit(500)
  if (error) throw error
  return data as Person[]
}

/** Inserts without asking for the rows back: RETURNING the contact columns is not permitted on the table. */
export async function insertPeople(sb: Supabase, rows: NewPerson[]): Promise<void> {
  const { error } = await sb.from('people').insert(rows)
  if (error) throw error
}

export type BulkAddResult = {
  added: number
  duplicates: NewPerson[]
  failed: { person: NewPerson; reason: string }[]
}

function duplicatePennEmail(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505'
    && 'message' in error && typeof error.message === 'string'
    && (error.message.includes('people_penn_email_key') || error.message.includes('people_penn_email_canonical_key')))
}

function rowSpecificError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string') return false
  return error.code.startsWith('22') || error.code.startsWith('23') || error.code === 'P0001'
}

/** PostgreSQL inserts a batch atomically. Split only a failed batch so good
 * rows still get inserted, while an individual duplicate can be reported by
 * name and email. Normal imports take one request per 50 rows. */
export async function insertPeopleNonBlocking(sb: Supabase, rows: NewPerson[]): Promise<BulkAddResult> {
  const result: BulkAddResult = { added: 0, duplicates: [], failed: [] }
  async function insertBatch(batch: NewPerson[]): Promise<void> {
    try {
      await insertPeople(sb, batch)
      result.added += batch.length
    } catch (error) {
      if (batch.length === 1 || !rowSpecificError(error)) {
        if (batch.length === 1 && duplicatePennEmail(error)) result.duplicates.push(batch[0])
        else result.failed.push(...batch.map(person => ({ person, reason: errorMessage(error) })))
        return
      }
      const middle = Math.floor(batch.length / 2)
      await insertBatch(batch.slice(0, middle))
      await insertBatch(batch.slice(middle))
    }
  }
  for (let i = 0; i < rows.length; i += 50) await insertBatch(rows.slice(i, i + 50))
  return result
}

export async function adminUpdatePerson(sb: Supabase, id: string, patch: AdminPersonPatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}

export async function insertConfirmedLink(sb: Supabase, args: { bigId: string; littleId: string }): Promise<void> {
  const { error } = await sb.from('links').insert({ big_id: args.bigId, little_id: args.littleId, status: 'confirmed' })
  if (error) throw error
}

export async function listPendingLinks(sb: Supabase): Promise<Link[]> {
  const { data, error } = await sb.from('links').select('*').eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
}

export type LinkRemovalRequest = Database['public']['Tables']['link_removal_requests']['Row']

export async function listPendingLinkRemovals(sb: Supabase): Promise<LinkRemovalRequest[]> {
  const { data, error } = await sb.from('link_removal_requests').select('*').eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
}

export async function adminResolveLinkRemoval(sb: Supabase, id: string, approve: boolean): Promise<void> {
  const { error } = await sb.rpc('resolve_link_removal_request', { request_id: id, approve })
  if (error) throw error
}

export async function confirmedLinkExists(sb: Supabase, bigId: string, littleId: string): Promise<boolean> {
  const { data, error } = await sb.from('links').select('id')
    .eq('big_id', bigId).eq('little_id', littleId).eq('status', 'confirmed').maybeSingle()
  if (error) throw error
  return data !== null
}

export async function adminRemoveLink(sb: Supabase, bigId: string, littleId: string): Promise<boolean> {
  const { data, error } = await sb.from('links').delete()
    .eq('big_id', bigId).eq('little_id', littleId).eq('status', 'confirmed').select('id')
  if (error) throw error
  return data.length > 0
}

/** Match the pending rows shown in the admin Requests and Corrections tabs. */
export async function fetchAdminQueueCounts(sb: Supabase): Promise<{ requests: number; corrections: number }> {
  const [requests, removals, corrections] = await Promise.all([
    sb.from('links').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('link_removal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('correction_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  if (requests.error) throw requests.error
  if (removals.error) throw removals.error
  if (corrections.error) throw corrections.error
  return { requests: (requests.count ?? 0) + (removals.count ?? 0), corrections: corrections.count ?? 0 }
}

export async function adminResolveLink(sb: Supabase, id: string, decision: 'accept' | 'reject', adminId: string): Promise<void> {
  const { error } = decision === 'accept'
    ? await sb.from('links').update({ status: 'confirmed', confirmed_by: adminId, confirmed_at: new Date().toISOString() }).eq('id', id)
    : await sb.from('links').delete().eq('id', id)
  if (error) throw error
}

export async function listLins(sb: Supabase): Promise<Lin[]> {
  const { data, error } = await sb.from('lins').select('id, name, color, founder_id').order('name')
  if (error) throw error
  return data
}

/** Admins can also found a lin manually for a person without one. */
export async function adminCreateLin(sb: Supabase, lin: { name: string; color: string; founder_id: string }): Promise<void> {
  const { error } = await sb.from('lins').insert(lin)
  if (error) throw error
}

export async function adminUpdateLin(sb: Supabase, lin: { id: string; name: string; color: string; founder_id: string }): Promise<void> {
  const { error } = await sb.from('lins').update({ name: lin.name, color: lin.color, founder_id: lin.founder_id }).eq('id', lin.id)
  if (error) throw error
}

export async function deleteLin(sb: Supabase, id: string): Promise<void> {
  const { error } = await sb.from('lins').delete().eq('id', id)
  if (error) throw error
}

export type AdminEntry = { person: Pick<Person, 'id' | 'display_name' | 'grad_year'>; granted_at: string }

/**
 * Lists admins with the person each row points at.
 *
 * The embed reads the people table itself, not the people_public view, and
 * authenticated holds only a column-list SELECT grant on the table
 * (`..._column_privacy.sql`, narrowed again by `..._profile_privacy.sql`).
 * Naming a column outside that list, such as major or bio, fails the whole
 * request with "permission denied for table people", so the embed asks for
 * exactly the three columns the listing shows.
 */
export async function listAdmins(sb: Supabase): Promise<AdminEntry[]> {
  const { data, error } = await sb.from('admins')
    .select('granted_at, person:people!admins_person_id_fkey(id, display_name, grad_year)').order('granted_at')
  if (error) throw error
  return data.flatMap(r => (r.person ? [{ person: r.person, granted_at: r.granted_at }] : []))
}

export async function promote(sb: Supabase, personId: string, byId: string): Promise<void> {
  const { error } = await sb.from('admins').insert({ person_id: personId, granted_by: byId })
  if (error) throw error
}

export async function demote(sb: Supabase, personId: string): Promise<void> {
  const { error } = await sb.from('admins').delete().eq('person_id', personId)
  if (error) throw error
}

export async function listChangelog(sb: Supabase, opts: { before?: number; limit: number }): Promise<ChangelogRow[]> {
  let query = sb.from('changelog').select('*').order('id', { ascending: false }).limit(opts.limit)
  if (opts.before !== undefined) query = query.lt('id', opts.before)
  const { data, error } = await query
  if (error) throw error
  return data
}
