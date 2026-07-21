# CLAUDE.md — Drift

Guidance for Claude Code (and every future session) working in this repository. Read this
first, every session. The full product spec lives in `drift-spec.md`; the living
implementation plan and progress tracker lives in `plan.md`.

---

## 1. What we're building

**Drift** is a local, single-user web app for "healthy scrolling" — an antidote to
doomscroll slot machines like TikTok/Instagram. It's a feed of full-screen Wikipedia
"knowledge cards" where **the user is the algorithm**: every card exposes visible
"threads" (related directions) you can pull to steer your own rabbit hole. Sessions have
a beginning (a topic seed), a middle (the trail), and an end (a shareable **trail map** of
where your curiosity wandered).

This is a **hobby project for personal use** — no accounts, no database, no deployment, no
social features. It runs locally with `npm run dev` at `localhost:3000` and persists
everything in the browser via IndexedDB.

## 2. The anti-slot-machine principles (hard product constraints, not nice-to-haves)

These are *why the app exists*. Never violate them, even when a change would be easier
without them:

1. **Transparency over opacity** — the user always sees *why* the next card appeared (the
   thread they chose, or "drift" if random). No hidden ranking.
2. **Agency over autoplay** — nothing advances automatically. No autoplay, no infinite
   preloading that teases "just one more." Prefetch **at most 1 card ahead**.
3. **Sessions have shape** — beginning (seed) → middle (trail) → end (trail map). The
   reward (the trail map) is placed at the *exit*, not the next swipe.
4. **Gentle awareness, not guilt** — a quiet "N stops" counter; after ~25 cards a soft,
   dismissible nudge. No red badges, no streaks, no notification patterns.
5. **Content is vetted, AI only reshapes** — all content originates from Wikipedia/
   Wikimedia. AI may summarize, label, and curate; it must **never invent facts**.

## 3. Tech stack

- **Next.js (App Router) + React + TypeScript** — one project. API routes act as a thin
  server-side proxy to external services (Wikipedia and the local Ollama server).
