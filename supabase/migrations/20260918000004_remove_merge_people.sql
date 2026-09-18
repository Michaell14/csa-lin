-- Retire profile merging; the following migration removes its schema field.
-- Earlier migrations created first a two-argument function and then a
-- three-argument version. Drop both signatures so neither remains callable
-- through PostgREST, including on databases with older migration history.
drop function if exists public.merge_people(uuid, uuid, text);
drop function if exists public.merge_people(uuid, uuid);
