# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ingredient ordering for a two-person kitchen, used on phones with wet hands in a bright room.
That context drives most of the design decisions below — controls are ≥44px, text is `text-base`
everywhere (no `text-sm`), and the walking route through the kitchen is the primary sort order.

## Commands

```bash
npm run dev      # Vite dev server — open http://localhost:5173/sofa-inventoriy/, the path matters
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # serve dist/
```

There is no test runner configured. Verify changes by running the app.

`.env` (copied from `.env.example`) must hold `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`;
`src/lib/supabase.ts` throws at import time if either is missing. Only the publishable/anon key
belongs there — the service_role key bypasses RLS and must never reach the bundle.

Deploy is push-to-`main` via `.github/workflows/deploy.yml` (GitHub Pages, secrets supply the two
`VITE_` vars). `vite.config.ts` pins `base: '/sofa-inventoriy/'` to the repo name.

## Database

The schema lives in `supabase/migrations/0001_initial_schema.sql` and is applied by pasting it into
the Supabase SQL editor. It is written to be re-runnable (`if not exists` / `drop if exists`). There
is no Supabase CLI workflow here — later migrations should follow the same idempotent, paste-once
style as new numbered files.

Permission model: every table has RLS on with a single `authenticated_all` policy — `for all to
authenticated using (true)`. There are no roles and no per-user ownership, so "authenticated" means
"anyone with an account", and an account means the whole database. Don't add user-scoped logic
expecting `auth.uid()` to be meaningful.

**Registration is open by owner's decision** (2026-08-12): `shouldCreateUser: true` on
`signInWithOtp`, and signups enabled in Supabase Auth. Combined with the policy above, anyone who
finds the Pages URL can create an account and then read, edit and delete everything. This was open
once before and the database was reachable by anyone who found it. The fix, if it's wanted later, is
an `allowed_emails` table enforced by a trigger on `auth.users`, or per-user RLS — not the client
flag, which only changes the error message an unknown address sees.

`finish_order(p_sent_by)` (migration `0002`) is the only server-side function. It writes the order,
copies the basket into `order_lines`, and empties `basket_items` in one call so a phone that drops
signal can't clear the basket without recording it; an empty basket raises and rolls the order row
back. It is `security invoker`, so RLS still applies and it grants nothing extra.

Every `UPDATE` and `DELETE` needs a `WHERE` clause, including inside a function body. The
`authenticator` role — the one PostgREST connects as — runs with `session_preload_libraries =
supautils, safeupdate`, and `safeupdate` rejects unqualified writes with `DELETE requires a WHERE
clause`. The SQL editor connects as a different role without it, so a bare `delete` will pass when
you paste a migration and fail the moment the app calls it. Migration `0003` fixed exactly that in
`finish_order`; `where true` is the accepted way to say "yes, all of them".

**An order line remembers itself** (migration `0004`). `order_lines` carries its own
`ingredient_name` and `unit`, written by `finish_order` at send time, and `ingredient_id` is
`on delete set null`. So an ingredient can be deleted for good and History still reads correctly —
menus change, and the old rule (`on delete restrict` + archive-only) made anything ever ordered
permanently undeletable, which in turn made its location permanently undeletable. It also fixes a
quieter bug: History used to resolve names against the *live* catalog, so renaming an ingredient
silently rewrote every past order that mentioned it. Never reintroduce a catalog lookup there.

Nothing blocks `deleteIngredient` now — `dish_ingredients` and `basket_items` cascade, order lines
null out. Archiving still exists, but as "hide it, keep it orderable later", not as a substitute for
deleting. `locations` stays `on delete restrict` from `ingredients`: emptying a location first is
deliberate, not an obstacle, and now actually achievable.
`basket_items.ingredient_id` is `unique`, which is what lets two phones sync the basket row-by-row
instead of overwriting each other with a whole-basket blob.

## Architecture

