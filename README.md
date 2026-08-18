# Kitchen orders

Ingredient ordering for a restaurant kitchen. Phones, wet hands, bright room.

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

**Sign-up is closed (2026-08-15).** You make the accounts:

1. Supabase → **Authentication → Users → Add user**, with a temporary password.
2. Tell them the password. They're forced to choose their own the first time they sign in.

Keep **Authentication → Providers → Email → "Allow new users to sign up"** off. Every
table is readable by any signed-in user and most are writable by them — there are no roles
— so an account is the whole database. It was open for three days and anyone who found the
Pages URL could have taken one.

## Deployment

Push to `main`. `.github/workflows/deploy.yml` builds and publishes to GitHub Pages,
reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from repo secrets.

One-time setup:

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Repo **Settings → Secrets and variables → Actions**: add the two `VITE_` secrets
3. Supabase **Authentication → URL Configuration → Redirect URLs**: add
   `https://northstartlabas.github.io/sofa-inventoriy/` and `http://localhost:5173/sofa-inventoriy/`
   — still needed, for password-reset links.

## Notes

- `HashRouter`, because GitHub Pages 404s on deep links with `BrowserRouter`.
- Password-reset links come back in the hash and are consumed in `src/lib/authCallback.ts`
  before the router mounts, since Supabase and HashRouter both want to own `location.hash`.
- The installed app checks for a new version on a timer and whenever it comes back into
  view, and takes one the next time you put the phone down and pick it up.

## Build phases

1. ~~Scaffold, auth, deploy pipeline~~
2. ~~Schema migration + Catalog screen~~
3. ~~Order screen (Location view), basket, steppers~~
4. ~~Basket screen, WhatsApp export, finish order, history~~
5. ~~Dish and All views~~
6. ~~Realtime sync, offline retry queue, PWA~~ — **current**

Still unbuilt from phase 6: the location sweep. Missing-item hints ("ordered in 3 of the
last 10") were overtaken by the already-ordered warning below, which answers the same
question with today's data rather than a ten-order average.

### Week one

**The message no longer says "No supplier".** Anything with a supplier is grouped under it;
everything else is grouped by *location*, in walking-route order. The old behaviour only
avoided that heading when the catalog had no suppliers at all, so the moment the first one
was filled in, every message carried a `*No supplier*` block. Locations are something the
person receiving the list can actually check against the shelves.

**You're asked for your name once, before the app opens.** `added_by` is the only thing the
name is for, and nothing ever asked for one, so lines went out attributed to nobody.

**It works on a tablet and a computer.** Below 768px nothing changed — the phone layout is
the one in service. Above it the column widens and sits as a sheet on the paper ground; from
1024px the Order screen splits in two, with the basket live beside the list instead of
behind a tap, and the bottom bar drops away.

### Week two

Six accounts and several names later, three assumptions had to go.

**Sign in with a password.** The magic link never worked properly on an iPhone with the app
on the home screen: tapping it in Mail opens Safari, the session lands there, and the
installed app stays signed out forever. Now you type a password where you already are. The
only email left is a password reset. Sign-up is closed and accounts are made for people —
which also closes a hole that had been open since the 12th.

**Your name is on your account, not on the phone.** It used to live in each device's
localStorage, which is why a laptop asked for a name and a phone that had set one months
earlier never did — they genuinely held different state, and the phone looked broken. Now it
follows you to anything you sign in on, and one name is all anyone ever sets.

**A basket each.** Two people building one shared basket meant the second to press Finish
sent an order that had already gone out. Your Finish now sends only your basket, and History
shows one order per person.

**And, because of that, a warning.** With one shared basket you could see a duplicate — the
quantity was simply already there. Now the only way to see it is to be told, so adding
something somebody else ordered today, or has waiting in their basket right now, asks first.
It asks once per ingredient, on the way up from zero, and remembers the answer.

### Week three

**History is somewhere you can go.** It's a link in the Order screen header now, instead of only
being the screen you land on after pressing Finish. Orders are grouped under Today / Yesterday /
Fri 15 Aug, and **Show older** pages further back.

**A sent order can still be sent.** Open any past order and it lays out per supplier, with the same
Copy and WhatsApp buttons the basket has. The old buttons sat to the left of Finish, so pressing
Finish first was easy to do and impossible to undo — the list was recorded and the messages never
went. Now the list outlives the basket.

A re-sent order carries the date it was *made*, and says what it said at the time: renaming an
ingredient never rewrites a past order. Where it goes is worked out fresh, though — if that stock
has moved to another supplier since, the message goes to the new one.

**Mise en place: asked for, not built.** The kitchen doesn't weigh anything and doesn't work off a
daily list — somebody notices one bak left, or has ten minutes spare. Nothing that was sketched beat
paper, so paper keeps it for now. Notes on the shape that might work are in `CLAUDE.md`.

**The theme is the management dashboard's**, copied from
`NorthStartLabas/sofamaastricht-dashboard`: cream paper, burgundy accent, Cormorant Garamond
over Inter. Two apps for one restaurant shouldn't look like two restaurants. What didn't come
across is its sizing — that's a laptop dashboard at 13px, and this is still 16px minimum with
44px targets, because it's still read standing up with wet hands.
