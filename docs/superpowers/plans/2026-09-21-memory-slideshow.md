# Memory Slideshow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A memory can carry up to five photos or videos, mixed, and the timeline shows a multi-item memory as one card with a slideshow.

**Architecture:** `lin_memories.media_path` + `media_type` become one `media_paths text[]` column so a memory stays one row (one insert, one delete, intrinsic order). Policies check every listed object exists. The client uploads all objects in parallel, then inserts once; a `MemorySlideshow` component renders only the current item so the rest are not downloaded until viewed.

**Tech Stack:** Postgres + Supabase storage policies + pgTAP; Next.js 15 / React 19 / TypeScript; Vitest + Testing Library; Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-21-memory-slideshow-design.md`

## Global Constraints

- Max items per memory: **5**. Min: 1. No duplicate paths.
- Object path pattern (unchanged): `<lin_id>/<author_id>/<uuid>.(jpg|png|mp4|webm)`.
- Member-facing copy for too many files: `Choose up to 5 photos or videos.`
- Per-file validation, image re-encoding, and the 25 MB cap are unchanged from PR #43.
- Slideshow arrows do not wrap. Only the current item is in the DOM.
- Migration file: `supabase/migrations/20260921000001_memory_slideshow.sql`.
- Run web commands from `web/`; run `supabase test db` from the repo root with the local stack up (`supabase start`).
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Schema and policies

**Files:**
- Create: `supabase/migrations/20260921000001_memory_slideshow.sql`
- Modify: `supabase/tests/18_lin_memories.sql`
- Modify: `web/src/lib/database.types.ts:37-41`
- Modify: `supabase/README.md` (memories paragraph, around line 236)

**Interfaces:**
- Produces: column `public.lin_memories.media_paths text[]`; function `public.memory_paths_valid(lin uuid, author uuid, paths text[]) returns boolean`; `public.can_read_memory_media(path text)` now matches any element. Columns `media_path` and `media_type` are gone.

- [ ] **Step 1: Rewrite the pgTAP cases to the new shape and add the new ones**

Replace everything from `select plan(16);` through `select * from finish();` in `supabase/tests/18_lin_memories.sql` with:

```sql
select plan(21);
select is((select file_size_limit from storage.buckets where id = 'lin-memories'), 26214400::bigint, '25 MB upload limit on memories');
select tests.login('00000000-0000-0000-0000-000000000002');
select ok(public.can_access_lin_memories('00000000-0000-0000-0000-0000000000a1'), 'descendant can access memories');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg')$$, 'member can upload');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000099.jpg'],'Dinner')$$, 'member can publish uploaded media');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,created_at) values ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['invalid'],now())$$, '42501', null, 'cannot forge posting date');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg')$$, 'member can upload private media');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption,private_to_lin) values ('00000000-0000-0000-0000-000000000097','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array['00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000097.jpg'],'Lin only',true)$$, 'member can publish a lin-only memory');
-- A memory can carry up to five objects, every one of which must exist. Row
-- security runs before table constraints, so the six-item case lists six real
-- objects to reach the constraint, and the missing-object case lists one that
-- was never uploaded to reach the policy.
select lives_ok($$insert into storage.objects(bucket_id,name) values
  ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm'), ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000056.jpg')$$, 'member can upload six objects');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000056.jpg'],'Six')$$, '23514', null, 'six items are rejected');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000057.jpg'],'Missing')$$, '42501', null, 'a memory cannot list an object that was never uploaded');