Provider nesting in `src/App.tsx`: `AuthProvider` → `HashRouter` → `Gate` → `CatalogProvider` →
`BasketProvider` → routes. Catalog and basket sit *inside* the auth gate because RLS means neither
can be read without a session.

**Context split.** Each provider is two files: the `createContext` + `useX()` hook in a lowercase
`*Context.ts`, and the `<XProvider>` component in a `.tsx`. This is deliberate — `oxlint`'s
`react/only-export-components` (and fast refresh) break if a module exports both a component and a
hook. Follow the pattern when adding providers.

**Two state stores, two different consistency stories:**

- `useCatalog` (`src/data/useCatalog.ts`) — one shared fetch of all five catalog tables. Edited by
  one person at a time, so `mutate(optimistic, persist)` applies the change locally and, on failure,
  surfaces an error and re-reads the server rather than reconciling. `run(work)` is the variant for
  inserts, where the id only exists after the server replies. `getCatalog()` returns the catalog as
  of *now* rather than as of the last render — needed by any handler that derives its write from the
  current set, because React runs state updaters during render, long after the request went out.
- `BasketProvider` (`src/basket/BasketProvider.tsx`) — a `Map<ingredient_id, BasketItem>` with a
  400ms per-ingredient debounce, since steppers get tapped fast. Writes go through `upsert` on
  `ingredient_id` (replace, never sum). Setting a quantity to 0 deletes the row; that is how items
  leave the basket. `flush()` sends anything still on a timer and resolves when it lands — it runs on
  `visibilitychange`/`pagehide` (a pocketed phone used to lose the last tap outright) and **must** be
  awaited before `finishOrder`, which reads the basket server-side.

Data access is plain async functions in `src/data/*.ts` that call `supabase` directly and throw
`Error(message)`; the stores own all state and error handling. Keep new queries in that layer rather
than calling `supabase` from components.

**The three order views.** `src/screens/order/OrderScreen.tsx` is a shell — header, sticky view
switcher, basket bar — and swaps only the list body between `RouteView`, `DishView` and `AllView`.
All three render the same `IngredientRow`, so they differ purely in grouping, sorting and the row's
subtitle (`added_by`/unit for Route and Dish, location for All). Two rules they share rather than
each reinvent: `isVisibleInOrder` in `src/lib/orderView.ts` (archived stock is hidden unless it's
already in the basket, or the count would name a row nobody can see), and route order — Dish sorts
by location then `sort_order`, not alphabetically, so checking a dish is still one pass along the
shelves. The switcher is `sticky top-0`, so anything sticky beneath it sits at `top-11` (44px).

**Sort order.** `locations.sort_order` and `ingredients.sort_order` are the physical walking route
and are never auto-sorted — always user-dragged via `ReorderList`. `ingredients.sort_order` is only
ever compared within a location, so each location numbers from zero. `persistOrder` writes one
`update` per row on purpose.

## Routing and auth

`HashRouter`, because GitHub Pages 404s on deep links with `BrowserRouter`. That collides with
Supabase magic links, which return `#access_token=…` in the same hash slot — so `detectSessionInUrl`
is **off** and `src/lib/authCallback.ts` consumes the fragment and rewrites the hash to `#/` before
the router mounts. If you touch auth or routing, keep that ordering intact.

Sign-in is magic-link only (`signInWithOtp`). `useDisplayName` (`src/lib/displayName.ts`) is a
per-device localStorage name used purely for the `added_by` label — it is not identity and must never
gate anything.

## UI conventions

Tailwind v4 via `@tailwindcss/vite`; the only CSS file is `src/index.css`, which owns the design
tokens in an `@theme` block. Shared control classes live in `src/components/styles.ts` — reuse
`input`, `primaryButton`, `secondaryButton`, `quietButton`, `dangerButton`, `headerLink` and the
`tab(active)` helper rather than re-deriving them. Every screen's top band is `ScreenHeader`.

