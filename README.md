# Drift

**Pull a thread. See where it goes.**

Drift is a calm, local-first web app for *healthy scrolling* — an antidote to doomscroll slot
machines. It's a feed of full-screen knowledge cards where **you are the algorithm**: every
card shows visible "threads" (related directions) you pull to steer your own rabbit hole.
Sessions have a beginning (a topic seed), a middle (the trail), and an end (a shareable
**trail map** of where your curiosity wandered).

Content comes from vetted, human-curated sources — **Wikipedia** (the Encyclopedia realm) and
the **Art Institute of Chicago's** public-domain collection (the Gallery realm). AI only ever
*reshapes*; it never invents facts.

## The anti-slot-machine principles (non-negotiable)

1. **Transparency over opacity** — you always see *why* the next card appeared.
2. **Agency over autoplay** — nothing advances on its own; at most one card is prefetched.
3. **Sessions have shape** — the reward (your trail map) is at the *exit*, not the next swipe.
4. **Gentle awareness, not guilt** — a quiet counter, a soft nudge; no streaks, no badges.
5. **Content is vetted, AI only reshapes** — never invents facts.

See `CLAUDE.md §2` for the full statement — these bind every feature, including the social arc.

## Run it

```bash
npm install
npm run dev        # → http://localhost:3000
```

Other scripts:

```bash
npm run build            # production build — also the type-check gate
npm run lint             # eslint
npm run test             # vitest (pure-logic unit tests)
npm run verify:supabase  # check the cloud backend (only if you set it up)
npm run verify:social    # check the friends/sharing tables + RLS
```

## Accounts & cloud sync

With **no Supabase env configured** (a fresh local clone), Drift is fully usable **signed-out
and local** — everything lives in your browser via IndexedDB, no sign-in. With Supabase
**configured** (the hosted app), Drift **requires an account**: a calm sign-in gate fronts the
app, each account's data is private to it, and your trails/interests/reactions/settings sync
across devices. The backend degrades gracefully — if it's unreachable, drifting still works.

Setup and the "how to scale it" guide are in **[`docs/backend.md`](docs/backend.md)**.

## Deploy it (free) & install on your phone

Put Drift online for free on Vercel (backed by your Supabase project) and add it to your phone
home screen as a standalone web-app — step-by-step in **[`docs/deploy.md`](docs/deploy.md)**.

## Tech

Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind v4 · `motion` ·
`localforage` (IndexedDB) · `html-to-image` · Supabase (optional) · vitest. Pure logic lives
in `src/lib/*` (small, unit-tested, no React/DOM) so it can be reused by a future mobile app.

## Docs

- **`drift-spec.md`** — the product spec.
- **`plan.md`** — the living implementation plan & progress tracker (source of truth for where things are).
- **`CLAUDE.md`** — working rules + hard-won technical facts.
- **`docs/backend.md`** — accounts, cloud sync, and scaling.
- **`docs/deploy.md`** — going live on Vercel + installing as a phone web-app.

## Contact

`/contact` is a public feedback form. It emails a receipt to whoever wrote and a notification
to the Drift inbox with `Reply-To` set to them. Anti-spam is a honeypot, a fill-time floor and
a per-IP throttle, plus optional Cloudflare Turnstile. Setup is in
[`docs/deploy.md`](docs/deploy.md).

*A hobby project for personal use — no analytics, no engagement metrics, no dark patterns.*