select throws_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg'],'Twice')$$, '23514', null, 'the same object cannot appear twice');
select lives_ok($$insert into public.lin_memories(id,lin_id,author_id,media_paths,caption) values ('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',array[
  '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000051.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000052.png', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000053.mp4', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000054.jpg', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000055.webm'],'Five')$$, 'member can publish a five-item memory');
-- An upload whose publish never landed, or whose row was deleted while storage
-- cleanup failed, is readable by its uploader only.
select lives_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000096.jpg')$$, 'member can upload media before publishing');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),9::bigint,'uploader can read their own unpublished media');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.lin_memories),3::bigint,'fellow member can read public and private memories');
select is(tests.rows_affected('delete from public.lin_memories'),0,'fellow member cannot delete');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),7::bigint,'fellow member reads every published object and no unpublished one');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000011');
select is((select count(*) from public.lin_memories),2::bigint,'other lin can read public but not private memories');
select is((select count(*) from storage.objects where bucket_id='lin-memories'),6::bigint,'other lin can read public but not private media');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('lin-memories','00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-000000000011/00000000-0000-0000-0000-000000000098.jpg')$$,'42501',null,'other lin cannot upload');
select tests.logout();
select tests.login('00000000-0000-0000-0000-000000000002');
select is(tests.rows_affected('delete from public.lin_memories'),3,'author can delete own posts');
select tests.logout();
select * from finish();
```

- [ ] **Step 2: Run the DB tests to watch them fail**

Run from the repo root: `supabase test db 2>&1 | grep -E "18_lin|not ok|Failed"`
Expected: `18_lin_memories.sql` fails because column `media_paths` does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260921000001_memory_slideshow.sql`:

```sql
-- A memory carries up to five photos or videos, in display order, as one
-- row: one insert publishes atomically and one delete removes the post.
-- Each path's extension says what it is, so media_type goes away.
alter table public.lin_memories add column media_paths text[];
update public.lin_memories set media_paths = array[media_path];
alter table public.lin_memories alter column media_paths set not null;

-- Every path belongs to this lin and author, is a fresh object id with an
-- allowed extension, and appears once. Immutable so a check can call it.
create function public.memory_paths_valid(lin uuid, author uuid, paths text[]) returns boolean
language sql immutable as $$
  select coalesce(array_length(paths, 1), 0) between 1 and 5
    and (select count(distinct p) from unnest(paths) p) = array_length(paths, 1)
    and not exists (
      select 1 from unnest(paths) p
      where p !~ ('^' || lin::text || '/' || author::text || '/[0-9a-f-]{36}\.(jpg|png|mp4|webm)$')
    );
$$;

drop policy memories_insert on public.lin_memories;
create policy memories_insert on public.lin_memories for insert to authenticated
  with check (author_id = public.current_person_id() and public.can_access_lin_memories(lin_id)
    and not exists (
      select 1 from unnest(media_paths) p
      where not exists (select 1 from storage.objects where bucket_id = 'lin-memories' and name = p)
    ));

create or replace function public.can_read_memory_media(path text) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lin_memories m
    where m.media_paths @> array[path]
      and (not m.private_to_lin or public.can_access_lin_memories(m.lin_id))
  );
$$;

alter table public.lin_memories drop constraint lin_memories_check;
alter table public.lin_memories drop column media_path;
alter table public.lin_memories drop column media_type;
alter table public.lin_memories
  add constraint lin_memories_media_paths_check check (public.memory_paths_valid(lin_id, author_id, media_paths));
create index lin_memories_media_paths on public.lin_memories using gin (media_paths);
grant insert (media_paths) on public.lin_memories to authenticated;
```

- [ ] **Step 4: Apply and run the DB tests**

Run from the repo root: `supabase db reset 2>&1 | tail -2 && supabase test db 2>&1 | grep -vE "NOTICE" | grep -E "not ok|Failed|Result"`
Expected: `Result: PASS`, no `not ok` lines.

- [ ] **Step 5: Update the hand-maintained types and the README**

In `web/src/lib/database.types.ts` replace the `lin_memories` block with:

```ts
      lin_memories: {
        Row: { id: string; lin_id: string; author_id: string; caption: string; media_paths: string[]; private_to_lin: boolean; created_at: string }
        Insert: { id?: string; lin_id: string; author_id: string; caption?: string; media_paths: string[]; private_to_lin?: boolean; created_at?: string }
        Update: { caption?: string; private_to_lin?: boolean }
```

Add to `Functions`, after `can_read_memory_media`:

```ts
      memory_paths_valid: { Args: { lin: string; author: string; paths: string[] }; Returns: boolean }
```

