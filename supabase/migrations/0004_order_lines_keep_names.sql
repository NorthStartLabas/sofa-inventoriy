-- Kitchen orders — an order line remembers what it said, so ingredients can go.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: `if not exists` / `drop constraint if exists` throughout.

-- ---------------------------------------------------------------------------
-- Until now order_lines.ingredient_id was `on delete restrict`, and History
-- resolved a line by looking the ingredient up in the live catalog. That made
-- anything ever ordered undeletable — and, because a location can't be dropped
-- while ingredients still point at it, permanently undeletable locations too.
-- Archiving was the only way out, and archived rows still block a location.
--
-- Menus change. The line, not the catalog, is what should remember the order:
-- an order is a record of what was sent that day, so it keeps its own copy of
-- the name and unit. That frees the ingredient row to be deleted for good, and
-- fixes a quieter bug in the same move — renaming an ingredient used to rewrite
-- every past order that mentioned it.
--
-- ingredient_id stays for the "ordered in 3 of the last 10" hint, but goes null
-- when the ingredient is deleted instead of blocking the delete.
-- ---------------------------------------------------------------------------

alter table public.order_lines
  add column if not exists ingredient_name text,
  add column if not exists unit text;

-- Backfill from the catalog while the rows are still joinable.
update public.order_lines ol
set ingredient_name = i.name,
    unit           = i.unit
from public.ingredients i
where i.id = ol.ingredient_id
  and ol.ingredient_name is null;

-- Any line whose ingredient is already gone: keep the row, name it honestly.
update public.order_lines
set ingredient_name = 'Removed ingredient'
where ingredient_name is null;

alter table public.order_lines
  alter column ingredient_name set not null;

-- Null once the ingredient is deleted, so the line survives it.
alter table public.order_lines
  alter column ingredient_id drop not null;

alter table public.order_lines
  drop constraint if exists order_lines_ingredient_id_fkey;

alter table public.order_lines
  add constraint order_lines_ingredient_id_fkey
  foreign key (ingredient_id) references public.ingredients (id) on delete set null;

-- ---------------------------------------------------------------------------
-- finish_order now snapshots the name and unit onto each line.
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

  -- The join is safe: basket_items.ingredient_id is not null and cascades, so
  -- a basket row can't outlive its ingredient.
  insert into public.order_lines (order_id, ingredient_id, ingredient_name, unit, quantity)
  select v_order_id, b.ingredient_id, i.name, i.unit, b.quantity
  from public.basket_items b
  join public.ingredients i on i.id = b.ingredient_id
  where b.quantity > 0;

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
