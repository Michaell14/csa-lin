# Memories with up to five items, shown as a slideshow

Date: 2026-09-21. Status: approved in chat, implementing.

## Goal

A member posting a memory can attach up to five photos or videos, mixed, in
one post. The timeline shows such a memory as one card with a slideshow:
one item visible at a time, left and right arrows, a counter and dots.
Single-item memories look exactly as they do today.

## Data model

`public.lin_memories` changes:

| Column | Before | After |
|---|---|---|
| `media_path text not null unique` | one object path | dropped |
| `media_type text` (`image` / `video`) | per memory | dropped; each path's extension says what it is |
| `media_paths text[] not null` | | 1 to 5 object paths, in display order, no duplicates |

A memory stays one row. That keeps publishing one insert (atomic without an
RPC), deleting one statement, and ordering intrinsic. A child table was
considered and rejected: it needs a transactional RPC for publish and a join
in every policy, for no benefit at five items.

Constraints on `media_paths`:

- `array_length(media_paths, 1) between 1 and 5`;
- every element matches `<lin_id>/<author_id>/<uuid>.(jpg|png|mp4|webm)`,
  checked by an immutable helper `public.memory_paths_valid(lin uuid, author uuid, paths text[])`;
- no duplicate elements (the same helper).

Existing rows migrate to a one-element array in the same migration
(`20260921000002_memory_slideshow.sql`), which also drops the old columns and
the old unique constraint, and replaces the `media_path` unique index with a
GIN index on `media_paths` for the policy lookups.

## Policies

- Row insert: `author_id = current_person_id()`, lin access as today, and
  every listed object exists in the `lin-memories` bucket as seen by the
  caller (`not exists (select 1 from unnest(media_paths) p where not exists (select 1 from storage.objects where bucket_id = 'lin-memories' and name = p))`).
- Row read and delete: unchanged.
- `public.can_read_memory_media(path)`: matches `path = any(m.media_paths)`
  instead of equality on `media_path`.
- Storage insert policy: unchanged. It already accepts any
  `<lin>/<author>/<uuid>.<ext>` name from a member of that lin, so five
  uploads need no new rule.

pgTAP (`supabase/tests/18_lin_memories.sql`) gains: a five-item publish
succeeds; six items are rejected; a memory listing an object that was never
uploaded is rejected; a fellow member can read every object of a published
five-item memory; deleting the memory is one statement.

## Client

`web/src/lib/api/memories.ts`:

- `Memory` gains `urls: (string | null)[]` (one per path, in order) and a
  derived `kind(path)` helper returning `image` or `video` from the extension.
- `MAX_MEMORY_ITEMS = 5`. `validateMemory(file)` is unchanged per file;
  `validateMemorySet(files)` adds the count check.
- `postMemory(sb, linId, authorId, files, caption, privateToLin, env?)`
  takes `File[]`. It validates, re-encodes each image as today, uploads all
  objects in parallel, removes every uploaded object if any upload fails,
  then inserts one row. If the insert fails, all objects are removed.
- `fetchMemories` signs every path across the page in one
  `createSignedUrls` call and maps them back per memory.
- `deleteMemory` removes all of the memory's objects after the row delete.

`web/src/components/LinMemories.tsx`:

- The picker has `multiple`. On change, every chosen file is validated and
  the set is capped at five with the message "Choose up to 5 photos or
  videos." A preview strip shows one thumbnail per file with a remove
  button, so a member can drop one before sharing.
- A memory with more than one item renders `MemorySlideshow`
  (`web/src/components/MemorySlideshow.tsx`): only the current item is in
  the DOM, so the other items are not downloaded until viewed; "Previous"
  and "Next" arrow buttons overlaid on the media; a "2 of 5" counter; a dot
  per item; ArrowLeft and ArrowRight move slides while the slideshow has
  focus. Arrows do not wrap.
- A single-item memory renders as today.

`web/src/lib/database.types.ts` (hand-maintained) follows the schema.
`supabase/README.md` describes the five-item limit.

## Not in scope

Per-slide captions, reordering after upload, swipe gestures, editing a
memory's items after posting, and any change to the upload size limits or
image re-encoding settings from the previous PR.
