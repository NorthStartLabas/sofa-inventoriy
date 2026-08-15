-- Kitchen orders — the name belongs to the account, not to the phone.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: "if not exists" / "or replace" / "on conflict do nothing" throughout.

-- ---------------------------------------------------------------------------
-- Until now the display name lived in localStorage on each device. That was a
-- two-person design and the kitchen isn't two people any more: six accounts,
-- and a name that has to be set again on every phone, tablet and laptop each
-- person signs in on. It also produced a bug that looked like a broken prompt —
-- a phone that had set a name months ago never saw the new "who's ordering?"
-- screen, while a fresh laptop did, because the two devices genuinely held
-- different state.
--
-- One row per account, readable by everyone signed in. Readable by everyone is
-- deliberate and required: a basket now belongs to a person, so the app has to
-- be able to say *whose* basket something is already in.
--
-- order_lines.ingredient_name and orders.sent_by stay text snapshots — same
-- rule as migration 0004. Renaming yourself must not rewrite what past orders
-- say you ordered.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Empty rather than null: "not set yet" is a state the app routes on, and an
  -- empty string is easier to get right in three places than a null is.
  name text not null default '',
  -- Set when an account is handed a temporary password. Cleared by the app the
  -- moment the person chooses their own.
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Three policies, not the usual single authenticated_all. This is the first
-- table in the schema where the commands genuinely differ: everyone signed in
-- can read every name, but only you can write yours.
-- ---------------------------------------------------------------------------

drop policy if exists authenticated_all  on public.profiles;
drop policy if exists profiles_read      on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_read on public.profiles
  for select to authenticated using (true);

-- The trigger below covers new accounts; this covers a profile row that went
-- missing, so signing in can always recreate one rather than dead-ending.
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy on purpose: a profile goes when the account goes, by cascade.

-- ---------------------------------------------------------------------------
-- A profile appears with the account.
--
-- security definer, unlike every other function here: a trigger on auth.users
-- runs as supabase_auth_admin, which has no rights on public.profiles, so
-- invoker would fail on every signup. Empty search_path for the usual reason.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- coalesce is a SQL construct rather than a function, so it needs no schema
  -- qualification even here. (Same note as nullif in migration 0002.)
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill the accounts that already exist.
--
-- Every one of them was created by magic link and carries a random bcrypt hash
-- nobody knows, so all of them need a temporary password handed out and changed.
-- Names start empty: the app asks once, on the account rather than the device,
-- and from then on it follows the person to whatever they sign in on.
--
-- `on conflict do nothing` is what keeps this safe to re-run — it must never
-- reset must_change_password for someone who has already chosen one.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, name, must_change_password)
select u.id, coalesce(u.raw_user_meta_data ->> 'name', ''), true
from auth.users u
on conflict (id) do nothing;
