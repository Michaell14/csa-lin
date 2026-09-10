import type { Supabase } from '@/lib/supabase/client'
import type { ChangelogRow, Lin, Link, Person } from '@/lib/types'
import type { NewPerson } from '@/lib/csv'
import { PUBLIC_PERSON_COLUMNS } from '@/lib/api/people'

export type AdminPersonPatch = Partial<Pick<Person,
  'display_name' | 'grad_year' | 'penn_email' | 'personal_email' | 'hidden' | 'major' | 'hometown' | 'bio' | 'instagram' | 'linkedin'>>

/** Admin listing including contact columns; reads the admin-only view rather than the table. */
export async function listPeople(sb: Supabase, opts: { q: string; includeHidden: boolean }): Promise<Person[]> {
  let query = sb.from('people_with_contact').select('*').is('merged_into', null).order('grad_year', { ascending: false }).order('display_name')
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

export async function adminUpdatePerson(sb: Supabase, id: string, patch: AdminPersonPatch): Promise<void> {
  const { error } = await sb.from('people').update(patch).eq('id', id)
  if (error) throw error
}

export async function insertConfirmedLink(sb: Supabase, args: { bigId: string; littleId: string; academicYear: string | null }): Promise<void> {
  const { error } = await sb.from('links').insert({ big_id: args.bigId, little_id: args.littleId, status: 'confirmed', academic_year: args.academicYear })
  if (error) throw error
}

export async function listPendingLinks(sb: Supabase): Promise<Link[]> {
  const { data, error } = await sb.from('links').select('*').eq('status', 'pending').order('created_at')
  if (error) throw error
  return data
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

export async function upsertLin(sb: Supabase, lin: { id?: string; name: string; color: string; founder_id: string }): Promise<void> {
  const { error } = lin.id
    ? await sb.from('lins').update({ name: lin.name, color: lin.color, founder_id: lin.founder_id }).eq('id', lin.id)
    : await sb.from('lins').insert({ name: lin.name, color: lin.color, founder_id: lin.founder_id })
  if (error) throw error
}

export async function deleteLin(sb: Supabase, id: string): Promise<void> {
  const { error } = await sb.from('lins').delete().eq('id', id)
  if (error) throw error
}

export type AdminEntry = { person: Pick<Person, 'id' | 'display_name' | 'grad_year'>; granted_at: string }

export async function listAdmins(sb: Supabase): Promise<AdminEntry[]> {
  const { data, error } = await sb.from('admins')
    .select(`granted_at, person:people!admins_person_id_fkey(${PUBLIC_PERSON_COLUMNS})`).order('granted_at')
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

export async function mergePeople(sb: Supabase, survivor: string, duplicate: string): Promise<void> {
  const { error } = await sb.rpc('merge_people', { survivor, duplicate })
  if (error) throw error
}

export async function listChangelog(sb: Supabase, opts: { before?: number; limit: number }): Promise<ChangelogRow[]> {
  let query = sb.from('changelog').select('*').order('id', { ascending: false }).limit(opts.limit)
  if (opts.before !== undefined) query = query.lt('id', opts.before)
  const { data, error } = await query
  if (error) throw error
  return data
}
