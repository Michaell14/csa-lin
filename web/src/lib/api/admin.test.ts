import { describe, it, expect, vi } from 'vitest'
import { mergePeople } from '@/lib/api/admin'
import type { Supabase } from '@/lib/supabase/client'

const SURVIVOR = 'aaaaaaaa-0000-4000-8000-000000000001'
const DUPLICATE = 'bbbbbbbb-0000-4000-8000-000000000002'

/** A Supabase double that records the merge's storage and table calls in order. */
function fakeClient(photos: { survivor: string | null; duplicate: string | null }) {
  const calls: string[] = []
  const upload = vi.fn(async (path: string) => { calls.push(`upload:${path}`); return { error: null } })
  const remove = vi.fn(async (paths: string[]): Promise<{ error: Error | null }> => { calls.push(`remove:${paths.join(',')}`); return { error: null } })
  const download = vi.fn(async (path: string) => { calls.push(`download:${path}`); return { data: new Blob(['jpeg'], { type: 'image/jpeg' }), error: null } })
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
    storage: { from: () => ({ download, upload, remove }) },
  } as unknown as Supabase
  return { sb, calls, upload, remove, download }
}

describe('mergePeople', () => {
  it('copies the duplicate avatar over and hands the path to the merge itself', async () => {
    const { sb, calls } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.png` })
    await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(calls).toEqual([
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