In `supabase/README.md`, change "Each post holds one photo
or video" to "Each post holds one to five photos or videos
(`20260921000001_memory_slideshow.sql`), shown as a slideshow".

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260921000001_memory_slideshow.sql supabase/tests/18_lin_memories.sql web/src/lib/database.types.ts supabase/README.md
git commit -m "Let a memory carry up to five objects

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Client API for multi-item memories

**Files:**
- Modify: `web/src/lib/api/memories.ts`
- Modify: `web/src/lib/api/memories.test.ts`

**Interfaces:**
- Consumes: `lin_memories.media_paths: string[]` from Task 1.
- Produces:
  - `export const MAX_MEMORY_ITEMS = 5`
  - `export type Memory = Row & { urls: (string | null)[] }`
  - `export function mediaKind(path: string): 'image' | 'video'`
  - `export function validateMemorySet(files: File[]): string | null`
  - `export async function postMemory(sb, linId, authorId, files: File[], caption, privateToLin = false, env?)`
  - `fetchMemories` and `deleteMemory` keep their signatures.

- [ ] **Step 1: Write the failing tests**

Replace `web/src/lib/api/memories.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Supabase } from '@/lib/supabase/client'
import { deleteMemory, fetchMemories, mediaKind, postMemory, validateMemory, validateMemorySet, type Memory } from './memories'
import type { ReencodeEnv } from './photos'

const video = (name = 'dinner.mp4') => new File(['video'], name, { type: 'video/mp4' })
describe('memory uploads', () => {
  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateMemory(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toMatch(/Choose/)
    expect(validateMemory(new File([], 'x.mp4', { type: 'video/mp4' }))).toMatch(/empty/)
    expect(validateMemory({ type: 'video/mp4', size: 25 * 1024 * 1024 + 1 } as File)).toMatch(/25 MB/)
    expect(validateMemory(video())).toBeNull()
  })
  it('allows up to five files and names the first bad one', () => {
    expect(validateMemorySet([])).toMatch(/Choose/)
    expect(validateMemorySet(Array.from({ length: 5 }, video))).toBeNull()
    expect(validateMemorySet(Array.from({ length: 6 }, video))).toBe('Choose up to 5 photos or videos.')
    expect(validateMemorySet([video(), new File([], 'x.mp4', { type: 'video/mp4' })])).toMatch(/empty/)
  })
  it('knows a video from a photo by its path', () => {
    expect(mediaKind('lin/me/a.mp4')).toBe('video')
    expect(mediaKind('lin/me/a.webm')).toBe('video')
    expect(mediaKind('lin/me/a.jpg')).toBe('image')
  })
  function client(uploadErrors: unknown[] = [], insertError: unknown = null) {
    const upload = vi.fn().mockImplementation(async () => ({ error: uploadErrors.shift() ?? null }))
    const remove = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: insertError })
    return { sb: { storage: { from: () => ({ upload, remove }) }, from: () => ({ insert }) } as unknown as Supabase, upload, remove, insert }
  }
  it('does not publish a post if any upload fails, and removes the ones that landed', async () => {
    const c = client([null, new Error('Upload failed')])
    await expect(postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], 'Dinner')).rejects.toThrow('Upload failed')
    expect(c.insert).not.toHaveBeenCalled()
    expect(c.remove).toHaveBeenCalledWith([c.upload.mock.calls[0][0]])
  })
  it('cleans up every uploaded object if creating the post fails', async () => {
    const c = client([], new Error('Not a member'))
    await expect(postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], 'Dinner')).rejects.toThrow('Not a member')
    expect(c.remove).toHaveBeenCalledWith([c.upload.mock.calls[0][0], c.upload.mock.calls[1][0]])
  })
  it('publishes the caption and every uploaded path in the order chosen', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', [video('a.mp4'), video('b.mp4')], '  Dinner together  ')
    const paths = c.upload.mock.calls.map(call => call[0] as string)
    expect(paths).toHaveLength(2)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ caption: 'Dinner together', media_paths: paths, private_to_lin: false }))
    expect(c.insert.mock.calls[0][0]).not.toHaveProperty('created_at')
    expect(c.insert.mock.calls[0][0]).not.toHaveProperty('media_type')
    expect(c.remove).not.toHaveBeenCalled()
  })
  it('stores every photo as a 2048px jpeg, png included', async () => {
    const c = client()
    const encode = vi.fn(async (_img: unknown, _w: number, _h: number, type: string) => new Blob(['p'], { type }))
    const env: ReencodeEnv = { decode: async () => ({ width: 4096, height: 2048 }), encode }
    await postMemory(c.sb, 'lin', 'author', [new File(['png'], 'shot.png', { type: 'image/png' })], '', false, env)
    expect(encode).toHaveBeenCalledWith(expect.anything(), 2048, 1024, 'image/jpeg', 0.82)
    expect(c.upload.mock.calls[0][0]).toMatch(/\.jpg$/)
  })
  it('rejects a photo that is still over 8 MB after re-encoding', async () => {
    const c = client()
    const env: ReencodeEnv = { decode: async () => ({ width: 10, height: 10 }), encode: async () => ({ size: 8 * 1024 * 1024 + 1, type: 'image/jpeg' } as Blob) }
    await expect(postMemory(c.sb, 'lin', 'author', [new File(['j'], 'x.jpg', { type: 'image/jpeg' })], '', false, env)).rejects.toThrow(/8 MB/)
    expect(c.upload).not.toHaveBeenCalled()
  })
  it('marks a lin-only post as private', async () => {
    const c = client()
    await postMemory(c.sb, 'lin', 'author', [video()], '', true)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ private_to_lin: true }))
  })
})

describe('memory timeline', () => {
  const row = (id: string, paths: string[]) => ({ id, lin_id: 'lin', author_id: 'me', caption: '', media_paths: paths, private_to_lin: false, created_at: '2026-09-01T00:00:00Z' })
  it('signs every path on the page in one call and keeps them in order per memory', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [
      { path: 'lin/me/b.jpg', signedUrl: 'B' }, { path: 'lin/me/a.jpg', signedUrl: 'A' }, { path: 'lin/me/c.mp4', signedUrl: 'C' },
    ], error: null })
    const range = vi.fn().mockResolvedValue({ data: [row('1', ['lin/me/a.jpg', 'lin/me/b.jpg']), row('2', ['lin/me/c.mp4', 'lin/me/missing.jpg'])], error: null })
    const query = { select: () => query, eq: () => query, order: () => query, range }
    const sb = { from: () => query, storage: { from: () => ({ createSignedUrls }) } } as unknown as Supabase
    const memories = await fetchMemories(sb, 'lin')
    expect(createSignedUrls).toHaveBeenCalledWith(['lin/me/a.jpg', 'lin/me/b.jpg', 'lin/me/c.mp4', 'lin/me/missing.jpg'], 3600)
    expect(memories[0].urls).toEqual(['A', 'B'])
    expect(memories[1].urls).toEqual(['C', null])
  })
  it('removes every object of a deleted memory', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const select = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
    const sb = { from: () => ({ delete: () => ({ eq: () => ({ select }) }) }), storage: { from: () => ({ remove }) } } as unknown as Supabase
    await deleteMemory(sb, { ...row('1', ['lin/me/a.jpg', 'lin/me/b.jpg']), urls: ['A', 'B'] } as Memory)
    expect(remove).toHaveBeenCalledWith(['lin/me/a.jpg', 'lin/me/b.jpg'])
  })
})
```

