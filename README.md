# Kitchen orders

Ingredient ordering for a two-person kitchen. Phones, wet hands, bright room.

Live: https://northstartlabas.github.io/sofa-inventoriy/

## Stack

Vite + React + TypeScript · Supabase (database, realtime, auth) · Tailwind CSS · GitHub Pages via Actions.

## Local development

```bash
cp .env.example .env   # fill in from Supabase → Settings → API
npm install
npm run dev
```

Open http://localhost:5173/sofa-inventoriy/ — the path matters, `base` is set to the
repo name so the dev server mirrors production.

Only the **publishable** (anon) key goes in `.env`. The secret/service_role key bypasses
Row Level Security and must never appear in this repo or the bundle.

Run each file in `supabase/migrations/` once, in order, in the Supabase SQL editor.

**Signups are open, by the owner's decision (2026-08-12).** Every table is readable and
writable by any signed-in user — there are no roles and no per-user ownership — so an
account is the whole database, and anyone who finds the Pages URL can create one. If that
should change, the fix is an `allowed_emails` table enforced by a trigger on `auth.users`,
or per-user RLS. Not the client's `shouldCreateUser` flag, which only changes the error
message an unknown address sees.

## Deployment

Push to `main`. `.github/workflows/deploy.yml` builds and publishes to GitHub Pages,
reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from repo secrets.

One-time setup:

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Repo **Settings → Secrets and variables → Actions**: add the two `VITE_` secrets
3. Supabase **Authentication → URL Configuration → Redirect URLs**: add
   `https://northstartlabas.github.io/sofa-inventoriy/` and `http://localhost:5173/sofa-inventoriy/`

## Notes

- `HashRouter`, because GitHub Pages 404s on deep links with `BrowserRouter`.
- The magic-link fragment is consumed in `src/lib/authCallback.ts` before the router
  mounts, since Supabase and HashRouter both want to own `location.hash`.

## Build phases

1. ~~Scaffold, auth, deploy pipeline~~
2. ~~Schema migration + Catalog screen~~
3. ~~Order screen (Location view), basket, steppers~~
4. ~~Basket screen, WhatsApp export, finish order, history~~
5. ~~Dish and All views~~
6. Realtime sync, offline retry queue, PWA — **current**

Phase 6 was dropped once and then reinstated: real use made the case for it. Two of the
first four orders went out from different phones an hour apart, so "two people rarely
order at the same moment" stopped being true.

What landed: the basket syncs live between phones, writes that can't reach the server are
queued on the device and replayed when signal returns, and the app installs to the home
screen. Concurrent edits to the *same* row still resolve last-write-wins — nothing merges
— but both phones now agree on the result instead of disagreeing silently.

Still unbuilt from that list: missing-item hints ("ordered in 3 of the last 10") and the
location sweep.
