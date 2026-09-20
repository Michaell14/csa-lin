-- During posting, the storage object is uploaded before its lin_memories row.
-- Members must be able to read that pending object so the row policy can verify
-- it exists. Once linked, public viewers use can_read_memory_media; lin members
-- retain access to both public and lin-only media.
alter policy memories_media_read on storage.objects
  using (
    bucket_id = 'lin-memories'
    and (
      public.can_read_memory_media(name)
      or exists (
        select 1
        from public.lins l
        where l.id::text = (storage.foldername(storage.objects.name))[1]
          and public.can_access_lin_memories(l.id)
      )
    )
  );
