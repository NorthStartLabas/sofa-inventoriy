-- Kitchen orders — a basket each, and an order each.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: guarded throughout.
--
-- APPLY THIS OUTSIDE SERVICE. It deletes whatever is in the basket at the time
-- (see below), and staff see that immediately.

-- ---------------------------------------------------------------------------
-- One shared basket was a two-person design. With six accounts it means two
-- people building an order at once are editing the same rows, and the second
-- one to press Finish sends an order that has already gone out.
--
-- A basket now belongs to an account. Reading stays open — everyone signed in
-- can see every basket row — because that is exactly what the "somebody already
-- has 2 of this" warning is built on. Writing is yours alone.
-- ---------------------------------------------------------------------------

alter table public.basket_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Rows already in the basket predate the column and have no defensible owner:
-- guessing one would silently put someone else's items into a person's order.
-- The basket is transient by design — finish_order empties it on every send —
-- so dropping them costs a re-tap, and inventing an owner costs a wrong order.
delete from public.basket_items where user_id is null;

alter table public.basket_items
  alter column user_id set not null,
  -- So a client that forgets to send it still can't create a row it doesn't own.
  alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- The unique key moves from the ingredient to the pair.
--
-- This single line is what makes the baskets independent. It is also the same
-- mechanism as before: one row per ingredient *per person*, upserted rather
-- than summed, which is what lets a person's own two phones still sync row by
-- row instead of overwriting each other with a whole-basket blob.
-- ---------------------------------------------------------------------------

alter table public.basket_items
  drop constraint if exists basket_items_ingredient_id_key;

alter table public.basket_items
  drop constraint if exists basket_items_user_ingredient_key;

alter table public.basket_items
  add constraint basket_items_user_ingredient_key unique (user_id, ingredient_id);

create index if not exists basket_items_user_idx on public.basket_items (user_id);

-- ---------------------------------------------------------------------------
-- RLS: read everyone, write yourself. Four policies rather than the usual
-- single authenticated_all, because the commands now differ.
--
-- auth.uid() is wrapped in a scalar subquery so the planner evaluates it once
-- per statement rather than once per row.
-- ---------------------------------------------------------------------------

drop policy if exists authenticated_all on public.basket_items;
drop policy if exists basket_read       on public.basket_items;
drop policy if exists basket_insert_own on public.basket_items;
drop policy if exists basket_update_own on public.basket_items;
drop policy if exists basket_delete_own on public.basket_items;

create policy basket_read on public.basket_items
  for select to authenticated using (true);

create policy basket_insert_own on public.basket_items
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy basket_update_own on public.basket_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy basket_delete_own on public.basket_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- An order remembers which account sent it, alongside the name it was sent
-- under. sent_by stays the display text for the same reason order_lines keeps
-- its own ingredient_name (migration 0004): History must not be rewritten when
-- someone changes their name later.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.orders
  alter column user_id set default auth.uid();

create index if not exists orders_user_idx on public.orders (user_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- finish_order sends your basket, and empties yours only.
--
-- Note the two new WHERE clauses. The delete used to be `where true` — the
-- phrasing migration 0003 had to add to satisfy safeupdate when the intent
-- really was "all of them". It isn't any more, so the clause safeupdate demands
-- and the clause correctness demands are now the same clause.
-- ---------------------------------------------------------------------------

create or replace function public.finish_order(p_sent_by text default null)
returns uuid
language plpgsql
security invoker
-- Empty search_path so the function can't be hijacked by a shadowing schema.
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_order_id uuid;
  v_lines    integer;
begin
  -- nullif is a SQL construct, not a pg_catalog function, so it needs no
  -- schema qualification even with an empty search_path. btrim does.
  insert into public.orders (sent_by, user_id)
  values (nullif(pg_catalog.btrim(p_sent_by), ''), v_user_id)
  returning id into v_order_id;

  -- The join is safe: basket_items.ingredient_id is not null and cascades, so
  -- a basket row can't outlive its ingredient.
  insert into public.order_lines (order_id, ingredient_id, ingredient_name, unit, quantity)
  select v_order_id, b.ingredient_id, i.name, i.unit, b.quantity
  from public.basket_items b
  join public.ingredients i on i.id = b.ingredient_id
  where b.user_id = v_user_id
    and b.quantity > 0;

  get diagnostics v_lines = row_count;

  -- Raising rolls the whole function back, including the order row above, so
  -- an empty basket leaves no trace rather than an empty order in the history.
  if v_lines = 0 then
    raise exception 'The basket is empty.';
  end if;

  -- Yours only. Someone else may well be mid-order on the next stove.
  delete from public.basket_items where user_id = v_user_id;

  return v_order_id;
end;
$$;

-- Signed-in users only — same rule as every table.
revoke execute on function public.finish_order(text) from public, anon;
grant execute on function public.finish_order(text) to authenticated;
