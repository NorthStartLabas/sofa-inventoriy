-- Kitchen orders — a brand new account always arrives on a borrowed password.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: create or replace.

-- ---------------------------------------------------------------------------
-- Migration 0005 backfilled must_change_password = true for the accounts that
-- already existed, but its trigger left it at the column default (false) for
-- new ones. That was wrong the moment registration closed: with signups off,
-- the *only* way an account can now come into being is somebody in the Supabase
-- dashboard typing a password for another person and telling it to them. There
-- is no such thing as a new account whose password isn't already known to two
-- people, so the flag is true for every one of them, always.
--
-- Left as it was, "add a user in the dashboard" would have quietly produced an
-- account that keeps its handed-out password for good — which is the exact
-- thing SetPassword exists to prevent.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Empty search_path so the function can't be hijacked by a shadowing schema.
set search_path = ''
as $$
begin
  -- coalesce is a SQL construct rather than a function, so it needs no schema
  -- qualification even here. (Same note as nullif in migration 0002.)
  insert into public.profiles (id, name, must_change_password)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), true)
  on conflict (id) do nothing;
  return new;
end;
$$;
