import { describe, it, expect, vi } from 'vitest'
import { mergePeople } from '@/lib/api/admin'
import type { Supabase } from '@/lib/supabase/client'

const SURVIVOR = 'aaaaaaaa-0000-4000-8000-000000000001'
const DUPLICATE = 'bbbbbbbb-0000-4000-8000-000000000002'

/**
 * A Supabase double that records the merge's storage and table calls in order.
 * `strayAtSurvivorPath` puts an unreferenced object on the survivor's avatar path
 * while photo_path stays null, which is what an upload with a failed profile
 * update leaves behind.
 */
function fakeClient(
  photos: { survivor: string | null; duplicate: string | null },
  opts: { strayAtSurvivorPath?: boolean; survivorPhotoOnRecheck?: string | null } = {},
) {
  const calls: string[] = []
  const upload = vi.fn(async (path: string): Promise<{ error: { statusCode?: string; message: string } | null }> => { calls.push(`upload:${path}`); return { error: null } })
  const remove = vi.fn(async (paths: string[]): Promise<{ error: Error | null }> => { calls.push(`remove:${paths.join(',')}`); return { error: null } })
  const download = vi.fn(async (path: string): Promise<{ data: Blob | null; error: Error | null }> => {
    calls.push(`download:${path}`)
    return { data: new Blob([path], { type: 'image/jpeg' }), error: null }
  })
  const list = vi.fn(async (prefix: string): Promise<{ data: { name: string }[] | null; error: Error | null }> => {
    calls.push(`list:${prefix}`)
    const stray = photos.duplicate ? [{ name: photos.duplicate.slice(photos.duplicate.lastIndexOf('/') + 1) }] : []
    return { data: opts.strayAtSurvivorPath ? stray : [], error: null }
  })
  const rpc = vi.fn(async (_fn: string, args: { survivor_photo_path: string | null }) => {
    calls.push(`rpc:merge_people:${args.survivor_photo_path ?? 'none'}`)
    return { error: null }
  })
  // The survivor's row as the merge reads it back after merge_people has run,
  // which is what says whether the copied path was adopted or a photo of their
  // own won the coalesce. Defaults to the path the merge copied to.
  const recheck = vi.fn(async () => {
    calls.push('readback:survivor')
    const path = 'survivorPhotoOnRecheck' in opts
      ? opts.survivorPhotoOnRecheck
      : (photos.duplicate ? `${SURVIVOR}/${photos.duplicate.slice(photos.duplicate.lastIndexOf('/') + 1)}` : null)
    return { data: { photo_path: path }, error: null as Error | null }
  })
  const sb = {
    rpc,
    from: () => ({
      select: () => ({
        in: async () => ({ data: [
          { id: SURVIVOR, photo_path: photos.survivor },
          { id: DUPLICATE, photo_path: photos.duplicate },
        ], error: null }),
        eq: () => ({ maybeSingle: recheck }),
      }),
    }),
    storage: { from: () => ({ download, upload, remove, list }) },
  } as unknown as Supabase
  return { sb, calls, upload, remove, download, list, recheck, rpc }
}

