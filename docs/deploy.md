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
| `WIKI_USER_AGENT` | `Drift/1.0 (https://www.usedrift.org; you@email)` | **required for multi-user** — a compliant UA (resolvable URL + contact email) gets ~200 req/min per IP from Wikimedia vs ~10/min unidentified. All users share one egress IP, so keep this real. See `docs/beta-readiness.md` Q3. |
| `ARTIC_USER_AGENT` | `Drift/1.0 (https://www.usedrift.org; you@email)` | recommended (Art Institute etiquette) |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **server-only, NO `NEXT_PUBLIC_` prefix.** So "Delete my account" fully removes the auth user, and the welcome email can stamp its once-only flag. Used by `/api/account/delete` + `/api/email/welcome`; never inlined into the browser build. |
| `RESEND_API_KEY` | `re_…` | **server-only.** Lets the app send the welcome (after verifying) + goodbye (after deleting) emails via the Resend API. Unset ⇒ those two emails are skipped, nothing else breaks. |
| `EMAIL_FROM` | `Drift <noreply@usedrift.org>` | From address for the app-sent emails. Defaults to this if unset. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.usedrift.org` | Canonical origin for links + the logo image inside emails. |

> ⚠️ **`SUPABASE_SECRET_KEY` is server-only — add it WITHOUT a `NEXT_PUBLIC_` prefix.**
> It bypasses Row-Level Security, so it must never be inlined into the browser build. It's
> read only by the server route `/api/account/delete` (to fully remove the auth user on
> account deletion) and by the local `npm run verify:*` scripts. If you skip it, account
> deletion degrades gracefully (it clears the device but can't remove the auth login).
> **Do NOT add `SUPABASE_URL` / `SUPABASE_EMAIL` / `SUPABASE_PASSWORD` to Vercel** — those
> are only for the local verify scripts.

The two `NEXT_PUBLIC_*` values are inlined at build time, so if you add them after the first
deploy, **redeploy** (Deployments → ⋯ → Redeploy) for them to take effect.

## Step 4 — Point Supabase at the Vercel URL

After the first deploy you'll have a URL like `https://drift-xxxx.vercel.app` (use the short,
stable production alias). In the Supabase dashboard → **Authentication → URL Configuration**:

1. Set **Site URL** to your Vercel production URL (exactly one, no wildcards).
2. **Redirect URLs** — click **Add URL** (wildcards allowed) and add:
   `http://localhost:3000/**`, `https://drift-xxxx.vercel.app/**`, and
   `https://*-<your-vercel-scope>.vercel.app/**` (preview deploys). These cover OAuth returns,
   email-confirmation links, and the password-reset page (`/account/reset`).
3. **Authentication → Providers → Email → turn "Confirm email" ON.** New sign-ups must then verify
   their address before signing in (your own existing account is already confirmed). The app shows
   a "check your email" step after sign-up automatically.
4. **Custom SMTP (required before others sign up).** The built-in sender only does ~2 emails/hour
   and only to your own team address, so confirmation / reset emails won't reach real users without
   it. Auth → **Emails → SMTP Settings**: create a free **Resend** account (or SendGrid/SES),
   verify a sending domain, then paste the SMTP host/port/user/password + a From address. (For your
   *own* testing the built-in sender is fine.)
5. **Branded email templates.** Auth → **Emails → Templates**: for **Confirm signup** and **Reset
   password**, set the Subject and paste the HTML from `supabase/email-templates/` (see the README
   there for the exact subjects). These match Drift's look and the welcome/goodbye emails. Make sure
   the **Site URL** above is your real origin (`https://www.usedrift.org`) so the confirm/reset links
   point at the live app.
6. **Google sign-in (optional).** Auth → Providers → **Google** → enable. In **Google Cloud
   Console** create an **OAuth Client ID (Web)** whose *Authorized redirect URI* is the **Callback
   URL** shown in that Google panel (`https://<ref>.supabase.co/auth/v1/callback`); paste the
   **Client ID + Secret** back into Supabase. Then set **`NEXT_PUBLIC_OAUTH_PROVIDERS=google`** in
   Vercel (and `.env` locally) and **redeploy** — the "Continue with Google" button only appears for
   providers in that list. (Apple: same shape but needs a paid Apple Developer account + a Services
   ID/key; add `apple` to the list once it's configured.)

## Step 5 — Deploy & smoke-test

1. **Deploy** (Vercel → Deployments → Redeploy, or it auto-deploys on push).
2. Open the `*.vercel.app` URL in a desktop browser → you should see the **sign-in gate**.
3. **Create your account** → with "Confirm email" ON you'll see a "check your email" step; click the
   link in the email, then sign in. (Or **Continue with Google** if you enabled it.) You should land
   in Drift. Pick a seed, pull a thread, **End & view trail → Save**. Reload → the trail persists.
4. Try **Forgot your password?** → the reset link lands on `/account/reset` to set a new one; and
   **Change password** on `/account` while signed in.
5. Optional: set a **handle** on `/account` if you want to use Friends/Inbox.
6. **Account deletion** (needs `SUPABASE_SECRET_KEY` in Vercel, server-only): create a **throwaway**
   account, save a trail, then `/account` → **Delete account** → type `delete` → **Delete forever**.
   It should sign you out and land on the landing page; confirm in Supabase → Auth that the user is
   gone. Without the secret key it degrades to a device-only wipe (a message says so).

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
