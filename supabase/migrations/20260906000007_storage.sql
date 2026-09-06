-- Private photo bucket. Path convention: <person_id>/avatar.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );

create policy photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );

create policy photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_admin() or (storage.foldername(name))[1] = public.current_person_id()::text)
  );