describe('mergePeople', () => {
  it('copies the duplicate avatar over and hands the path to the merge itself', async () => {
    const { sb, calls } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.png` })
    await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(calls).toEqual([
      `list:${SURVIVOR}`,
      `download:${DUPLICATE}/avatar.png`,
      `upload:${SURVIVOR}/avatar.png`,
      `rpc:merge_people:${SURVIVOR}/avatar.png`,
      'readback:survivor',
      `remove:${DUPLICATE}/avatar.png`,
    ])
  })

  it('gives the path up rather than overwriting a photo that lands on it mid-merge', async () => {
    const { sb, upload, remove } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    // upsert is off on a path that looked free, so the racing object wins.
    upload.mockResolvedValue({ error: { statusCode: '409', message: 'The resource already exists' } })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    // The merge still happens; only the avatar stays where it is, on both ends.
    expect(result).toEqual({ leftoverPhoto: `${DUPLICATE}/avatar.jpg`, photoNotAdopted: `${SURVIVOR}/avatar.jpg` })
    expect(remove).not.toHaveBeenCalled()
  })

  it('passes a storage failure that is not a conflict through as itself', async () => {
    const { sb, upload } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    upload.mockResolvedValue({ error: { statusCode: '500', message: 'storage down' } })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/storage down/)
  })

  it('takes its copy back out when the survivor wins the coalesce mid-merge', async () => {
    // merge_people keeps a photo_path the survivor acquired before it committed,
    // which leaves this merge's copy referenced by nobody.
    const { sb, remove } = fakeClient(
      { survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` },
      { survivorPhotoOnRecheck: `${SURVIVOR}/avatar.png` },
    )
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(remove).toHaveBeenCalledExactlyOnceWith([`${SURVIVOR}/avatar.jpg`])
    // The duplicate's original is the only copy of that photo now, so it stays.
    expect(result).toEqual({ leftoverPhoto: `${DUPLICATE}/avatar.jpg`, photoNotAdopted: `${SURVIVOR}/avatar.jpg` })
  })

  it('deletes nothing when it cannot read back which way the merge went', async () => {
    const { sb, recheck, remove } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    recheck.mockResolvedValue({ data: { photo_path: null }, error: new Error('read failed') })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(remove).not.toHaveBeenCalled()
    expect(result.leftoverPhoto).toBe(`${DUPLICATE}/avatar.jpg`)
  })

  it('takes the copy back out and leaves the duplicate object alone when the merge fails', async () => {
    const { sb, remove } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    ;(sb.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: new Error('merge failed') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/merge failed/)
    expect(remove).toHaveBeenCalledExactlyOnceWith([`${SURVIVOR}/avatar.jpg`])
  })

  it('names the path in the error when the merge fails and undoing the copy fails too', async () => {
    const { sb, remove } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    ;(sb.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: new Error('merge failed') })
    remove.mockResolvedValue({ error: new Error('storage down') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(
      `merge failed The survivor's photo path (${SURVIVOR}/avatar.jpg) was left holding the copied photo; fix it in Storage.`)
  })

  it('leaves an occupied avatar path untouched and keeps both photos', async () => {
    // Storage cannot tell an unreferenced leftover from a photo the survivor
    // uploaded a moment ago, so the merge writes over neither.
    const { sb, calls, upload, remove } = fakeClient(
      { survivor: null, duplicate: `${DUPLICATE}/avatar.png` }, { strayAtSurvivorPath: true })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(upload).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(calls).toEqual([`list:${SURVIVOR}`, 'rpc:merge_people:none'])
    // The duplicate's photo is the only copy of it now, so it is kept and named.
    expect(result).toEqual({ leftoverPhoto: `${DUPLICATE}/avatar.png`, photoNotAdopted: `${SURVIVOR}/avatar.png` })
  })

  it('gives up the merge when it cannot tell whether the path is free', async () => {
    const { sb, upload, rpc } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.png` })
    ;(sb.storage.from('photos').list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: null, error: new Error('storage down') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/storage down/)
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('keeps the survivor photo and drops the duplicate object when both have one', async () => {
    const { sb, calls, upload } = fakeClient({ survivor: `${SURVIVOR}/avatar.jpg`, duplicate: `${DUPLICATE}/avatar.png` })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(upload).not.toHaveBeenCalled()
    expect(calls).toEqual(['rpc:merge_people:none', `remove:${DUPLICATE}/avatar.png`])
    expect(result.leftoverPhoto).toBeNull()
  })

  it('touches storage at all only when the duplicate has a photo', async () => {
    const { sb, calls } = fakeClient({ survivor: null, duplicate: null })
    expect(await mergePeople(sb, SURVIVOR, DUPLICATE)).toEqual({ leftoverPhoto: null, photoNotAdopted: null })
    expect(calls).toEqual(['rpc:merge_people:none'])
  })

  it('reports a leftover object instead of failing a merge that already committed', async () => {
    const { sb, remove } = fakeClient({ survivor: `${SURVIVOR}/avatar.jpg`, duplicate: `${DUPLICATE}/avatar.png` })
    remove.mockResolvedValue({ error: new Error('storage down') })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(result.leftoverPhoto).toBe(`${DUPLICATE}/avatar.png`)
  })
})
