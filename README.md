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
4. **Basket screen, WhatsApp export, finish order, history** ← current
5. Dish and All views
6. Realtime sync, missing-item hints, location sweep, offline retry queue, PWA
