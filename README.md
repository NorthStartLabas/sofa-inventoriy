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

### Since then

Three things came out of the first week of real use:

**The message no longer says "No supplier".** Anything with a supplier is grouped under it;
everything else is grouped by *location*, in walking-route order. The old behaviour only
avoided that heading when the catalog had no suppliers at all, so the moment the first one
was filled in, every message carried a `*No supplier*` block. Locations are something the
person receiving the list can actually check against the shelves.

**You're asked for your name once, before the app opens.** `added_by` is the only thing the
name is for, and nothing ever asked for one, so lines went out attributed to nobody. It's
still per-device, still grants nothing, and is still changed from the header afterwards.

**It works on a tablet and a computer.** Below 768px nothing changed — the phone layout is
the one in service. Above it the column widens and sits as a sheet on the sand ground; from
1024px the Order screen splits in two, with the basket live beside the list instead of
behind a tap, and the bottom bar drops away. The PWA is no longer locked to portrait, which
it had to stop being for an installed iPad to reach any of this.