- **Tailwind CSS** (v4) for styling, **`motion`** (`motion/react`, framer-motion's successor)
  for card transitions / swipe gestures. Built on **Next.js 16** — see the Phase 1 build
  notes in `plan.md` for its breaking-change gotchas.
- **Persistence: IndexedDB via `localforage`** (key-value: `trails`, `settings`,
  `seen-pages`, `ai-cache`, `sessions`). Local-first: IndexedDB is always the source of truth
  for a session. **Phase 9 adds an OPTIONAL Supabase cloud backend** that syncs a signed-in
  user's stores across devices (Postgres + Auth + RLS); the app stays fully usable
  signed-out/local, and everything still flows through the `src/lib/storage.ts` seam. See
  `docs/backend.md`.
- **Trail map: hand-built SVG in React** (no d3 for v1 — trails are near-linear chains).
- **Trail export: SVG → PNG client-side** (`html-to-image`).
- **AI layer (optional): local Ollama** at `http://localhost:11434`, behind feature flags,
  always with graceful fallback.

## 4. Critical technical facts (learned the hard way — do not relearn)

- ⚠️ **The Wikimedia REST `/page/related/{title}` endpoint is DEAD (returns 403).** The
  spec calls it "the heart of the app," but it has been disabled for external use. **Use
  the MediaWiki Action API `morelike:` generator instead:**
  ```
  GET https://en.wikipedia.org/w/api.php?action=query&generator=search
      &gsrsearch=morelike:{TITLE}&gsrnamespace=0&gsrlimit=20
      &prop=pageimages|description|extracts&exintro=1&explaintext=1&exsentences=2
      &piprop=thumbnail&pithumbsize=400&format=json&formatversion=2
  ```
  This returns ~20 related pages **with** thumbnail, description, and extract in a **single**
  call — strictly better than the old two-step related+summary flow.
- ✅ `GET /api/rest_v1/page/summary/{title}` and `GET /api/rest_v1/page/random/summary`
  work. Random returns a **303 redirect** to a summary — follow the redirect.
- **Always proxy external calls through Next.js API routes** (`/api/wiki/*`, `/api/threads`),
  never call Wikipedia/Ollama directly from the browser. Reasons: (a) browsers cannot set
  the `Api-User-Agent`/`User-Agent` header Wikimedia etiquette requires; (b) it centralizes
  junk-filtering and the dead-endpoint workaround; (c) it keeps all AI logic server-side and
  dodges `localhost:11434` CORS.
- **Set a descriptive `Api-User-Agent` header** on every Wikimedia request (e.g.
  `Drift/0.1 (local hobby project; contact: <email>)`).
- **Ollama is installed and running locally** with the needed models: `qwen2.5:14b`
  (LLM default), `gemma3:27b` (optional quality mode), `nomic-embed-text` (768-dim
  embeddings). Chat: `POST /api/chat` with `format:"json"` + `keep_alive:"30m"`.
  Embeddings: `POST /api/embed` → `{ embeddings: [[...768]] }`.
- **The AI layer must never break the app.** Ollama unreachable / timeout (>6s) / malformed
  JSON → silently fall back to embedding-only diversity, then to the plain heuristic. The
  app must work fully with Ollama off.
- **Supabase (Phase 9) is the SANCTIONED exception to "proxy everything."** The "never call
  external services directly from the browser" rule exists for Wikipedia/Ollama (the
  `Api-User-Agent` header + junk-filtering + CORS). Supabase is the opposite case: it's
  *designed* for direct browser access secured by the **publishable key + Row-Level Security**
  (`user_id = auth.uid()`) — that IS its security model. So Drift calls Supabase directly from
  the browser. The **`sb_secret_*` key is server-only** (used by `scripts/verify-supabase.mjs`
  and by the one server route `/api/account/delete`, which needs it to fully remove the auth user
  on account deletion — it verifies the caller's own JWT first, so a user can only delete
  themselves); **never give it a `NEXT_PUBLIC_` prefix.** Like Ollama, the backend **must degrade gracefully**:
  unconfigured/unreachable ⇒ `getSupabase()` returns null / errors are caught ⇒ the app runs
  fully local and the core loop never breaks. Env: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Migrations live in
  `supabase/migrations/` (pasted into Studio); `npm run verify:supabase` checks the backend.
- **The contact form (Phase 22) has the same optional-dependency contract.** `/contact` is
  public (allowlisted in `AuthGate`) so someone who cannot sign in can still reach you. It sends
  two emails via Resend: a receipt to the sender, and a notification to `CONTACT_INBOX`
  (default `noreply@usedrift.org`) whose **`reply_to` is the sender**, so replying from the
  forwarded copy answers them. Anti-spam is layered: honeypot + fill-time + per-IP throttle need
  no config; **Cloudflare Turnstile** is optional but **fail-closed once both keys are set**
  (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + server-only `TURNSTILE_SECRET_KEY`). A bot-trapped
  submission gets the SAME success response a human does, so a script learns nothing.

- **Phase 10 social tables** (`profiles`, `friend_requests`, `shares`) are **live-fetched** via
  `src/lib/social/*` (NOT local-first synced), same graceful-degradation contract. Friendship is
  mutual (request→accept); discovery is **handle-only**; **sending a share is enforced
  friends-only in the DB** via the `are_friends()` function in the `shares` insert RLS policy —
  never rely on the UI alone for that. `npm run verify:social` checks it. See `docs/backend.md`.

## 5. Content filtering rules (apply to every fetched page)

Skip: pages with no extract; disambiguation pages (`type: "disambiguation"`); titles
starting with `"List of"` (unless the user explicitly threads into one). Imageless pages
are allowed up to ~20% so text-only gems survive. Maintain a session `seenPages` set to
avoid repeats, plus a persistent seen list with FIFO decay (cap ~500 titles) so revisits
eventually become possible.

## 6. Look & feel

