# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ingredient ordering for a restaurant kitchen, used on phones with wet hands in a bright room.
That context drives most of the design decisions below — controls are ≥44px, text is `text-base`
everywhere (no `text-sm`), and the walking route through the kitchen is the primary sort order.

**It is not a two-person kitchen any more.** Six accounts exist and orders have gone out under
several names. Much of this app was designed for two people who could reasonably be assumed to be
looking at the same thing — one shared basket, a name kept on the device — and each of those
assumptions has since been replaced. If you find advice here that assumes two people, it's a
leftover; treat it as a bug in this file.

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
**`sofa-inventoriy-dev`** (ref `upkidadrscyigcycvofx`), holding a copy of the real catalog. Local
`.env` points there; the live credentials live in `.env.live.backup` (both gitignored, and
production reads its own from repo secrets, so neither file can affect the deployed site). Swap
back only when the branch has been merged.

Search is read-only and harmless, but the basket, realtime sync and bulk supplier assignment all
write — and staff see those writes immediately. Migrations get applied to the dev project first,
then to live at merge time.

Re-seeding the dev project: apply `supabase/migrations/*` in order, then copy the catalog across
by name rather than by id (`string_agg` the rows out of live, `string_to_array` them back in).
Ids don't need to match, and a dump of full INSERT statements is too large to move in one piece.

## Database

The schema lives in `supabase/migrations/`, applied by pasting each numbered file into the
Supabase SQL editor in order. Every one is written to be re-runnable (`if not exists` /
`drop if exists` / `on conflict do nothing`). There is no Supabase CLI workflow here — later
migrations should follow the same idempotent, paste-once style as new numbered files.

**Permission model.** Most tables have RLS on with a single `authenticated_all` policy — `for all
to authenticated using (true)`. "Authenticated" means "anyone with an account", and an account
means the whole catalog and the whole history.

Two tables are exceptions, and they're the pattern to follow when a table genuinely needs one:
`profiles` and `basket_items` split into **read-open, write-your-own** policies
(`using (true)` for select; `user_id = (select auth.uid())` for insert/update/delete). Reading has
to stay open on both — the duplicate-order warning has to be able to say *whose* basket something
is already in, and name it. Wrap `auth.uid()` in a scalar subquery so it's evaluated once per
statement rather than once per row.

**Registration is closed** (2026-08-15), reversing the 2026-08-12 decision. Sign-in is email +
password (`signInWithPassword`); there is no `signUp` call anywhere in the client, and "Allow new
users to sign up" is off in Supabase Auth. New people get an account made for them in the
dashboard with a temporary password, and `profiles.must_change_password` forces them to choose
their own on first sign-in. This is the fix for what this file flagged for three days: open
registration against `for all to authenticated using (true)` means anyone who finds the Pages URL
owns the database.

**A name belongs to the account** (migration `0005`). `public.profiles` holds `name` and
`must_change_password`, one row per `auth.users` row, created by a `security definer` trigger —
definer because a trigger on `auth.users` runs as `supabase_auth_admin`, which has no rights on
`public`. The name used to be per-device localStorage, which is what made a phone and a laptop
disagree about whether the app had ever asked for one. `orders.sent_by` and `basket_items.added_by`
stay **text snapshots** for the same reason `order_lines` keeps its own `ingredient_name`
(migration `0004`): renaming yourself must not rewrite what past orders say.

**A basket belongs to the account** (migration `0006`). `basket_items.user_id` is not null with a
`default auth.uid()`, and the unique constraint moved from `ingredient_id` to
`(user_id, ingredient_id)`. That one line is what makes the baskets independent — and it is the
same mechanism as before, one row per ingredient *per person*, upserted rather than summed, which
is still what lets one person's two phones sync row by row instead of overwriting each other with
a whole-basket blob. `orders.user_id` was added alongside it; `sent_by` remains the display text.

