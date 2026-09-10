import { describe, it, expect, vi } from 'vitest'
import { mergePeople } from '@/lib/api/admin'
import type { Supabase } from '@/lib/supabase/client'

const SURVIVOR = 'aaaaaaaa-0000-4000-8000-000000000001'
const DUPLICATE = 'bbbbbbbb-0000-4000-8000-000000000002'

/** A Supabase double that records the merge's storage and table calls in order. */
function fakeClient(photos: { survivor: string | null; duplicate: string | null }) {
  const calls: string[] = []
  const update = vi.fn(async (patch: { photo_path: string }) => { calls.push(`update:${patch.photo_path}`); return { error: null } })
  const upload = vi.fn(async (path: string) => { calls.push(`upload:${path}`); return { error: null } })
  const remove = vi.fn(async (paths: string[]) => { calls.push(`remove:${paths.join(',')}`); return { error: null } })
  const download = vi.fn(async (path: string) => { calls.push(`download:${path}`); return { data: new Blob(['jpeg'], { type: 'image/jpeg' }), error: null } })
  const rpc = vi.fn(async () => { calls.push('rpc:merge_people'); return { error: null } })
  const sb = {
    rpc,
    from: () => ({
      select: () => ({ in: async () => ({ data: [
        { id: SURVIVOR, photo_path: photos.survivor },
        { id: DUPLICATE, photo_path: photos.duplicate },
      ], error: null }) }),
      update: (patch: { photo_path: string }) => ({ eq: () => update(patch) }),
    }),
    storage: { from: () => ({ download, upload, remove }) },
  } as unknown as Supabase
  return { sb, calls, update, upload, remove, download }
}

describe('mergePeople', () => {
  it('carries the duplicate avatar into the survivor folder when the survivor has none', async () => {
    const { sb, calls } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.png` })
    await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(calls).toEqual([
      `download:${DUPLICATE}/avatar.png`,
      `upload:${SURVIVOR}/avatar.png`,
      'rpc:merge_people',
      `update:${SURVIVOR}/avatar.png`,
      `remove:${DUPLICATE}/avatar.png`,
    ])
  })

  it('repoints the survivor only after the merge succeeds', async () => {
    const { sb, update, remove } = fakeClient({ survivor: null, duplicate: `${DUPLICATE}/avatar.jpg` })
    ;(sb.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: new Error('merge failed') })
    await expect(mergePeople(sb, SURVIVOR, DUPLICATE)).rejects.toThrow(/merge failed/)
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the survivor photo and drops the duplicate object when both have one', async () => {
    const { sb, upload, update, remove } = fakeClient({ survivor: `${SURVIVOR}/avatar.jpg`, duplicate: `${DUPLICATE}/avatar.png` })
    await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(upload).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith([`${DUPLICATE}/avatar.png`])
  })

  it('touches storage at all only when the duplicate has a photo', async () => {
    const { sb, calls } = fakeClient({ survivor: null, duplicate: null })
    await mergePeople(sb, SURVIVOR, DUPLICATE)
    expect(calls).toEqual(['rpc:merge_people'])
  })
})