- [ ] **Step 2: Run to watch it fail**

Run from `web/`: `npx vitest run src/lib/api/memories.test.ts`
Expected: FAIL. `validateMemorySet` and `mediaKind` are not exported; `postMemory` treats the array as a file.

- [ ] **Step 3: Implement**

Replace `web/src/lib/api/memories.ts` with:

```ts
import type { Supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { stripPhotoMetadata, photoExtension, type ReencodeEnv } from './photos'

/** One memory as the timeline shows it: a signed URL per path, in order, or null where signing failed. */
export type Memory = Database['public']['Tables']['lin_memories']['Row'] & { urls: (string | null)[] }
export const MEMORY_PAGE_SIZE = 20
/** Objects one memory can carry; the database enforces the same. */
export const MAX_MEMORY_ITEMS = 5
/** Upload ceiling for a memory object, in bytes; the lin-memories bucket enforces the same. Videos go up as picked, so this is really the video cap. */
export const MAX_MEMORY_BYTES = 25 * 1024 * 1024
/**
 * Photos are re-encoded before upload so storage lasts: a phone photo lands
 * around half a megabyte instead of several. No transparency in a memory, so
 * PNG screenshots become JPEG too, which is where the biggest savings are.
 */
export const PHOTO_LIMITS = { maxEdge: 2048, maxBytes: 8 * 1024 * 1024, quality: 0.82, keepPng: false }

export function mediaKind(path: string): 'image' | 'video' {
  return /\.(mp4|webm)$/.test(path) ? 'video' : 'image'
}
export function validateMemory(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) return 'Choose a JPEG, PNG, WebP photo or MP4/WebM video.'
  if (!file.size) return 'This file is empty.'
  if (file.size > MAX_MEMORY_BYTES) return 'Choose a file smaller than 25 MB.'
  return null
}
export function validateMemorySet(files: File[]): string | null {
  if (!files.length) return 'Choose a photo or video.'
  if (files.length > MAX_MEMORY_ITEMS) return `Choose up to ${MAX_MEMORY_ITEMS} photos or videos.`
  for (const file of files) {
    const problem = validateMemory(file)
    if (problem) return problem
  }
  return null
}
export async function fetchMemories(sb: Supabase, linId: string, offset = 0): Promise<Memory[]> {
  const { data, error } = await sb.from('lin_memories').select('*').eq('lin_id', linId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + MEMORY_PAGE_SIZE - 1)
  if (error) throw error
  if (!data.length) return []
  const signed = await sb.storage.from('lin-memories').createSignedUrls(data.flatMap(row => row.media_paths), 3600)
  if (signed.error) throw signed.error
  const url = (path: string) => signed.data.find(item => item.path === path)?.signedUrl ?? null
  return data.map(row => ({ ...row, urls: row.media_paths.map(url) }))
}
export async function postMemory(sb: Supabase, linId: string, authorId: string, files: File[], caption: string, privateToLin = false, env?: ReencodeEnv): Promise<void> {
  const problem = validateMemorySet(files)
  if (problem) throw new Error(problem)
  if (caption.trim().length > 2000) throw new Error('Keep your caption under 2,000 characters.')
  // Re-encode before touching storage so a bad photo costs no upload.
  const blobs = await Promise.all(files.map(async file => file.type.startsWith('image/') ? await stripPhotoMetadata(file, env, PHOTO_LIMITS) : file))
  const paths = blobs.map(blob => {
    const ext = blob.type.startsWith('image/') ? photoExtension(blob) : blob.type === 'video/mp4' ? 'mp4' : 'webm'
    return `${linId}/${authorId}/${crypto.randomUUID()}.${ext}`
  })
  const bucket = sb.storage.from('lin-memories')
  const results = await Promise.all(blobs.map((blob, i) => bucket.upload(paths[i], blob, { contentType: blob.type })))
  const landed = paths.filter((_, i) => !results[i].error)
  const failed = results.find(result => result.error)
  if (failed?.error) {
    if (landed.length) await bucket.remove(landed).catch(() => {})
    throw failed.error
  }
  const result = await sb.from('lin_memories').insert({ lin_id: linId, author_id: authorId, caption: caption.trim(), media_paths: paths, private_to_lin: privateToLin })
  if (result.error) {
    await bucket.remove(paths).catch(() => {})
    throw result.error
  }
}
export async function deleteMemory(sb: Supabase, memory: Memory): Promise<void> {
  const { data, error } = await sb.from('lin_memories').delete().eq('id', memory.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('This memory could not be deleted.')
  const removed = await sb.storage.from('lin-memories').remove(memory.media_paths)
  if (removed.error) console.warn('Could not remove memory media', removed.error)
}
```

