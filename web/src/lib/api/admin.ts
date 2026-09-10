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

/** What a merge left behind, so the admin hears about it rather than the console. */
export type MergeResult = {
  /** The duplicate's old avatar, when deleting it failed. Nothing references it; it is only taking space. */
  leftoverPhoto: string | null
}

/**
 * Merges duplicate into survivor and carries the duplicate's avatar over when
 * the survivor has none of its own.
 *
 * merge_people cannot do that part alone: people.photo_path only accepts a path
 * inside the person's own folder, and SQL cannot move a storage object, so the
 * survivor could never be pointed at the duplicate's copy. The bytes are copied
 * here first and the path handed to merge_people, which points the survivor at
 * it in the same transaction that retires the duplicate. There is no window
 * where the merge has committed and the survivor is not pointed at the copy,
 * and a merge that fails takes the copy back out.
 */
export async function mergePeople(sb: Supabase, survivor: string, duplicate: string): Promise<MergeResult> {
  const { data, error: readError } = await sb.from('people').select('id, photo_path').in('id', [survivor, duplicate])
  if (readError) throw readError
  const dupPhoto = data.find(p => p.id === duplicate)?.photo_path ?? null
  const survivorHasPhoto = Boolean(data.find(p => p.id === survivor)?.photo_path)

  let adopted: string | null = null
  if (dupPhoto && !survivorHasPhoto) {
    adopted = `${survivor}/avatar.${dupPhoto.slice(dupPhoto.lastIndexOf('.') + 1)}`
    // A plain storage copy fails when the survivor's folder already holds an
    // unreferenced avatar, so re-upload the bytes with upsert instead.
    const { data: blob, error: downloadError } = await sb.storage.from('photos').download(dupPhoto)
    if (downloadError) throw downloadError
    const { error: uploadError } = await sb.storage.from('photos')
      .upload(adopted, blob, { upsert: true, contentType: blob.type })
    if (uploadError) throw uploadError
  }

  // Omitted rather than null when there is nothing to adopt: the argument defaults to null in SQL.
  const { error } = await sb.rpc('merge_people', { survivor, duplicate, survivor_photo_path: adopted ?? undefined })
  if (error) {
    // Nothing references the copy now, and the admin may never retry. Take it
    // back out rather than leave it sitting in the survivor's folder. If that
    // removal fails too, name the copy in the error: it is unreferenced but it
    // still occupies the avatar path the survivor's next upload would take, and
    // an admin who is never told will not know to clear it.
    if (adopted) {
      const { error: cleanupError } = await sb.storage.from('photos').remove([adopted])
      if (cleanupError) {
        throw new Error(`${error.message} The copied photo (${adopted}) was left behind; remove it in Storage.`)
      }
    }
    throw error
  }

  // The merge cleared the duplicate's photo_path, so its object is unreferenced
  // and unreadable to members whether or not this succeeds. Report the leftover
  // rather than failing a merge that has already committed.
  if (!dupPhoto) return { leftoverPhoto: null }
  const { error: removeError } = await sb.storage.from('photos').remove([dupPhoto])
  return { leftoverPhoto: removeError ? dupPhoto : null }
}

export async function listChangelog(sb: Supabase, opts: { before?: number; limit: number }): Promise<ChangelogRow[]> {
  let query = sb.from('changelog').select('*').order('id', { ascending: false }).limit(opts.limit)
  if (opts.before !== undefined) query = query.lt('id', opts.before)
  const { data, error } = await query
  if (error) throw error
  return data
}
