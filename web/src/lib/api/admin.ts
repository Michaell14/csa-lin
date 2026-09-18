import type { Supabase } from '@/lib/supabase/client'
import type { ChangelogRow, Lin, Link, Person } from '@/lib/types'
import type { NewPerson } from '@/lib/csv'
import type { Database } from '@/lib/database.types'

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
  // The bytes the adoption is about to overwrite, when the survivor's folder
  // already holds an object on that exact path. photo_path being null does not
  // mean the path is free: an upload whose profile update then failed leaves one
  // behind, unreferenced. Held so a failed merge can put it back.
  let displaced: Blob | null = null
  if (dupPhoto && !survivorHasPhoto) {
    const file = `avatar.${dupPhoto.slice(dupPhoto.lastIndexOf('.') + 1)}`
    adopted = `${survivor}/${file}`
    // Listing rather than downloading to find out whether the path is taken: an
    // empty folder is an empty list, so "nothing there" never has to be inferred
    // from a failure. Both calls give up the merge instead of guessing, because
    // guessing "free" here is what would overwrite an object with no way back.
    const { data: folder, error: listError } = await sb.storage.from('photos').list(survivor)
    if (listError) throw listError
    if (folder?.some(o => o.name === file)) {
      const { data: occupant, error: occupantError } = await sb.storage.from('photos').download(adopted)
      if (occupantError) throw occupantError
      displaced = occupant
    }
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
    // Put the survivor's folder back the way the merge found it. Nothing
    // references the copy now and the admin may never retry, so it cannot stay on
    // the avatar path -- but deleting is only right when that path was free.
    // Where it was not, the upsert above overwrote an object this merge never
    // created, and undoing means restoring those bytes rather than removing them.
    if (adopted) {
      const { error: undoError } = displaced
        ? await sb.storage.from('photos').upload(adopted, displaced, { upsert: true, contentType: displaced.type })
        : await sb.storage.from('photos').remove([adopted])
      // Say what was left behind: an admin who is never told will not know the
      // survivor's avatar path is holding a photo that belongs to the duplicate.
      if (undoError) {
        throw new Error(`${error.message} The survivor's photo path (${adopted}) was left holding the copied photo; fix it in Storage.`)
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
