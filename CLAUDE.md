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
authenticated using (true)`. There are no roles and no per-user ownership. **This is only safe while
signups are disabled in Supabase Auth**, since "authenticated" would otherwise mean "anyone". Don't
add user-scoped logic expecting `auth.uid()` to be meaningful. Signups were open for a while and the
whole database was reachable by anyone who found the URL; `shouldCreateUser: false` on
`signInWithOtp` is the client-side half of that fix, and it must stay.

`finish_order(p_sent_by)` (migration `0002`) is the only server-side function. It writes the order,
copies the basket into `order_lines`, and empties `basket_items` in one call so a phone that drops
signal can't clear the basket without recording it; an empty basket raises and rolls the order row
back. It is `security invoker`, so RLS still applies and it grants nothing extra.

Two deletion rules encode intent: `order_lines.ingredient_id` is `on delete restrict` and ingredients
carry an `archived` flag — history must keep resolving, so archive ingredients instead of deleting.
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

Tailwind v4 via `@tailwindcss/vite`; the only CSS file is `src/index.css` (`@import 'tailwindcss'`
plus a few body/safe-area rules). Shared control classes live in `src/components/styles.ts` — reuse
`input`, `primaryButton`, `secondaryButton`, `quietButton`, `dangerButton` rather than re-deriving
them.

`ReorderList` uses pointer events, not HTML5 drag-and-drop, which doesn't fire on touch at all.
Drag handles need `touch-none`; measurements are in document space so page scroll mid-drag doesn't
skew them.

## Build phases

`README.md` lists six phases and marks the current one — keep that marker moving as phases land.
Phases 1–4 are committed: scaffold/auth/deploy, schema + Catalog screen, Order screen + basket +
steppers, and basket screen + WhatsApp export + finish order + history. Phase 5 is current: Dish and
All views. Then realtime sync, missing-item hints, location sweep, offline retry queue and PWA —
`basket_items` is already in the `supabase_realtime` publication with `replica identity full`, and
`order_lines_ingredient_idx` exists for the "ordered in 3 of the last 10" hint.

Ordering flow, end to end: Order screen (walk the route, step quantities) → `/basket` (grouped by
supplier, WhatsApp/copy export, Finish) → `/history`. `src/lib/orderText.ts` owns the grouping and
the message format; WhatsApp's only formatting is `*bold*`.

## Comment style

Existing comments explain *why* a non-obvious choice was made, often with the kitchen constraint that
forced it, and never restate the code. Match that density — this codebase is deliberately
lightly-but-substantively commented.
