-- Kitchen orders — give finish_order's DELETE a WHERE clause.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: create or replace.

-- ---------------------------------------------------------------------------
-- Finishing an order failed in the app with "DELETE requires a WHERE clause",
-- while the same function ran fine from the SQL editor.
--
-- The `authenticator` role — the one every PostgREST request connects as —
-- carries `session_preload_libraries = supautils, safeupdate`. The safeupdate
-- extension rejects any UPDATE or DELETE without a WHERE clause, and it does
-- so inside plpgsql bodies too, not just at the top level. The SQL editor
-- connects as a different role without that library, which is why pasting
-- migration 0002 never surfaced the problem.
--
-- `where true` is the whole fix: the intent really is to empty the table, and
-- naming that explicitly is what safeupdate is asking for.
-- ---------------------------------------------------------------------------

create or replace function public.finish_order(p_sent_by text default null)
returns uuid
language plpgsql
security invoker
-- Empty search_path so the function can't be hijacked by a shadowing schema.
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_lines    integer;
begin
  -- nullif is a SQL construct, not a pg_catalog function, so it needs no
  -- schema qualification even with an empty search_path. btrim does.
  insert into public.orders (sent_by)
  values (nullif(pg_catalog.btrim(p_sent_by), ''))
  returning id into v_order_id;

  insert into public.order_lines (order_id, ingredient_id, quantity)
  select v_order_id, ingredient_id, quantity
  from public.basket_items
  where quantity > 0;

  get diagnostics v_lines = row_count;

  -- Raising rolls the whole function back, including the order row above, so
  -- an empty basket leaves no trace rather than an empty order in the history.
  if v_lines = 0 then
    raise exception 'The basket is empty.';
  end if;

  -- Emptying the basket is the intent; safeupdate needs it said out loud.
  delete from public.basket_items where true;

  return v_order_id;
end;
$$;

-- Signed-in users only — same rule as every table.
revoke execute on function public.finish_order(text) from public, anon;
grant execute on function public.finish_order(text) to authenticated;