`finish_order(p_sent_by)` is the only server-side function. It writes the order, copies **your**
basket into `order_lines`, and empties **your** rows in one call so a phone that drops signal
can't clear the basket without recording it; an empty basket raises and rolls the order row back.
It is `security invoker`, so RLS still applies and it grants nothing extra.

Every `UPDATE` and `DELETE` needs a `WHERE` clause, including inside a function body. The
`authenticator` role — the one PostgREST connects as — runs with `session_preload_libraries =
supautils, safeupdate`, and `safeupdate` rejects unqualified writes with `DELETE requires a WHERE
clause`. The SQL editor connects as a different role without it, so a bare `delete` will pass when
you paste a migration and fail the moment the app calls it. Migration `0003` fixed exactly that in
`finish_order` with `where true`; `0006` replaced that with `where user_id = auth.uid()`, so the
clause safeupdate demands and the clause correctness demands are now the same clause.

**An order line remembers itself** (migration `0004`). `order_lines` carries its own
`ingredient_name` and `unit`, written by `finish_order` at send time, and `ingredient_id` is
`on delete set null`. So an ingredient can be deleted for good and History still reads correctly —
menus change, and the old rule (`on delete restrict` + archive-only) made anything ever ordered
permanently undeletable, which in turn made its location permanently undeletable. It also fixes a
quieter bug: History used to resolve names against the *live* catalog, so renaming an ingredient
silently rewrote every past order that mentioned it. Never reintroduce a catalog lookup there.

Nothing blocks `deleteIngredient` — `dish_ingredients` and `basket_items` cascade, order lines
null out. Archiving still exists, but as "hide it, keep it orderable later", not as a substitute
for deleting. `locations` stays `on delete restrict` from `ingredients`: emptying a location first
is deliberate, not an obstacle.

**Realtime.** `basket_items` (migration `0001`) and `orders` (migration `0007`) are both in the
`supabase_realtime` publication. `basket_items` has `replica identity full`, which is what makes
DELETE usable — without it `payload.old` carries only the primary key, and both the map key and
the "whose row is it" question need `user_id`.

## Architecture

Provider nesting in `src/App.tsx`: `AuthProvider` → `HashRouter` → `Gate` → `ProfileProvider` →
`CatalogProvider` → `BasketProvider` → routes, with `AlreadyProvider` inside the Order screen.
Catalog and basket sit *inside* the auth gate because RLS means neither can be read without a
session; the profile sits above both because the gate itself routes on it.

**Context split.** Each provider is two files: the `createContext` + `useX()` hook in a lowercase
`*Context.ts`, and the `<XProvider>` component in a `.tsx`. This is deliberate — `oxlint`'s
`react/only-export-components` (and fast refresh) break if a module exports both a component and a
hook. Follow the pattern when adding providers, and put helper functions a component needs in
`src/lib/` rather than beside it (`alreadyText.ts` exists for exactly that reason).

**Three state stores, three different consistency stories:**

- `useCatalog` (`src/data/useCatalog.ts`) — one shared fetch of all five catalog tables. Edited by
  one person at a time, so `mutate(optimistic, persist)` applies the change locally and, on failure,
  surfaces an error and re-reads the server rather than reconciling. `run(work)` is the variant for
  inserts, where the id only exists after the server replies. `getCatalog()` returns the catalog as
  of *now* rather than as of the last render — needed by any handler that derives its write from the
  current set, because React runs state updaters during render, long after the request went out.

- `ProfileProvider` (`src/auth/ProfileProvider.tsx`) — the account's name and password state, read
  once per sign-in. `localStorage` is still used but **only as a paint cache keyed by user id**, so
  the header doesn't flash empty; the row in the database is the truth and the cache never decides
  anything. It also holds `names`, every account's name, for labelling somebody else's basket row.

