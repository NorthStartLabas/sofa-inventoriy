-- Kitchen orders — an order that goes out is news to everyone else.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: guarded.

-- ---------------------------------------------------------------------------
-- The app warns you when something you're about to add has already been
-- ordered today. That warning is only worth having if it's current: the whole
-- case it exists for is two people ordering within minutes of each other, and
-- finding out on the next reload is finding out too late.
--
-- basket_items has been in the publication since 0001, which covers "somebody
-- has it in their basket right now". This covers the other half — somebody has
-- already sent it.
--
-- Nothing else changes. orders keeps its authenticated_all policy, so realtime
-- delivers exactly what a select would have.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