A **"quiet reading room."** Warm off-white paper tone (soft cream, not stark white),
ink-dark text, one muted accent (sage green or dusty blue) used sparingly for thread chips
and links. Generous whitespace, soft rounded corners, gentle shadows. Warm serif display
font for card titles (Fraunces / Newsreader) + clean sans for body (Inter), generous
line-height. A **"night library" dark mode** (deep warm gray, not pure black). Motion:
smooth framer-motion springs; thread-follow feels like being *pulled* sideways/diagonally,
distinct from the neutral vertical drift swipe. Visual language = the opposite of a casino.

## 7. Commands

```bash
npm run dev             # start dev server → http://localhost:3000
npm run build           # production build — also the primary type-check gate
npm run lint            # eslint / next lint
npm run test            # vitest (unit tests for pure lib logic)
npm run test:watch      # vitest in watch mode
npm run verify:supabase # Phase 9: check the cloud backend (tables + RLS + upserts)
npm run verify:social   # Phase 10: check the friends/sharing tables + RLS
```

(Keep this section accurate as scripts are added.)

**Testing the app in a browser while another dev server is running.** The hosted app is
login-gated whenever Supabase env is present. To exercise the feed without signing in,
launch an isolated instance with the cloud vars blanked (shell env wins over `.env`):

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev
```

Next 16 allows only one `next dev` per directory. If one is already running, copy the repo
to a scratch dir (hard-linking `node_modules`, since Turbopack rejects a symlinked one that
points outside the project root) and run `npx next dev -p <other-port>` there.

## 8. Working agreement — how Claude must behave here

**This is the most important section. Follow it in every session.**

1. **A task is not "done" until it is tested and the tests pass — with success, verified,
   not assumed.** "It should work" is not done. Before claiming any task/step complete you
   must, as applicable:
   - `npm run build` passes (no type errors) **and** `npm run lint` is clean;
   - unit tests for any pure logic you added/changed pass (`npm run test`);
   - the dev server boots and the relevant screen/route actually works — verify with a real
     check (hit the route, exercise the flow, confirm no runtime/console errors), not a guess;
   - the anti-slot-machine principles (§2) still hold and no out-of-scope feature crept in.
   If you could not verify something, **say so explicitly** and mark it unverified — never
   report a failing or untested step as done. If tests fail, show the output and fix them
   before moving on.
2. **Follow the phased plan in `plan.md`.** Work in the current phase's order. As you
   complete each checklist item, **tick its box in `plan.md`** (`- [ ]` → `- [x]`) and keep
   the "Current status" line at the top of `plan.md` up to date. This file is how future
   sessions know where we are — treat it as the source of truth for progress.
3. **Each milestone is independently testable — stop and let the user play after each.**
   Don't silently barrel through multiple milestones; deliver working, tested increments.
4. **Graceful degradation is mandatory** — anything touching Ollama must fall back cleanly
   (see §4). Never let an optional dependency being down break the core loop.
5. **Match the existing code style and structure.** Read neighboring files before adding
   new ones. Keep pure logic (filtering, diversity selection, drift weighting, naming) in
   `src/lib/*` as small, unit-testable functions — that's where bugs hide.
6. **Stay in scope.** Build v1 (spec §3). Do not add accounts, databases, non-Wikipedia
   sources, or the §12 "parking lot" ideas unless explicitly asked.
7. **Ask before destructive or irreversible actions.** Don't `git init`/commit/push unless
   the user asks. Don't delete or overwrite files you didn't create without flagging it.
8. **Prefer plan mode for non-trivial work.** For a new phase or a meaningfully complex
   step, enter plan mode and get sign-off before writing code.
9. **Keep secrets/config in `.env.local`** (git-ignored). Provide a committed
   `.env.local.example`. Feature flags: `AI_THREADS`, `AI_REWRITE`, `OLLAMA_MODEL`.

## 9. Success criteria for the experiment (the actual point)

The app exists to answer, after a week of personal use: Do I reach for Drift instead of
Instagram/YouTube? Does pulling threads feel better than being fed? Do sessions end
naturally and does the trail map feel like a reward? Did I learn things I remember two days
later? Instrument lightly (per-session stats in IndexedDB) to support this — never build
engagement-maximizing metrics.