- `BasketProvider` (`src/basket/BasketProvider.tsx`) — a `Map` of **every** basket row in the
  building, keyed `${user_id}:${ingredient_id}`, split on the way out into `items` (yours, keyed by
  ingredient) and `others` (everyone else's, keyed by ingredient). One query and one realtime
  channel feed both; the warning gets its live data for free. 400ms per-ingredient debounce, since
  steppers get tapped fast. Writes go through `upsert` on `user_id,ingredient_id` (replace, never
  sum). Setting a quantity to 0 deletes the row; that is how items leave the basket. `flush()` sends
  anything still on a timer, drains the retry queue, and resolves when it lands — it runs on
  `visibilitychange`/`pagehide` (a pocketed phone used to lose the last tap outright) and **must**
  be awaited before `finishOrder`, which reads the basket server-side. It **rejects** if the queue
  won't drain; `BasketScreen` must let that stop the send rather than swallow it, or an order
  silently goes out short.

  Pending writes are plain `BasketWrite` data, not closures, because the retry queue has to survive
  a reload — and each write carries its own `user_id`, so one replayed after somebody else signed in
  on that device is refused by RLS instead of landing in the wrong basket. `src/basket/retryQueue.ts`
  holds failed writes in localStorage **keyed by account**, one entry per ingredient, last wins,
  mirroring the upsert: the basket is a quantity, not a history of taps. Only *retriable* failures
  are queued. `src/data/basket.ts` throws `BasketWriteError` and decides that at the point of
  failure — a PostgREST rejection carries a `code` and is the server saying no; a fetch that never
  arrived has none. **Don't sniff error strings in the provider**, and don't replay refusals.

  The realtime handler ignores events for **your own** ingredients with a change still in flight
  (`pending` or `unsaved`), or your own echo would overwrite a newer tap. Somebody else's rows are
  always applied: nothing local is racing them. It does **not** merge concurrent edits — but with a
  basket each, that case has largely stopped existing. `reload()` on `SUBSCRIBED` and on becoming
  visible covers events lost while the socket was down.

Data access is plain async functions in `src/data/*.ts` that call `supabase` directly and throw
`Error(message)`; the stores own all state and error handling. Keep new queries in that layer rather
than calling `supabase` from components.

**"Somebody already ordered that today."** `AlreadyProvider` (`src/basket/AlreadyProvider.tsx`)
owns both halves and the confirm sheet. Splitting the baskets is what made it necessary: with one
shared basket a duplicate was visible on the row, because the quantity was simply already there.

- *Sent today* comes from `fetchOrderedToday()` in `src/data/orders.ts` — `order_lines` embedded
  into `orders` with `!inner` (without `!inner` PostgREST returns every line and merely nulls the
  ones that don't match) and filtered on a day boundary computed **on the device**. The phone is
  standing in the kitchen and its clock is the kitchen's clock, which beats hard-coding a timezone
  into a query.
- *Waiting in a basket* is `basket.others`, already live.

Every stepper on the Order screen writes through `already.step()` rather than `basket.setQuantity`,
so the question is asked in one place instead of three. It asks **only on the way up from zero**,
and remembers the answer for the session: a warning that fires again on the fourth tap of `+` is a
warning people learn to swat away without reading.

**The three order views.** `src/screens/order/OrderScreen.tsx` is a shell — header, sticky view
switcher, basket bar — and swaps only the list body between `RouteView`, `DishView` and `AllView`.
All three render the same `IngredientRow`, so they differ purely in grouping, sorting and the row's
subtitle (`added_by`/unit for Route and Dish, location for All). Three rules they share rather than
each reinvent: `isVisibleInOrder` in `src/lib/orderView.ts` (archived stock is hidden unless it's
already in the basket, or the count would name a row nobody can see), `matchesQuery`/`normalize` in
the same file (diacritic-folding substring match — the catalog is Dutch), and route order — Dish
sorts by location then `sort_order`, not alphabetically, so checking a dish is still one pass along
the shelves.

`IngredientRow`'s subtitle slot takes one line and three things want it, ranked by urgency:
`unsaved` → the already-ordered warning → whatever the view wanted to say. The warning text in
`src/lib/alreadyText.ts` is short on purpose — roughly 24 characters fit beside a 160px stepper on
a 390px row, and a warning truncated at "Raisa has 1 Bus in their…" has spent its width on the
least useful half of the sentence. The clock time lives in the sheet, where you're deciding rather
than glancing.

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
header that has come to rest, sampled at several scroll positions. A header only rests while its
own section is the one under the block.

**Sort order.** `locations.sort_order` and `ingredients.sort_order` are the physical walking route
and are never auto-sorted — always user-dragged via `ReorderList`. `ingredients.sort_order` is only
ever compared within a location, so each location numbers from zero. `persistOrder` writes one
`update` per row on purpose.

## Routing and auth

`HashRouter`, because GitHub Pages 404s on deep links with `BrowserRouter`. That collides with
Supabase's emailed links, which return `#access_token=…` in the same hash slot — so
`detectSessionInUrl` is **off** and `src/lib/authCallback.ts` consumes the fragment and rewrites
the hash to `#/` before the router mounts. If you touch auth or routing, keep that ordering intact.

**Sign-in is email + password** (2026-08-15). It used to be magic-link only, and the link was the
whole problem: on an iPhone with the app on the home screen, tapping it in Mail opens Safari, the
session lands *there*, and the installed app is never signed in at all. A password is typed where
you already are.

One emailed link remains — `resetPasswordForEmail`. It comes back through the same fragment, and
`consumeAuthFromUrl` reports `type=recovery` so `Gate` can route to `SetPassword` rather than into
the app. `AuthProvider` also listens for the `PASSWORD_RECOVERY` auth event, since a link opened in
an already-running tab never re-runs the callback. `AuthProvider.readable()` is the single place
GoTrue's wording gets translated into something a person standing in a kitchen can act on.

**`Gate` is five checks in order**, above the providers and outside the router so nothing routed can
be bookmarked past it or rendered behind it: session → profile loaded → `must_change_password` (or
recovering) → name → app. Password before name is deliberate: a temporary password is a door
standing open, and asking someone's name first leaves it open a screen longer. `ProfileProvider` is
keyed on `session.user.id`, so signing out and back in as someone else rebuilds it rather than
briefly showing the last person's name.

`useProfile().name` gates the *interface* and nothing else. **It is not identity and grants
nothing** — RLS decides what anyone can read or write and has never heard of it. Don't hang
permission on it. It does gate the interface deliberately, though: `added_by` is the only thing it
is for, and a line attributed to nobody is a line you have to go and ask about.

**The installed app updates itself, and that had to be built.** `registerType` is `'prompt'`, not
`'autoUpdate'`, and `src/lib/serviceWorker.ts` owns both halves: it *asks* whether a new version
exists (on a timer and every time the page becomes visible — a home-screen app is never navigated,
so it never checked at all before), and it *chooses the moment* to take one, which is the next time
the page becomes visible after having been hidden. Never a reload under a thumb mid-service, and
nothing is lost either way because `BasketProvider` flushes on `pagehide`. `injectRegister: null`
in `vite.config.ts` stops the plugin also injecting its own registration script.

## UI conventions

Tailwind v4 via `@tailwindcss/vite`; the only CSS file is `src/index.css`, which owns the design
tokens in an `@theme` block. Shared control classes live in `src/components/styles.ts` — reuse
`input`, `primaryButton`, `secondaryButton`, `quietButton`, `dangerButton`, `headerLink` and the
`tab(active)` helper rather than re-deriving them. Every screen's top band is `ScreenHeader`.

**The palette is the SOFA management dashboard's, copied from
`NorthStartLabas/sofamaastricht-dashboard` `src/app/globals.css`** — warm cream paper, burgundy
accent, warm-tinted elevation. Two apps for one restaurant should not look like two restaurants.
Use the tokens, never raw Tailwind palette names: `bg-paper`, `bg-surface`, `bg-surface-2`,
`text-ink`, `text-ink-2`, `border-line`, `border-line-2`, `bg-wine`/`text-wine`, `bg-wine-ink`,
`text-cream`, `text-bad`/`bg-bad-bg`, plus `good`/`watch` and their washes.

What did **not** come across from the dashboard is its sizing. It is read sitting down on a laptop
and uses 12–14px type and 32px controls. **Never go below `text-base`** — it's the wet-hands floor
and it stops iOS zooming on focus — and **every tap target clears 44px**. Those two do not bend for
a palette, for a breakpoint, or for anyone on a laptop.

Two tokens are restricted: **`ink-3` is decorative only** (2.65 on paper — below AA, never body
text; `ink-2` at 5.20 is the secondary-text token), and **`watch` is large-text only** (3.47).
**Every other pair clears WCAG AA — check any new pair before using it**; worst in actual use is
`ink-2` on `surface-2` at 4.89.

Unlike the apricot it replaces, **wine works as text on paper** (8.12, against apricot's 1.37 on
white). The old "the accent has exactly two jobs and neither is text" rule was a workaround for a
colour that couldn't be text, and it retired with the colour.

**The two dark bands.** `ScreenHeader` on every screen and the fixed basket bar on the Order screen
both use `.spotlight` — the dashboard's burgundy gradient, which is what it uses for a tile that
isn't part of the calm cream field. Here it marks the strips that aren't the list. Cream on it runs
5.38 at the gradient's lightest corner to 11.54 at its darkest, so text sits anywhere along it.
Anything placed in the header must be `text-cream`. The header owns `env(safe-area-inset-top)`
rather than `body` — paint it on `body` and a notched phone gets a cream strip above a dark band.

**Type.** Body is **Inter**, with the dashboard's own `font-feature-settings`. Display is
**Cormorant Garamond**, in two classes that must not be confused: `.label` (caps, `.16em` tracked —
the dashboard's `.wordmark`) marks **things in the kitchen**, a location, a supplier, a dish, a
screen title; `.page-title` (sentence case, tight) is the poster headline on the three cover
screens. Not navigation: caps words don't fit 390px, which is why both tab rows are sentence case.
Both faces are bundled via `@fontsource` latin subsets and **never fetched at runtime**.

**Numbers never go in the serif.** Cormorant's x-height is small and its figures are old-style, so
a count set in it reads a size or two below the 16px it actually is. `.label .num` puts it back in
Inter, and standalone counts use `.num` directly. For the same reason `.label :is(input, textarea,
select)` resets nested form controls — Preflight gives them `font: inherit`, so the name field in
the header had been rendering as tracked caps since the day `.label` was written.

**Shapes** follow the dashboard: 18px cards (popovers, the confirm sheet), 13px insets (fields),
pill controls, and `--shadow-1`/`--shadow-2` as `.lift`/`.lift-2`. The sticky control block carries
`.lift` so the list visibly passes underneath rather than stopping.

The **active tab** is a wine fill rather than the dashboard's `.seg-on` surface-lift. A lift is a
fine signal on a desk and a weak one under a service light, and which of three lists you are
looking at is not something to have to work out.

**The route rail** — the rule down the left of `RouteView`, `wine/25` between stops and solid
`wine` at each location — belongs to that view alone. Route is the only one of the three whose
order means something in the room, so it's the only one that gets a structural device saying so.
Don't add it to Dish or All; there it would be decoration.

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
any fixed bar, so all three agree on where the content edge is. `ScreenHeader` runs its band edge
to edge and centres its *contents* — it used to inherit the screen's 672px, which no phone can tell
apart, but on anything wider left a short dark bar floating above a bottom bar that did span the
viewport. Pass `width={wideWidth}` on the Order screen; everything else takes the default.

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
Phases 1–6 are committed. Still unbuilt from the phase-6 list is the **location sweep**;
missing-item hints ("ordered in 3 of the last 10") were overtaken by the already-ordered warning,
which answers the same question with today's data instead of a ten-order average.

Ordering flow, end to end: Order screen (walk the route, step quantities) → `/basket` (grouped by
supplier, WhatsApp/copy export, Finish) → `/history`. `src/lib/orderText.ts` owns the grouping and
the message format; WhatsApp's only formatting is `*bold*`. Each person sends their own order.

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
