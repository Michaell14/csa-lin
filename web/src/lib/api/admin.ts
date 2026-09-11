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

/** Whether a storage write failed because something already occupies the path. */
function isConflict(e: unknown): boolean {
  const { statusCode, message } = (e ?? {}) as { statusCode?: string; message?: string }
  return statusCode === '409' || /already exists|duplicate/i.test(message ?? '')
}

/**
 * The survivor took an avatar of their own while the merge was copying one onto
 * them. Adopting now would point them at the duplicate's photo instead of the
 * one they just chose, so the merge undoes its copy and asks to be run again.
 */
const RACED = 'The surviving person uploaded a photo while this merge was running. Nothing was changed; merge them again.'

/** What a merge left behind, so the admin hears about it rather than the console. */
export type MergeResult = {
  /** The duplicate's old avatar, when it is still in storage. Nothing references it. */
  leftoverPhoto: string | null
  /** The survivor path that was already taken, when that is why the avatar was not carried over. */
  photoNotAdopted: string | null
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
 *
 * Storage has no transactions to share with that one, so the merge holds to an
 * invariant instead: it only ever creates an object that was not there, and only
 * ever deletes one it created or one the merge itself has just orphaned. An
 * occupied avatar path is never written over. That path may hold an unreferenced
 * leftover, or a photo the survivor uploaded moments ago whose profile update
 * has not landed yet, and storage cannot tell those apart -- so the adoption is
 * abandoned and reported rather than guessed at.
 */
export async function mergePeople(sb: Supabase, survivor: string, duplicate: string): Promise<MergeResult> {
  const { data, error: readError } = await sb.from('people').select('id, photo_path').in('id', [survivor, duplicate])
  if (readError) throw readError
  const dupPhoto = data.find(p => p.id === duplicate)?.photo_path ?? null
  const survivorHasPhoto = Boolean(data.find(p => p.id === survivor)?.photo_path)

  // The path this merge copied the avatar onto, and so may hand to merge_people
  // and take back out again.
  let adopted: string | null = null
  // The survivor path that was already taken, which is what stops an adoption.
  let occupied: string | null = null

  if (dupPhoto && !survivorHasPhoto) {
    const file = `avatar.${dupPhoto.slice(dupPhoto.lastIndexOf('.') + 1)}`
    const target = `${survivor}/${file}`
    // Listing rather than downloading to find out whether the path is taken: an
    // empty folder is an empty list, so "nothing there" never has to be inferred
    // from a failure.
    const { data: folder, error: listError } = await sb.storage.from('photos').list(survivor)
    if (listError) throw listError

    if (folder?.some(o => o.name === file)) {
      occupied = target
    } else {
      const { data: blob, error: downloadError } = await sb.storage.from('photos').download(dupPhoto)
      if (downloadError) throw downloadError
      // upsert stays off so that anything landing on the path between the list
      // above and this write fails the write rather than being replaced by it.
      const { error: uploadError } = await sb.storage.from('photos')
        .upload(target, blob, { upsert: false, contentType: blob.type })
      if (uploadError && !isConflict(uploadError)) throw uploadError
      if (uploadError) occupied = target
      else adopted = target
    }

    // The survivor could also have taken a different extension, which leaves the
    // copy above unopposed but still makes adopting it the wrong move. Their row
    // is the authority on whether they now have an avatar of their own.
    if (adopted) {
      const { data: now, error: recheckError } = await sb.from('people').select('photo_path').eq('id', survivor).maybeSingle()
      if (recheckError || now?.photo_path) {
        const { error: undoError } = await sb.storage.from('photos').remove([adopted])
        if (undoError) throw new Error(`${recheckError?.message ?? RACED} The survivor's photo path (${adopted}) was left holding the copied photo; fix it in Storage.`)
        if (recheckError) throw recheckError
        throw new Error(RACED)
      }
    }
  }

  // Omitted rather than null when there is nothing to adopt: the argument defaults to null in SQL.
  const { error } = await sb.rpc('merge_people', { survivor, duplicate, survivor_photo_path: adopted ?? undefined })
  if (error) {
    // Take the copy back out. Nothing references it now and the admin may never
    // retry, so it cannot stay on the avatar path. Removing is safe to do
    // blindly here in a way overwriting never was: this merge created the
    // object, having found the path free.
    if (adopted) {
      const { error: undoError } = await sb.storage.from('photos').remove([adopted])
      // Say what was left behind: an admin who is never told will not know the
      // survivor's avatar path is holding a photo that belongs to the duplicate.
      if (undoError) {
        throw new Error(`${error.message} The survivor's photo path (${adopted}) was left holding the copied photo; fix it in Storage.`)
      }
    }
    throw error
  }

  if (!dupPhoto) return { leftoverPhoto: null, photoNotAdopted: null }
  // The merge cleared the duplicate's photo_path, so its object is unreferenced
  // and unreadable to members. Where the avatar was carried over the copy stands
  // in for it; where it was not, this is the only copy of that photo and
  // deleting it would be the merge destroying what it declined to move.
  if (occupied) return { leftoverPhoto: dupPhoto, photoNotAdopted: occupied }
  // Report a failed delete rather than failing a merge that has already committed.
  const { error: removeError } = await sb.storage.from('photos').remove([dupPhoto])
  return { leftoverPhoto: removeError ? dupPhoto : null, photoNotAdopted: null }
}

export async function listChangelog(sb: Supabase, opts: { before?: number; limit: number }): Promise<ChangelogRow[]> {
  let query = sb.from('changelog').select('*').order('id', { ascending: false }).limit(opts.limit)
  if (opts.before !== undefined) query = query.lt('id', opts.before)
  const { data, error } = await query
  if (error) throw error
  return data
}
