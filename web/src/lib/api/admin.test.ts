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
  opts: { strayAtSurvivorPath?: boolean } = {},
) {
  const calls: string[] = []
  const upload = vi.fn(async (path: string) => { calls.push(`upload:${path}`); return { error: null } })
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
  const sb = {
    rpc,
    from: () => ({
      select: () => ({ in: async () => ({ data: [
        { id: SURVIVOR, photo_path: photos.survivor },
        { id: DUPLICATE, photo_path: photos.duplicate },
      ], error: null }) }),
    }),
    storage: { from: () => ({ download, upload, remove, list }) },
  } as unknown as Supabase
  return { sb, calls, upload, remove, download, list }
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
      `remove:${DUPLICATE}/avatar.png`,
    ])
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

  it('restores a stray object the adoption overwrote instead of deleting it when the merge fails', async () => {
    const { sb, remove, upload, download } = fakeClient(
      { survivor: null, duplicate: `${DUPLICATE}/avatar.png` }, { strayAtSurvivorPath: true })
    ;(sb.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: new Error('merge failed') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/merge failed/)
    // The bytes that were on the path go back onto it, and nothing is deleted.
    expect(remove).not.toHaveBeenCalled()
    const displaced = (await download.mock.results[0].value).data
    expect(upload).toHaveBeenLastCalledWith(`${SURVIVOR}/avatar.png`, displaced, expect.anything())
  })

  it('gives up rather than overwriting an object on the path it cannot read', async () => {
    const { sb, upload } = fakeClient(
      { survivor: null, duplicate: `${DUPLICATE}/avatar.png` }, { strayAtSurvivorPath: true })
    ;(sb.storage.from('photos').download as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: null, error: new Error('storage down') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/storage down/)
    expect(upload).not.toHaveBeenCalled()
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
    expect(await mergePeople(sb, SURVIVOR, DUPLICATE)).toEqual({ leftoverPhoto: null })
    expect(calls).toEqual(['rpc:merge_people:none'])
  })

  it('reports a leftover object instead of failing a merge that already committed', async () => {
    const { sb, remove } = fakeClient({ survivor: `${SURVIVOR}/avatar.jpg`, duplicate: `${DUPLICATE}/avatar.png` })
    remove.mockResolvedValue({ error: new Error('storage down') })
    const result = await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(result.leftoverPhoto).toBe(`${DUPLICATE}/avatar.png`)
  })
})
