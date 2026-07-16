# Drift — Going Live (deploy free + install on your phone)

A step-by-step checklist to put Drift online for **free** on **Vercel**, backed by your
**existing Supabase** project, and install it on your phone as a web-app. No custom domain
needed — you get a free `*.vercel.app` URL.

> Prerequisites (already true for this repo): the Supabase project is provisioned and the
> three migrations in `supabase/migrations/` are applied (see `docs/backend.md` §3). Your
> local `.env` already holds the working Supabase keys. Nothing here changes the backend.

---

## What deploying changes about the app

- **An account is now required on the hosted site.** Because the URL is public, a logged-out
  visitor sees a calm sign-in / create-account screen instead of drifting anonymously, and
  **each account only ever sees its own trails** (local data is cleared on sign-out). This is
  active only because the cloud is configured — a local clone with no Supabase env is still the
  old fully-local app.
- **It's installable.** Add-to-home-screen gives you a standalone, chrome-free Drift with its
  own icon.

---

## Step 1 — Push to GitHub

This repo is already connected to your GitHub. Commit the working tree and push:

```bash
git add -A
git commit -m "Phase 13: require account when hosted, installable PWA, deploy config"
git push
```

(Secrets are safe: `.gitignore` excludes `.env*` except `.env.local.example`, so no keys are
committed.)

## Step 2 — Import the project on Vercel

1. Go to <https://vercel.com> → sign in with GitHub (free **Hobby** plan).
2. **Add New… → Project** → pick this repository → **Import**.
3. Framework is auto-detected as **Next.js**. Leave every build setting at its default
   (no `vercel.json`, no overrides needed). **Don't click Deploy yet** — add the env vars first
   (Step 3), or deploy once and add them, then redeploy.

## Step 3 — Set Environment Variables (the important step)

In the Vercel project → **Settings → Environment Variables**, add these for **Production**
_and_ **Preview** (copy the values from your local `.env`):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project>.supabase.co` | from `.env` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | from `.env` — safe in the browser (RLS protects data) |
| `WIKI_USER_AGENT` | `Drift/1.0 (https://<your>.vercel.app; you@email)` | optional but polite to Wikimedia |
| `ARTIC_USER_AGENT` | `Drift/1.0 (https://<your>.vercel.app; you@email)` | optional (Art Institute) |

> ⚠️ **Do NOT add `SUPABASE_SECRET_KEY`** (or `SUPABASE_URL` / `SUPABASE_EMAIL` /
> `SUPABASE_PASSWORD`) to Vercel. The secret key bypasses Row-Level Security and is used
> **only** by the local `npm run verify:*` scripts — it must never reach the browser build.

The two `NEXT_PUBLIC_*` values are inlined at build time, so if you add them after the first
deploy, **redeploy** (Deployments → ⋯ → Redeploy) for them to take effect.

## Step 4 — Point Supabase at the Vercel URL

After the first deploy you'll have a URL like `https://drift-xxxx.vercel.app`. In the Supabase
dashboard → **Authentication → URL Configuration**:

1. Set **Site URL** to your Vercel production URL.
2. Under **Redirect URLs**, add both:
   - `https://drift-xxxx.vercel.app/**`
   - `https://*-<your-vercel-scope>.vercel.app/**` (so preview deployments work too)
3. Leave **Authentication → Providers → Email → "Confirm email" OFF** for now — this keeps
   sign-up frictionless for you and a few friends. (With it off, anyone with the link can create
   an account, but RLS keeps every account's data private; revisit before sharing widely — see
   `docs/backend.md` §6–7 for invite-gating / confirmation + custom SMTP.)

## Step 5 — Deploy & smoke-test

1. **Deploy** (Vercel → Deployments → Redeploy, or it auto-deploys on push).
2. Open the `*.vercel.app` URL in a desktop browser → you should see the **sign-in gate**.
3. **Create your account** → you should land in Drift. Pick a seed, pull a thread, **End & view
   trail → Save**. Reload → the trail persists (it synced to Supabase).
4. Optional: set a **handle** on `/account` if you want to use Friends/Inbox.

## Step 6 — Install on your phone

1. On your phone, open the same `*.vercel.app` URL (Safari on iOS, Chrome on Android).
2. **Sign in** with the account you made.
3. **iOS:** Share button → **Add to Home Screen**. **Android:** ⋮ menu → **Install app** /
   **Add to Home screen**.
4. Launch Drift from the new home-screen icon — it opens **standalone** (no browser bar), like
   an app. Save a trail on the phone; it appears on your desktop after signing in there too.

---

## Free-tier notes (so nothing surprises you)

- **Vercel Hobby (free):** ~100 GB bandwidth, ~100k function invocations, ~100 builds per month.
  Way more than personal + a few friends need. Hitting a cap **locks the feature for the month
  rather than billing you** — no surprise charges.
- **Supabase Free:** a project **pauses after ~7 days of no activity** — just open the app to
  wake it (first request may be slow). Storage/egress are tiny for Drift's data. If friends come
  to rely on it, Supabase **Pro (~$25/mo)** removes pausing and adds backups (optional, later).
- The Wikipedia/Art-Institute calls run server-side in Vercel functions (same as locally), so
  images and cards work with no extra config.

## Troubleshooting & rollback

- **You only ever see the sign-in gate / data looks empty after signing in:** the two
  `NEXT_PUBLIC_SUPABASE_*` vars are probably missing or unset for **Production** — set them and
  **redeploy** (they're baked in at build time).
- **"Cloud sync isn't set up" message / no gate on the live site:** same cause — env vars not
  present at build. Redeploy after adding them.
- **Sign-in does nothing / auth errors:** check the Supabase **Site URL / Redirect URLs**
  (Step 4) match the Vercel domain.
- **Rollback:** Vercel keeps every deployment. Deployments → pick a previous green one → **⋯ →
  Promote to Production** (or **Instant Rollback**).
- **A bad build:** run `npm run build` locally first — it's the same type-check gate Vercel uses.

## Updating the site later

Every `git push` to the default branch triggers an automatic Vercel deploy. Pull requests get
their own preview URL. That's it.