Note: `id` is no longer generated client-side; the database default supplies it, and the object ids are independent uuids. The `photoExtension` import needs the blob's type, which the re-encoder sets.

- [ ] **Step 4: Run the tests**

Run from `web/`: `npx vitest run src/lib/api/memories.test.ts && npx tsc --noEmit`
Expected: memories tests PASS. `tsc` reports errors only in `LinMemories.tsx` and `LinMemories.test.tsx` (`media_type`, `url`, single `File`); Task 4 fixes those.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/memories.ts web/src/lib/api/memories.test.ts
git commit -m "Post and read memories with several objects

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: MemorySlideshow component

**Files:**
- Create: `web/src/components/MemorySlideshow.tsx`
- Create: `web/src/components/MemorySlideshow.test.tsx`

**Interfaces:**
- Consumes: `mediaKind(path)` from Task 2; `ChevronLeftIcon`, `ChevronRightIcon` from `web/src/components/icons.tsx`.
- Produces: `export function MemorySlideshow({ paths, urls, alt }: { paths: string[]; urls: (string | null)[]; alt: string })`.

- [ ] **Step 1: Write the failing tests**

`web/src/components/MemorySlideshow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemorySlideshow } from './MemorySlideshow'

const paths = ['lin/me/a.jpg', 'lin/me/b.mp4', 'lin/me/c.jpg']
const urls = ['A', 'B', 'C']
it('shows one item at a time with a counter', () => {
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  expect(screen.getByRole('img', { name: 'Dinner (1 of 3)' })).toHaveAttribute('src', 'A')
  expect(screen.queryByText('2 of 3')).not.toBeInTheDocument()
  expect(screen.getByText('1 of 3')).toBeInTheDocument()
  expect(document.querySelectorAll('img, video')).toHaveLength(1)
})
it('steps with the arrows and does not wrap', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(document.querySelector('video')).toHaveAttribute('src', 'B')
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(screen.getByRole('img', { name: 'Dinner (3 of 3)' })).toHaveAttribute('src', 'C')
})
it('steps with the arrow keys while focused', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  screen.getByRole('group', { name: 'Dinner, 3 items' }).focus()
  await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowLeft}')
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
})
it('jumps to an item from its dot', async () => {
  const user = userEvent.setup()
  render(<MemorySlideshow paths={paths} urls={urls} alt="Dinner" />)
  await user.click(screen.getByRole('button', { name: 'Go to item 3' }))
  expect(screen.getByText('3 of 3')).toBeInTheDocument()
})
it('says when an item is unavailable', () => {
  render(<MemorySlideshow paths={paths} urls={[null, 'B', 'C']} alt="Dinner" />)
  expect(screen.getByText(/unavailable/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to watch it fail**

Run from `web/`: `npx vitest run src/components/MemorySlideshow.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`web/src/components/MemorySlideshow.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { mediaKind } from '@/lib/api/memories'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/**
 * One item of a memory at a time. Only the current item is in the DOM, so the
 * others are not downloaded until viewed, which keeps egress flat next to a
 * single-photo post. Arrows and dots move; ArrowLeft/ArrowRight work while the
 * group has focus. Nothing wraps, so the ends are obvious.
 */
export function MemorySlideshow({ paths, urls, alt }: { paths: string[]; urls: (string | null)[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const count = paths.length
  const url = urls[index]
  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)))
  const label = `${alt} (${index + 1} of ${count})`
  const arrow = 'absolute top-1/2 -translate-y-1/2 rounded-full border border-line bg-white/90 p-1.5 text-ink shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30'
  return <div role="group" aria-label={`${alt}, ${count} items`} tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1) }
    }}
    className="relative focus-visible:outline-2 focus-visible:outline-accent">
    {url ? mediaKind(paths[index]) === 'video'
      ? <video key={paths[index]} controls preload="metadata" src={url} aria-label={label} className="max-h-80 w-full bg-black" />
      /* eslint-disable-next-line @next/next/no-img-element */
      : <img key={paths[index]} src={url} alt={label} className="max-h-80 w-full object-contain" />
      : <p className="p-6 text-sm">Media unavailable. Refresh the timeline to try again.</p>}
    <button type="button" aria-label="Previous" disabled={index === 0} onClick={() => go(index - 1)} className={`${arrow} left-2`}><ChevronLeftIcon size={18} /></button>
    <button type="button" aria-label="Next" disabled={index === count - 1} onClick={() => go(index + 1)} className={`${arrow} right-2`}><ChevronRightIcon size={18} /></button>
    <div className="flex items-center justify-center gap-2 py-2">
      <span className="text-xs tabular-nums text-ink-muted">{index + 1} of {count}</span>
      <div className="flex gap-1.5">{paths.map((path, i) => <button key={path} type="button" aria-label={`Go to item ${i + 1}`} aria-current={i === index || undefined} onClick={() => go(i)} className={`h-2 w-2 rounded-full ${i === index ? 'bg-ink' : 'bg-line hover:bg-ink-muted'}`} />)}</div>
    </div>
  </div>
}
```

