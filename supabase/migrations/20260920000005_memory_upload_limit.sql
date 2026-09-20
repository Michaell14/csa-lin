-- Halve the per-file ceiling on memories so the project's storage quota lasts.
-- Photos are re-encoded in the browser to well under this; the limit really
-- caps videos, which upload as picked. The web client refuses larger files
-- with a friendlier message before the bucket does.
update storage.buckets set file_size_limit = 26214400 where id = 'lin-memories';
