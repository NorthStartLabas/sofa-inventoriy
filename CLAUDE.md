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

## How to work on this without breaking service

The kitchen uses this during service. Two rules, both established 2026-08-14 and expected from
here on:

**Never develop on a branch that can deploy.** Work on a feature branch and leave `main` alone
until the owner has tested and says to merge. The workflow triggers on push to `main` only, so a
branch is a hard guarantee rather than a promise.

**Never point local development at the live database.** There is a second, free Supabase project,
**`sofa-inventoriy-dev`** (ref `upkidadrscyigcycvofx`), holding a copy of the real catalog — same
169 ingredients, 3 locations, 26 dishes, 4 orders. Local `.env` points there; the live credentials
live in `.env.live.backup` (both gitignored, and production reads its own from repo secrets, so
neither file can affect the deployed site). Swap back only when the branch has been merged.

Search is read-only and harmless, but the basket, realtime sync and bulk supplier assignment all
write — and staff see those writes immediately. Migrations get applied to the dev project first,
then to live at merge time.

Re-seeding the dev project: apply `supabase/migrations/*` in order, then copy the catalog across
by name rather than by id (`string_agg` the rows out of live, `string_to_array` them back in).
Ids don't need to match, and a dump of full INSERT statements is too large to move in one piece.

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
  leave the basket. `flush()` sends anything still on a timer, drains the retry queue, and resolves
  when it lands — it runs on `visibilitychange`/`pagehide` (a pocketed phone used to lose the last
  tap outright) and **must** be awaited before `finishOrder`, which reads the basket server-side.
  It **rejects** if the queue won't drain; `BasketScreen` must let that stop the send rather than
  swallow it, or an order silently goes out short.

  Pending writes are plain `BasketWrite` data, not closures, because the retry queue has to survive
  a reload. `src/basket/retryQueue.ts` holds failed writes in localStorage keyed by `ingredient_id`
  — one entry per ingredient, last wins, mirroring the upsert: the basket is a quantity, not a
  history of taps. Only *retriable* failures are queued. `src/data/basket.ts` throws
  `BasketWriteError` and decides that at the point of failure — a PostgREST rejection carries a
  `code` and is the server saying no; a fetch that never arrived has none. **Don't sniff error
  strings in the provider**, and don't replay refusals.

  Realtime sync subscribes to `postgres_changes` on `basket_items`. It ignores events for
  ingredients with a change still in flight (`pending` or `unsaved`), or our own echo would
  overwrite a newer tap. It does **not** merge concurrent edits — same-row conflicts still resolve
  last-write-wins, exactly as the upsert always did; what it fixes is two phones showing different
  numbers. `reload()` on `SUBSCRIBED` and on becoming visible covers events lost while the socket
  was down.

Data access is plain async functions in `src/data/*.ts` that call `supabase` directly and throw
`Error(message)`; the stores own all state and error handling. Keep new queries in that layer rather
than calling `supabase` from components.

**The three order views.** `src/screens/order/OrderScreen.tsx` is a shell — header, sticky view
switcher, basket bar — and swaps only the list body between `RouteView`, `DishView` and `AllView`.
All three render the same `IngredientRow`, so they differ purely in grouping, sorting and the row's
subtitle (`added_by`/unit for Route and Dish, location for All). Three rules they share rather than
each reinvent: `isVisibleInOrder` in `src/lib/orderView.ts` (archived stock is hidden unless it's
already in the basket, or the count would name a row nobody can see), `matchesQuery`/`normalize` in
the same file (diacritic-folding substring match — the catalog is Dutch), and route order — Dish
sorts by location then `sort_order`, not alphabetically, so checking a dish is still one pass along
the shelves.

**Search belongs to the shell, not the views.** `OrderScreen` owns the term and passes it down, so
it survives switching views — find something in All, flip to Route, and it's still filtered, which
is how you learn which shelf it's on. Search and archiving stay *composed*, never merged:
`isVisibleInOrder(i, basket.items) && matchesQuery(i, term)`. An archived row already in the basket
keeps showing; typing a name still means you want that name.

The switcher and the search band are **one** `sticky top-0` block, so anything sticky beneath sits
at `top-[106px]` — that's `RouteView`'s location headers. Two stacked sticky elements at different
offsets is the fiddlier version of the same thing; don't split them again.

**106, not 104 — count the borders.** The controls are 44px + 60px, but each band also carries a
1px `border-b`. This was written down as 104 and was wrong for months: a pinned location header sat
2px under the block and lost its own top hairline. The Catalog's headers are `top-[45px]` for the
same reason (44px tab row + 1px). If you change a band's height, **measure** the block rather than
re-deriving it — `getBoundingClientRect().bottom` on the sticky block, against the `.top` of a
header that has come to rest.

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
per-device localStorage name used purely for the `added_by` label. **It is not identity and grants
nothing** — RLS decides what anyone can read or write and has never heard of it. Don't hang
permission on it.

