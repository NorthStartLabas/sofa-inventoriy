-- Kitchen orders — finishing an order.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: create or replace, and the grants are idempotent.

-- ---------------------------------------------------------------------------
-- finish_order()
--
-- Writes the order, copies the basket into order_lines, then empties the
-- basket. All three in one function call, so a phone that loses signal
-- halfway can't leave the basket cleared with nothing recorded, or an order
-- sitting in the history with no lines under it.
--
-- security invoker, so the caller's RLS still applies — this hands out no
-- access that signing in didn't already give.
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

  delete from public.basket_items;

  return v_order_id;
end;
$$;

-- Signed-in users only — same rule as every table.
revoke execute on function public.finish_order(text) from public, anon;
grant execute on function public.finish_order(text) to authenticated;
