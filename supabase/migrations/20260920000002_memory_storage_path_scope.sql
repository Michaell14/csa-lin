-- Qualify the object path inside the lins subquery: unqualified name resolves
-- to lins.name there, rather than the storage object's name.
alter policy memories_media_read on storage.objects
  using (bucket_id = 'lin-memories' and exists (
    select 1 from public.lins where id::text = (storage.foldername(storage.objects.name))[1]
      and public.can_access_lin_memories(id)
  ));
alter policy memories_media_insert on storage.objects
  with check (bucket_id = 'lin-memories'
    and (storage.foldername(name))[2] = public.current_person_id()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|mp4|webm)$'
    and exists (select 1 from public.lins where id::text = (storage.foldername(storage.objects.name))[1]
      and public.can_access_lin_memories(id)));