It does gate the *interface*, though, and deliberately: `Gate` renders `NamePrompt` when there's a
session but no name, above the providers and outside the router, so it can't be routed past or
rendered behind. `added_by` is the only thing the name is for, nobody was ever asked for one, and a
line attributed to nobody is a line you have to go and ask about. (An earlier version of this file
said the name "must never gate anything"; that was about permission, and it still holds for
permission.)

`useDisplayName` is a **module-level store read through `useSyncExternalStore`**, not `useState` per
call site. It has to be: with a copy per component, the only thing that ever reconciled them was the
`storage` event, which fires in *other* tabs only — so changing the name in `NameChip` left the copy
`BasketScreen` hands to `finish_order` stale, and the gate could never see a name being set beneath
it.

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

## Widths

The app is phone-first and the phone layout is the one in service — **below `md` (768px) nothing
about it changes**, and the 44px tap floor and the `text-base` floor don't relax with width either.
One person on a laptop is not a reason to make the phone in the kitchen worse.

Three breakpoints, Tailwind defaults: `md` widens the column, `lg` (1024) splits the Order screen,
`xl` gives the basket pane more room.

**One column width, shared by three things.** `columnWidth` and `wideWidth` in
`src/components/styles.ts` are used by the screen body, by `ScreenHeader`'s inner container and by
any fixed bar, so all three agree on where the content edge is. `ScreenHeader` runs its anthracite
band edge to edge and centres its *contents* — it used to inherit the screen's 672px, which no phone
can tell apart, but on anything wider left a short dark bar floating above a bottom bar that did
span the viewport. Pass `width={wideWidth}` on the Order screen; everything else takes the default.

**The Order screen is two panes at `lg`** — the route column, unchanged, and `BasketPane` beside it,
with the fixed bottom bar `lg:hidden`. The pane is `self-start sticky top-0 max-h-screen`; `self-start`
is load-bearing, because a flex child stretches to the row's height by default and something
full-height can never stick. There is still exactly **one page scroll**: the route column scrolls the
document as it always has, which is what `RouteView`'s sticky headers and `ReorderList`'s
document-space measuring both assume.

`BasketScreen` and `BasketPane` are two renderings of `useOrderSend` (`src/basket/useOrderSend.ts`),
never two implementations. `finish()` lives there because its ordering is load-bearing — `flush()`
first, and `flush()` *rejects* rather than letting a short order go out — and a second copy is how
one copy loses the guard.

**The Catalog stays one column at every width, on purpose.** `ReorderList` measures every row edge
once at drag start and autoscrolls `window`; a grid, or a pane with its own scrollbar, breaks
dragging in a way that only surfaces when someone tries to reorder the route. Widening is safe;
re-flowing is not. `HistoryScreen`'s expanded lines are the one exception (`lg:columns-2`) — static
text with nothing draggable in it.

**Hover states exist but are never the only signal.** Tailwind v4 wraps every `hover:` in
`@media (hover: hover)`, so no touch device inherits one and gets stuck showing it after a tap. The
tint on `IngredientRow` isn't an affordance — the row isn't a target, the stepper is — it's a ruler,
for when the name and the stepper are 700px apart.

## Build phases

`README.md` lists six phases and marks the current one — keep that marker moving as phases land.
Phases 1–5 are committed: scaffold/auth/deploy, schema + Catalog screen, Order screen + basket +
steppers, basket screen + WhatsApp export + finish order + history, and the Dish and All views.

Phase 6 is now largely landed: realtime sync, offline retry queue and PWA are in. Still unbuilt from
that list are **missing-item hints** ("ordered in 3 of the last 10" — `order_lines_ingredient_idx`
exists for it) and **location sweep**.

Ordering flow, end to end: Order screen (walk the route, step quantities) → `/basket` (grouped by
supplier, WhatsApp/copy export, Finish) → `/history`. `src/lib/orderText.ts` owns the grouping and
the message format; WhatsApp's only formatting is `*bold*`.

**Grouping is two passes, and there is no "No supplier" pile.** `groupBasket` puts anything with a
supplier in a supplier group (alphabetical, first) and everything else in a group per *location*
(route order, last). A single heading reading `*No supplier*` is what the message used to lead with,
and it reads as a fault in the app to whoever receives it while saying nothing about where the stock
is. Locations are the walking route, so an unassigned group can still be checked against the shelves,
and the message improves as suppliers get filled in rather than being wrong until the last one is
done. `needsSupplier` is on the group for the Basket screen's benefit only — **nothing about the
app's own state goes in the text**, which is sent to an outside supplier.

## Comment style

Existing comments explain *why* a non-obvious choice was made, often with the kitchen constraint that
forced it, and never restate the code. Match that density — this codebase is deliberately
lightly-but-substantively commented.
