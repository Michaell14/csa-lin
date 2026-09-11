-- Shape and length rules for member-editable profile fields.
--
-- linkedin was rendered straight into an href and instagram into a URL path
-- with no validation, so a member could store a javascript: URL or an
-- arbitrary path. Existing values are normalised first (leading @ stripped,
-- http:// upgraded, over-long text truncated); anything still invalid is
-- nulled. The changelog trigger records every one of these rewrites.

update public.people
set instagram = nullif(regexp_replace(btrim(instagram), '^@', ''), '')
where instagram is not null;

update public.people
set instagram = null
where instagram is not null and instagram !~ '^[A-Za-z0-9._]{1,30}$';

update public.people
set linkedin = nullif(btrim(linkedin), '')
where linkedin is not null;

update public.people
set linkedin = 'https://' || regexp_replace(linkedin, '^https?://', '', 'i')
where linkedin ~* '^(https?://)?([a-z0-9-]+\.)?linkedin\.com/';

update public.people
set linkedin = null
where linkedin is not null
  and (length(linkedin) > 200 or linkedin !~* '^https://([a-z0-9-]+\.)?linkedin\.com/[^[:space:]"''<>]+$');

update public.people set display_name = left(display_name, 100) where length(display_name) > 100;
update public.people set major        = left(major, 100)        where length(major) > 100;
update public.people set hometown     = left(hometown, 100)     where length(hometown) > 100;
update public.people set bio          = left(bio, 1000)         where length(bio) > 1000;

alter table public.people
  add constraint people_instagram_handle
    check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint people_linkedin_url
    check (linkedin is null or (length(linkedin) <= 200
           and linkedin ~* '^https://([a-z0-9-]+\.)?linkedin\.com/[^[:space:]"''<>]+$')),
  add constraint people_display_name_len check (length(display_name) <= 100),
  add constraint people_major_len        check (major    is null or length(major)    <= 100),
  add constraint people_hometown_len     check (hometown is null or length(hometown) <= 100),
  add constraint people_bio_len          check (bio      is null or length(bio)      <= 1000);
