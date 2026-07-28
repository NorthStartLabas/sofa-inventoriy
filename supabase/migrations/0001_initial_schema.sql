-- Kitchen orders — initial schema.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: everything is guarded with "if not exists" / "drop if exists".

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- The physical walking route through the kitchen. Never auto-sorted.
  sort_order integer not null default 0
);

create table if not exists public.suppliers (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.ingredients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Free text: l, kg, block, tray, bag. Shown next to every quantity.
  unit        text not null default '',
  -- Required: every ingredient lives somewhere on the route.
  location_id uuid not null references public.locations (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete set null,
  sort_order  integer not null default 0,
  -- Archived rather than deleted, so historical order_lines keep resolving.
  archived    boolean not null default false
);

create table if not exists public.dishes (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.dish_ingredients (
  dish_id       uuid not null references public.dishes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  primary key (dish_id, ingredient_id)
);

create table if not exists public.basket_items (
  id            uuid primary key default gen_random_uuid(),
  -- One basket line per ingredient, enforced here rather than in the client.
  -- This is what lets two phones sync row-by-row instead of overwriting each
  -- other with a whole-basket blob.
  ingredient_id uuid not null unique references public.ingredients (id) on delete cascade,
  quantity      numeric not null default 0,
  added_by      text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.orders (
  id      uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  sent_by text
);

create table if not exists public.order_lines (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  -- restrict, not cascade: history must survive. Archive ingredients instead.
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity      numeric not null
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists ingredients_location_idx
  on public.ingredients (location_id, sort_order);
create index if not exists dish_ingredients_ingredient_idx
  on public.dish_ingredients (ingredient_id);
create index if not exists order_lines_order_idx
  on public.order_lines (order_id);
-- Drives the "ordered in 3 of the last 10" hint on the finish screen.
create index if not exists order_lines_ingredient_idx
  on public.order_lines (ingredient_id);
create index if not exists orders_sent_at_idx
  on public.orders (sent_at desc);

-- ---------------------------------------------------------------------------
-- Keep basket_items.updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- Empty search_path so the function can't be hijacked by a shadowing schema.
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists basket_items_set_updated_at on public.basket_items;
create trigger basket_items_set_updated_at
  before update on public.basket_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The anon/publishable key ships inside the client bundle, which is public.
-- That is fine ONLY because of what follows: every table is locked to signed-in
-- users. Two people, no roles — "authenticated" is the whole permission model.
-- Keep signups disabled in Supabase Auth, or "authenticated" means "anyone".
-- ---------------------------------------------------------------------------

alter table public.locations        enable row level security;
alter table public.suppliers        enable row level security;
alter table public.ingredients      enable row level security;
alter table public.dishes           enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.basket_items     enable row level security;
alter table public.orders           enable row level security;
alter table public.order_lines      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations', 'suppliers', 'ingredients', 'dishes',
    'dish_ingredients', 'basket_items', 'orders', 'order_lines'
  ]
  loop
    execute format('drop policy if exists authenticated_all on public.%I', t);
    execute format(
      'create policy authenticated_all on public.%I
         for all to authenticated using (true) with check (true)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime (used from Phase 6 — the two phones sync the basket row by row)
-- ---------------------------------------------------------------------------

-- replica identity full so DELETE events carry the old row, not just the id.
alter table public.basket_items replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'basket_items'
  ) then
    alter publication supabase_realtime add table public.basket_items;
  end if;
end;
$$;