**The palette is the restaurant's, taken from `sofamaastricht.nl`** — anthracite `#293133` and sand
`#fff7ee`, banded against each other the way the site bands them (its own stylesheet names the class
`sand-antraciet`), with apricot `#fbd6a9` as the accent. Still three colours, because three is what
survives glare in a bright room: `ink` reads, `apricot` marks, `flag` warns, over a `sand` ground.
Use the tokens, never raw Tailwind palette names: `text-ink`, `text-stone`, `border-rule`, `bg-sand`,
`bg-surface`, `bg-apricot`, `text-apricot`, `text-flag`, `bg-flag-wash`.

**Apricot has exactly two jobs, and neither is text on a light ground** — it is 1.37 against white
and vanishes. Both are lifted from how the site uses it:

- a **fill** on a light surface with ink on top (9.67) — a basket row, the active tab, the primary
  button (which is the site's `.reserveren-btn`: apricot ground, ink text, caps, `10px` radius);
- **text on anthracite** (9.67) — the basket count in the bottom bar.

Rails, rules and focus outlines stay `ink`; an apricot hairline is not visible at any width. A row in
the basket fills apricot because apricot is the site's own "claimed" colour, which is what a basket
row is — and the state carries on four signals anyway (fill, weight, visible quantity, live minus
button), so colour isn't load-bearing. **Every token pair clears WCAG AA — check any new pair before
using it**; worst current case is `stone` on `apricot` at 5.11.

**The two dark bands.** `ScreenHeader` is anthracite on every screen, and so is the fixed basket bar
on the Order screen. The header owns `env(safe-area-inset-top)` rather than `body` — paint it on
`body` and a notched phone gets a sand strip above a dark band. Anything placed in the header must be
`text-sand`; `text-stone` on anthracite is 2.3 and fails.

**Type.** Body is system-ui: fast, no FOUT on kitchen wifi, best at 16px. The `.label` class (Jost,
caps, `.1em` tracked — the site's own button tracking) marks **things in the kitchen** — a location,
a supplier, a dish, a screen title. Not navigation: four caps words don't fit 390px, which is why
both tab rows are sentence case. Jost stands in for `futura-pt`, which is what the site sets and is
Adobe Fonts–only; the face is bundled via `@fontsource` latin subsets, **never fetched at runtime**.

**Never go below `text-base`.** It's the wet-hands floor and it stops iOS zooming on focus. Every
tap target clears 44px.

**The route rail** — the rule down the left of `RouteView`, `ink/25` between stops and solid `ink` at
each location — belongs to that view alone. Route is the only one of the three whose order means
something in the room, so it's the only one that gets a structural device saying so. Don't add it to
Dish or All; there it would be decoration.

`ReorderList` uses pointer events, not HTML5 drag-and-drop, which doesn't fire on touch at all.
Drag handles need `touch-none`; measurements are in document space so page scroll mid-drag doesn't
skew them.

## Build phases

`README.md` lists six phases and marks the current one — keep that marker moving as phases land.
Phases 1–5 are committed: scaffold/auth/deploy, schema + Catalog screen, Order screen + basket +
steppers, basket screen + WhatsApp export + finish order + history, and the Dish and All views.
Phase 6 is current: realtime sync, missing-item hints, location sweep, offline retry queue and PWA.
The schema already provisions for it — `basket_items` is in the `supabase_realtime` publication with
`replica identity full`, and `order_lines_ingredient_idx` exists for the "ordered in 3 of the last
10" hint.

Ordering flow, end to end: Order screen (walk the route, step quantities) → `/basket` (grouped by
supplier, WhatsApp/copy export, Finish) → `/history`. `src/lib/orderText.ts` owns the grouping and
the message format; WhatsApp's only formatting is `*bold*`.

## Comment style

Existing comments explain *why* a non-obvious choice was made, often with the kitchen constraint that
forced it, and never restate the code. Match that density — this codebase is deliberately
lightly-but-substantively commented.
