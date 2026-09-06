-- Core tables for the CSA lin tree.
create extension if not exists pgcrypto;

create type public.link_status as enum ('pending', 'confirmed');

create table public.people (
  id              uuid primary key default gen_random_uuid(),
  display_name    text not null check (length(trim(display_name)) > 0),
  grad_year       int  not null check (grad_year between 1900 and 2200),
  penn_email      text unique,
  personal_email  text unique,
  auth_user_id    uuid unique,
  claimed_at      timestamptz,
  photo_path      text,
  major           text,
  hometown        text,
  bio             text,
  instagram       text,
  linkedin        text,
  hidden          boolean not null default false,
  merged_into     uuid references public.people(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint people_penn_email_lower     check (penn_email     is null or penn_email     = lower(penn_email)),
  constraint people_personal_email_lower check (personal_email is null or personal_email = lower(personal_email)),
  constraint people_not_merged_into_self check (merged_into is null or merged_into <> id)
);

create table public.lins (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  founder_id  uuid not null references public.people(id),
  created_at  timestamptz not null default now()
);

create table public.links (
  id             uuid primary key default gen_random_uuid(),
  big_id         uuid not null references public.people(id),
  little_id      uuid not null references public.people(id),
  academic_year  text,
  status         public.link_status not null default 'pending',
  proposed_by    uuid references public.people(id),
  confirmed_by   uuid references public.people(id),
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz,
  constraint links_not_self  check (big_id <> little_id),
  constraint links_unique_pair unique (big_id, little_id)
);
create index links_little_idx on public.links (little_id);
create index links_big_idx    on public.links (big_id);

create table public.admins (
  person_id   uuid primary key references public.people(id),
  granted_by  uuid references public.people(id),
  granted_at  timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end $$;

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();