- [ ] **Step 4: Run the tests**

Run from `web/`: `npx vitest run src/components/MemorySlideshow.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MemorySlideshow.tsx web/src/components/MemorySlideshow.test.tsx
git commit -m "Add the memory slideshow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Multi-file picker and slideshow in the timeline

**Files:**
- Modify: `web/src/components/LinMemories.tsx`
- Modify: `web/src/components/LinMemories.test.tsx`

**Interfaces:**
- Consumes: `postMemory(sb, linId, authorId, files: File[], caption, privateToLin)`, `validateMemory`, `validateMemorySet`, `mediaKind`, `MAX_MEMORY_ITEMS`, `Memory.urls` from Task 2; `MemorySlideshow` from Task 3.

- [ ] **Step 1: Update the component tests**

In `web/src/components/LinMemories.test.tsx`:

Change the fixture at line 58 to the new row shape:

```ts
  const memory = (id: string, paths = [`lin/person/${id}.jpg`]) => ({ id, lin_id: 'lin', author_id: 'person', caption: id, media_paths: paths, created_at: '2026-09-01T12:00:00.000Z', private_to_lin: false, urls: paths.map(p => `blob:${p}`) })
```

In the first test, change the `postMemory` expectation to an array:

```ts
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(mocks.client, 'lin', 'person', [file], 'Dinner together', false))
```

Do the same for any other `mocks.post` expectation in the file (wrap the file argument in `[...]`).

Add these tests at the end of the file:

```tsx
it('lets a member pick several files, drop one, and share the rest', async () => {
  const user = userEvent.setup()
  render(<LinMemories lin={lin} />)
  await screen.findByText('No memories yet')
  const files = ['a', 'b', 'c'].map(n => new File([n], `${n}.jpg`, { type: 'image/jpeg' }))
  await user.upload(screen.getByLabelText('Photos or videos'), files)
  expect(screen.getAllByRole('img', { name: /preview/i })).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Remove b.jpg' }))
  expect(screen.getAllByRole('img', { name: /preview/i })).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Share memory' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(mocks.client, 'lin', 'person', [files[0], files[2]], '', false))
})
it('refuses more than five files', async () => {
  const user = userEvent.setup()
  render(<LinMemories lin={lin} />)
  await screen.findByText('No memories yet')
  const files = Array.from({ length: 6 }, (_, i) => new File(['x'], `${i}.jpg`, { type: 'image/jpeg' }))
  await user.upload(screen.getByLabelText('Photos or videos'), files)
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose up to 5 photos or videos.')
  expect(screen.queryByRole('img', { name: /preview/i })).not.toBeInTheDocument()
})
it('shows a multi-item memory as a slideshow and a single one plainly', async () => {
  mocks.fetch.mockResolvedValue([memory('set', ['lin/person/1.jpg', 'lin/person/2.jpg']), memory('one')])
  render(<LinMemories lin={lin} />)
  expect(await screen.findByRole('group', { name: 'set, 2 items' })).toBeInTheDocument()
  expect(screen.getByText('1 of 2')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'one' })).toHaveAttribute('src', 'blob:lin/person/one.jpg')
  expect(screen.queryByRole('group', { name: /one/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to watch them fail**

Run from `web/`: `npx vitest run src/components/LinMemories.test.tsx`
Expected: the three new tests FAIL (no `Photos or videos` label, no slideshow); the changed expectations FAIL because `postMemory` still receives one file.

- [ ] **Step 3: Implement**

In `web/src/components/LinMemories.tsx`:

Change the import line to:

```ts
import { deleteMemory, fetchMemories, MAX_MEMORY_ITEMS, MEMORY_PAGE_SIZE, postMemory, validateMemorySet, type Memory } from '@/lib/api/memories'
import { MemorySlideshow } from './MemorySlideshow'
import { mediaKind } from '@/lib/api/memories'
```

Replace the `file` and `preview` state and their effect with:

```ts
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])
```

In `submit`, replace `if (!file || ...)` with `if (!files.length || !viewer.personId || busy) return`, pass `files` to `postMemory`, and reset with `setFiles([])`.

Replace the picker label, input, and preview block with:

```tsx
        <label className="block text-sm">Photos or videos <span className="text-ink-muted">(up to {MAX_MEMORY_ITEMS})</span>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy} className="mt-2 block w-full min-w-0 cursor-pointer text-xs text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink file:shadow-sm hover:file:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50" onChange={e => {
            const next = Array.from(e.target.files ?? [])
            const problem = next.length ? validateMemorySet(next) : null
            setError(problem ?? ''); setFiles(problem ? [] : next)
            if (problem) e.target.value = ''
          }} />
        </label>
        {files.length > 0 && <ul className="flex flex-wrap gap-2">{files.map((file, i) => <li key={`${file.name}:${i}`} className="relative">
          {file.type.startsWith('video/') ? <video src={previews[i]} aria-label={`Preview of ${file.name}`} className="h-20 w-20 rounded-lg bg-black object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previews[i]} alt={`Preview of ${file.name}`} className="h-20 w-20 rounded-lg object-cover" />}
          <button type="button" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => { setFiles(files.filter((_, j) => j !== i)); if (input.current) input.current.value = '' }} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-white p-0.5 text-ink shadow-sm hover:bg-surface-hover"><CloseIcon size={12} /></button>
        </li>)}</ul>}
```

Change the submit button's disabled condition to `!files.length || busy`.

Replace the media line in the article with:

```tsx
            {memory.media_paths.length > 1 ? <MemorySlideshow paths={memory.media_paths} urls={memory.urls} alt={memory.caption || 'A shared Lin memory'} />
              : memory.urls[0] ? mediaKind(memory.media_paths[0]) === 'video' ? <video controls preload="metadata" src={memory.urls[0]} className="max-h-80 w-full bg-black" /> : /* eslint-disable-next-line @next/next/no-img-element */
              <img loading="lazy" src={memory.urls[0]} alt={memory.caption || 'A shared Lin memory'} className="max-h-80 w-full object-contain" /> : <p className="p-6 text-sm">Media unavailable. Refresh the timeline to try again.</p>}
```

The `CloseIcon` in `icons.tsx` must accept `size`; check its `IconProps` and pass nothing if it does not.

- [ ] **Step 4: Run everything**

Run from `web/`: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all tests PASS, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/LinMemories.tsx web/src/components/LinMemories.test.tsx
git commit -m "Pick up to five files for a memory and show them as a slideshow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Browser verification

**Files:** none changed unless a defect turns up.

- [ ] **Step 1:** With the local stack up (`supabase start`, then `supabase db reset` so the migration applies) and the dev server on (`preview_start` name `web`), sign in as `bob@upenn.edu` / `password123`, open Wang Lin, open Memories.
- [ ] **Step 2:** Pick three images in the form. Confirm three thumbnails, remove one, share. Confirm the card shows "1 of 2", arrows, and dots; Next moves to "2 of 2" and disables; Previous returns.
- [ ] **Step 3:** In Postgres, `select media_paths from public.lin_memories order by created_at desc limit 1` shows two paths, and `select count(*) from storage.objects where bucket_id = 'lin-memories'` went up by two.
- [ ] **Step 4:** Delete the memory from the card and confirm the object count went down by two.
- [ ] **Step 5:** Take a screenshot of a slideshow card for the PR.
