-- During posting, the storage object is uploaded before its lin_memories row,
-- so the uploader must be able to read their own pending object: the row policy
-- verifies the object exists as the caller. Everyone else reads through
-- can_read_memory_media, which requires a published row, so an orphaned object
-- (publish failed after upload, or storage cleanup failed after a delete) stays
-- invisible to the rest of the lin.
alter policy memories_media_read on storage.objects
  using (
    bucket_id = 'lin-memories'
    and (
      public.can_read_memory_media(name)
      or (storage.foldername(name))[2] = public.current_person_id()::text
    )
  );
