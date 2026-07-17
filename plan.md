# Drift — Implementation Plan & Progress Tracker

This is the **living source of truth for progress**. Every session: read this, work the
current phase in order, and tick boxes (`- [ ]` → `- [x]`) as steps are completed and
**tested with success**. Keep the "Current status" line accurate. Full product detail is in
`drift-spec.md`; working rules are in `CLAUDE.md`.

> **Current status:** ✅ **Phases 1 & 2 complete** (M1–M5). Core loop, threads, trails, the
> trail-map reward, localforage persistence, My Trails, homepage/seeds, extended read-more,
> PNG/text export, the ~25-card nudge, dark mode, and the personal-stats view are all in.
> This session confirmed **76 unit tests green** and every M5 deliverable present (M5 was
> implemented by the prior session; its full manual E2E is per that handoff, not re-run here).
>
> ✅ **Phase 4 — Deeper Reading & a Gentle, Transparent Algorithm — COMPLETE & verified** (M7 + M8 + M9;
> **100 unit tests green**, build + lint clean, all three real-browser verified). Read-more now reveals
> the first ~6–8 body paragraphs with a soft fade (M7); random drift is popular-but-varied via
> `articletopic:` + incoming-links + random-offset (M8); and explicit ♥/✕ feed a transparent, editable
> `/interests` profile that gently biases drift (~70/30, no topic ever excluded, always shows "Because you
> like X") — threads untouched (M9). **Phase 3 (AI/Ollama) remains intentionally DEFERRED to the future.**
> _Play it: `npm run dev` → `localhost:3000`._
>
> ✅ **Phase 5 — Realms: Beyond Wikipedia — COMPLETE & verified (2026-07-14).** M10 (source/realm
> abstraction) + M11 (Gallery realm + segmented homepage tabs) + M13 (multi-realm polish) all done; **M12
> (Library + Today) deferred by user choice** — shipping two focused realms for now. Drift has tabs:
> **Encyclopedia** (all of Wikipedia, sage, topic-personalized drift) + **Gallery** (public-domain art from
> the Art Institute of Chicago, terracotta, facet threads "More by {artist}"). **115 tests green**, build+lint
> clean, real-browser + light/dark verified (details in Phase 5 below). Plan file:
> `~/.claude/plans/purring-skipping-breeze.md`.
>
> ✅ **Phase 6 — Threads With Intention — COMPLETE & verified (2026-07-14).** Encyclopedia threads are now
> *directions* — **Go deeper / Zoom out / Tangent / Nearby** (honest "always-3" fallback) — via a pure
> classifier (`src/lib/threads.ts`), with direction glyphs on the chips, the mode chip, and the trail-map
> edges. **127 tests green**, build+lint clean, real-browser verified (Gallery unregressed, zero errors).
>
> ✅ **Phase 8 — The Atlas (M19) — COMPLETE & verified (2026-07-14).** A `/atlas` page draws every saved
> trail as one "clustered galaxies" constellation — cards as dot-nodes (sized by visits), threads as edges,
> grouped into realm-tinted topic islands; drag-pan, zoom, click-to-trail, PNG export. **135 tests green**,
> build+lint clean, real-browser verified. (M20–M22 parked.) **Phase 7 (Cross-Realm) DEFERRED** with Phase 3
> (holding off on AI/Ollama for cost/capacity). Also fixed: a browser-extension hydration warning (`<body>`).
>
> 🚧 **Phase 9 — Accounts & Cloud Sync — IN PROGRESS (started 2026-07-14).** The **v3+ social-platform**
> arc begins: Phase 9 (accounts & cloud sync) → 10 (sharing) → 11 (calm feed) → 12 (mobile app), reopening
> the spec's "no accounts/social/app" line while keeping §2 intact. Backend = **Supabase** (user-provisioned
> cloud project), auth = **email+password**, sync = **lean custom local-first** over the `storage.ts` seam.
> Broken into **M23 (foundation+auth) → M24 (sync engine on trails) → M25 (sync the rest) → M26 (hardening+docs)**.
> **✅ PHASE 9 COMPLETE & verified (M23–M26, 2026-07-14).** Optional Supabase accounts + local-first cloud
> sync of every store, adoption, soft-delete, offline→online, two-device cross-sync; docs + scaling guide.
>
> ✅ **PHASE 10 — Social graph & sharing — COMPLETE & verified (M27–M29, 2026-07-16).** Mutual friends
> (request→accept), handle-only discovery, friend-inbox sharing of trails + cards, and **"continue theirs"**
> (a received trail becomes your own synced copy). Friends-only sending enforced in the DB (RLS + `are_friends`).
> **166 tests, build+lint clean;** two-account browser E2E green (friends 11/11, sharing 10/10) + blank-env
> degradation 8/8; signed-out/local + Phase 9 sync unaffected. Docs in `docs/backend.md` (+ social scaling).
> 🚀 **Phase 13 — Go Live — CODE/DOCS COMPLETE & verified (M30–M32, 2026-07-16); one user step remains
> (the actual Vercel deploy).** Phases **11 (calm feed) & 12 (native app) are DEFERRED** by user decision:
> polish + ship the core product first. Done this phase: **M30** — a required-account gate when the cloud is
> configured (logged-out ⇒ a calm sign-in screen, not anonymous drifting) + true per-account isolation
> (sign-out / account-switch wipes local data; best-effort flush first). **M31** — installable **PWA**
> (`manifest.ts`, standalone, generated sage/cream icons, iOS meta, safe-area insets; mobile audit clean).
> **M32** — `docs/deploy.md` go-live checklist + README / `.env.local.example` updates. **166 tests, build +
> lint clean;** real-browser: gate/isolation **11/11**, blank-env degradation **6/6** (§4 intact), mobile
> audit **11/11**, zero console errors. **Graceful degradation preserved** (no Supabase env ⇒ the old
> fully-local app, no gate). **▶ NEXT: the user runs `docs/deploy.md`** (push → Vercel import → env vars →
> Supabase Site URL → deploy → add-to-home-screen), then the M32 post-deploy check. Plan file:
> `~/.claude/plans/rustling-squishing-widget.md`.
> ✅ **Mobile reading-scroll fix (2026-07-17).** Resolved the read-vs-drift gesture conflict: the feed's
> advance gesture is now scroll-aware — **scroll to read, overscroll past the end to advance** (back =
> overscroll past the top); on phones the **whole card scrolls** (image scrolls away) with threads pinned
> as a bottom bar. Pure logic in `src/lib/gesture.ts` (+17 tests → **183**); handlers in `drift/page.tsx`;
> layout in `CardView.tsx`. Build+lint clean; ad-hoc mobile+desktop Playwright E2E **16/16** (light+dark).
> A **news/"happy news" realm was researched and parked** (no openly-licensed positive-news source exists;
> the only publish-safe realms are Encyclopedia = CC BY-SA and Gallery = CC0). See grab-bag note below.
>
> ✅ **Auth overhaul (2026-07-17).** Google/Apple OAuth buttons (env-gated via `NEXT_PUBLIC_OAUTH_PROVIDERS`,
> Apple built but not enabled), email verification UX ("check your email" + resend), password **reset**
> (`/account/reset`) and **change password** (`/account`); client set to PKCE. All graceful (unconfigured ⇒
> no gate/OAuth). Committed (`2a17486`). **Email is the open thread:** the built-in Supabase sender is
> ~2/hr + can't edit templates on new free-tier projects, so the user turned **Confirm-email OFF** for now
> and plans to get a **domain + Resend (custom SMTP)** in the background. Once SMTP is live: turn Confirm-email
> back on, and hand over branded HTML email templates (Confirm signup + Reset password). See grab-bag + the
> auth plan file `~/.claude/plans/zippy-pondering-cook.md`.
>
> ✅ **Logged-out landing page (2026-07-17).** Replaced the bare sign-in gate with a calm, concept-first
> landing page (`src/components/landing/*`), rendered from `AuthGate`'s configured-but-signed-out branch —
> so the app stays fully login-gated and a backend-less clone is unchanged (git diff: only the signed-out
> branch changed). Sections: sticky bar → hero (Monet) → an **interactive "pull a thread" demo** (tap a
> real thread chip → the card slides in diagonally, mirroring `/drift` `cardVariants`+spring, with a growing
> trail breadcrumb; reduced-motion aware) → "every session has a shape" → the reused `<TrailMap/>` reward →
> the four §2 anti-slot-machine principles → the two realms → an inline "Ready to wander?" join section with
> the existing `AuthForm` (new optional `initialMode="signup"`). All imagery is **CC0 art from the AIC** in
> `public/landing/` (no runtime fetch; footer credits). **Verified:** build+lint clean, **195 tests** (+7),
> real-browser signed-out 26/26 (demo interactive, CTAs→form, light+dark, mobile no-overflow, reduced-motion,
> zero console errors) + blank-env degradation 6/6. _(Live sign-in not exercised — the `.env` test creds are
> stale: Supabase returns "Invalid login credentials" for a direct API call, unrelated to this change.)_
>
> ✅ **Landing follow-up (2026-07-17).** (1) The reward section now rotates a **random example trail per
> visit** from `EXAMPLE_TRAILS` in `landing/data.ts` (a clean, easy-to-edit array; kept **static in code**,
> not a DB table, so the landing keeps its zero-runtime-fetch design and needs no fallback/RLS). Four themed
> trails: art (AIC CC0), cosmos (NASA/Hubble PD), deep sea (Haeckel PD), ancient world (AIC CC0), with 15 new
> license-verified images in `public/landing/`. The random index is chosen in a `queueMicrotask` effect (no
> hydration mismatch; reward sits below the fold so no flash). (2) **Removed em/en dashes from all rendered
> copy** across the app (landing + `page`/`drift`/`account`/`friends`/`atlas`/`inbox`/`interests`,
> `AuthForm`/`AuthProvider`/`TrailMap`/`ThreadChips`/`FeedChrome`, `export.ts`, realm blurb, `layout`/
> `manifest` titles); rephrased with periods, colons, and commas. Compound-word hyphens kept; code comments
> left as-is (not rendered). **Verified:** build+lint clean, **197 tests**; browser: all 4 trails rotate and
> every image loads, **0 dashes** in `document.body.innerText`, demo still works, zero console errors.
>
> 🌱 **Three new directions queued (2026-07-17, from a full-app brainstorm)** — added below as **Phases 14–16**.
> The user wants to deepen what exists (not add realms or a social feed): **two great realms, product before
> social.** (1) **Phase 14 — Gallery, Deepened** (museum-label metadata, mobile-friendly art deep-zoom,
> directional art threads, richer browse): **STARTING NOW** (detailed milestone plan built in plan mode). (2)
> **Phase 15 — Cross-Realm Doorways** (a free, no-AI factual bridge between the two realms; + the user's two
> asks: horizontal swipe between realms with trails that span both, and a living, sendable Atlas). (3)
> **Phase 16 — Memory & Reflection** (keep-a-fact shelf, "remember this?" openers, an honest "shape of your
> week" — the thing a feed can't do; §9 #4). All three bind §2. Cross-realm is verified feasible without the
> Ollama layer (AIC artist/style/place strings resolve cleanly onto Wikipedia; see Phase 15).
>
> 🎨 **Phase 14 (Gallery, Deepened) — ✅ COMPLETE & verified (2026-07-17).** M-G1 museum label + M-G2 deep-zoom
> lightbox + M-G3 directional art threads + M-G4 richer discovery all shipped (M-G5 personalization optionally
> deferred). **203 unit tests, build+lint clean**; per-milestone + an integrated 390px browser pass, zero
> console errors; Encyclopedia unregressed. New dep `react-zoom-pan-pinch`. Plan file:
> `~/.claude/plans/lexical-beaming-clarke.md`. **▶ NEXT (when the user is ready): Phase 15 (Cross-Realm
> Doorways) or Phase 16 (Memory & Reflection).**
>
> _(Update this line whenever progress changes.)_

---

## Research findings baked into this plan (already verified)

- ❌ **`/page/related/{title}` (REST) is dead (403)** — the spec's "heart of the app."
  ✅ **Replacement: Action API `morelike:` generator** returns ~20 related pages with
  thumbnail + description + extract in one call. See `CLAUDE.md §4`.
- ✅ `/page/summary/{title}` and `/page/random/summary` (303 redirect) work.
- ✅ Ollama running locally with `qwen2.5:14b`, `gemma3:27b`, `nomic-embed-text` (768-dim).
- ✅ Node 25 / npm 11. All external calls will be proxied through Next.js API routes.

## Testing gate (applies to every phase — see `CLAUDE.md §8`)

A phase/milestone is "done" only when: `npm run build` passes, `npm run lint` is clean,
`npm run test` (unit tests for pure lib logic) passes, and the running app has been
**manually verified** to do the thing (route loads, flow works, no console/runtime errors).
Unverified work must be flagged as such — never reported as done.

---

## Phase 1 — The Core Drift Loop  *(spec milestones M1 + M2)*

**Goal:** a playable core loop — random/seed card → full-screen card → pull a thread or
drift → next card. No trails, no persistence, no AI yet. This proves the central idea feels
good. Heuristic thread selection only.

### M1 — Walking skeleton
- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind + ESLint via `create-next-app`.
- [x] Add deps: `motion` (framer-motion's successor), `localforage`, `html-to-image`; dev: `vitest`.
- [x] Establish structure: `src/app`, `src/components`, `src/lib`; `.env.local.example`. (`src/data` lands in M5.)
- [x] Define shared types (`src/lib/types.ts`): `Card`, `RelatedCandidate`, `Thread`, `TrailStep`, `Trail`, `SessionStats`.
- [x] Wikipedia proxy API routes with `Api-User-Agent`: `/api/wiki/random`, `/api/wiki/summary`.
- [x] `src/lib/wiki.ts`: normalize summary → `Card`; junk filter (no extract,
      disambiguation, "List of"); thumbnail upscaling; session seen-set (in feed).
- [x] Unit tests for junk filtering + Card normalization.
- [x] Drift feed route `/drift`: split-panel full-screen card, image + title + extract.
- [x] Wheel/scroll/arrow-key/touch/button navigation to a new random card; back revisits (read-only).
- [x] **Test M1:** build + lint + 33 tests pass; `/drift` loads real cards (E2E), navigation works,
      junk filtered, no console errors.

### M2 — Threads
- [x] `/api/wiki/related` route → Action API `morelike:` generator (thumb+desc+extract).
- [x] `src/lib/diversity.ts`: heuristic diverse-3 selection (description-class dissimilarity),
      seen/junk filtering; chip label = short description (<40 chars) else title. Unit-tested.
- [x] Thread chips row on the card (2–3 chips, sage styling + thread icon).
- [x] Thread-tap navigation with a distinct "pulled sideways" transition + "Following: …".
- [x] Drift weighting on plain advance (~50% toward an untapped thread, ~50% fully random).
      Unit-tested weighting helper.
- [x] Prefetch **exactly 1 card ahead** in the background (respect principle #2).
- [x] Quiet UI chrome: back-to-home, "N stops" counter + breadcrumb dots, "End & view trail" (stub overlay).
- [x] **Test M2:** build + lint + tests pass; threads appear, tapping follows the
      thread (E2E), drifting works, only 1-ahead prefetch, no console errors.

**Phase 1 exit:** ✅ the core loop works end-to-end. Run `npm run dev` → open `/drift`.

**Phase 1 build notes (for future sessions):**
- Scaffolded on **Next.js 16** (not 15) — key differences already handled: Turbopack is
  default, `next lint` is gone (script is `eslint`), route handlers use query params (we
  dodge the async-`params` breaking change), and React 19's `react-hooks/set-state-in-effect`
  rule forbids synchronous `setState` in an effect body (we derive thread-loading instead).
  The bundled docs at `node_modules/next/dist/docs/` are the source of truth — read them.
- Used the **`motion`** package (`motion/react`), the current name for framer-motion.
- Added **`playwright`** as a dev dep for real-browser E2E verification; the smoke test is
  run ad-hoc against `npm run dev` (not wired into `npm test`, which stays pure-logic/vitest).
- `morelike` sometimes returns very homogeneous threads for narrow topics (e.g. "Nth
  Delaware General Assembly"). Mechanic is correct; Phase 3 embeddings will improve variety.
- Images use plain `<img>`, so the `@next/next/no-img-element` lint rule is disabled in
  `eslint.config.mjs`.

**Phase 1 v2 — feedback fixes (all verified by a 17/17 real-browser simulation):**
- **Images fixed.** The old code rewrote REST thumbnail URLs to a bigger width, which
  Wikimedia rejects with **HTTP 400** — so most images broke. Now **all three routes use the
  Action API** (`prop=extracts|pageimages|description|info|pageprops`, `pithumbsize=800`),
  which returns valid, correctly-capped thumbnail URLs plus reliable disambiguation detection
  (`pageprops.disambiguation`). Random is biased toward pages that have an image.
- **Threads persist on back-nav.** Threads are cached per card (`threadCache` keyed by title)
  and shown for whichever card is displayed — going back no longer drops them.
- **Branching.** Pulling a thread from a revisited (past) card truncates forward history and
  starts a new direction.
- **Reliable navigation.** Buttons/keys advance immediately (guarded only while a fetch is in
  flight); the wheel uses delta accumulation; the random fallback retries + skips seen pages.
- **"Where am I" clarity.** A mode chip on each card ("Starting point" / "Drifting" /
  "On a thread — {label}") + a top-bar **trail rail** (drift = dashed/grey dot, thread =
  solid/sage knot, current highlighted, click to jump).
- Drift is now biased ~70% toward a related thread (`DRIFT_THREAD_BIAS`), so scrolling wanders
  through nearby territory (instant, on-theme) instead of jarring fully-random jumps.
- **Note for next session:** Next 16 locks to one `next dev` instance; if a stale server holds
  `:3000`, HMR silently serves old code. Kill all `next` processes + `rm -rf .next` before a
  fresh `npm run dev` when testing changes.

**Phase 1 v3 — Wikimedia 429 / "dead button" fix (verified 8/8 "button always responds"):**
- Wikimedia returns **429 (rate limit)** for bursty callers; the route surfaced it as 502 → the
  client got nothing → dead button. Fixes: **removed the extra random-prefetch** (halved request
  volume), **AbortController** on threads fetches (cancels superseded + StrictMode-dup dev
  fetches), a **global 300 ms request-spacing gate** (`wiki-server.ts`), and **bounded retry**
  (server 2 + client 2, ≤~4 s, honors `Retry-After`) so the button never freezes. Retry logic is
  unit-tested in `wiki-server.test.ts`.
- **`generator=random` is the first route Wikimedia throttles; `morelike` (threads) stays
  healthy.** So drift is now **85 % thread-biased** (`DRIFT_THREAD_BIAS`) and, if a random drift
  fails, it **falls back to the top thread**. If truly nothing is available, a gentle **hint**
  ("Wikipedia's catching its breath…") shows — the button ALWAYS gives a visible response.
- **Testing caveat:** extensive local load-testing rate-limited our own IP for a sustained window,
  so live end-to-end reliability numbers were depressed in-session. A real single user at human
  pace won't hit this; the graceful-degradation path (hint + retry, no crash/freeze) was verified
  even while throttled.

---

## Phase 2 — Sessions With Shape  *(spec milestones M3 + M4 + M5)*

**Goal:** turn the loop into a complete, persistent, polished product — trails, the trail
map reward, local persistence, My Trails, homepage, and full look-&-feel. This is the whole
app minus the AI layer. (Largest phase — sequence strictly M2.5 → M3 → M4 → M5, test-gate each.)

### M2.5 — Drift variety & rate-limit reality check  *(feedback fix, pre-M3)*
User feedback: fast-scrolling (drifting, not on a thread) kept landing on the **same subject**
("everything was Alaska") instead of feeling random. Root cause investigated & confirmed this
session: it is **not** the rate limiter — it's the previous session's two workarounds for it.

**Rate-limit reality (measured live this session):** Wikimedia's `generator=random` is a *burst*
limiter — a rapid burst of ~8 requests trips a multi-second cooldown where even spaced requests
429. At genuine human drift pace it's a non-issue (steady 200s). So the burst protection stays;
the anti-variety overcorrection goes.

- [x] `src/lib/drift.ts`: restored `DRIFT_THREAD_BIAS` to the spec's **0.5** (was 0.85); added a
      hard **`MAX_THEME_RUN = 3`** cap so no more than 3 drifts in a row follow a related thread
      before a fully-random jump is forced (kills long same-subject runs even on unlucky rolls).
- [x] `src/app/drift/page.tsx`: tracks consecutive on-theme drifts via `themeRunRef` (reset on
      thread-pull / back / jump / random jump); random-fail fallback changed from `threads[0]`
      (most-related) to a **random untapped thread** (`pickRandomThread`, kept pure in `drift.ts`
      to satisfy React's render-purity lint rule).
- [x] **Kept** the useful bits (300 ms spacing gate + bounded retry + graceful hint); did **not**
      re-add speculative random-prefetch.
- [x] Updated `drift.test.ts` for the new options signature + cases (bias split, run-cap forces
      random, no-threads, `pickRandomThread` selection/clamp). 40 tests pass.
- [x] **Test M2.5:** build + lint + 40 tests pass; in-browser (seeded from *Alaska*), drifting
      broke out of the Alaska cluster after exactly 3 on-theme stops → beetles → naval treaties
      (10/11 distinct in a clean run), zero JS runtime errors, button always responded.
      **Reality check:** Wikimedia's random endpoint is a *burst* limiter — fine at human pace,
      trips a short cooldown only under rapid bursts (which we self-inflicted while testing). The
      "everything is Alaska" stickiness was the 0.85 bias + `threads[0]` fallback, now fixed.
      _Nuance: under active throttling a forced-random can fail and fall back to a same-cluster
      thread, slightly lengthening a run; harmless at human pace and deliberately not "fixed" by
      hammering the throttled endpoint._

### M2.6 — Batched random buffer  *(rate-limit fix, feedback follow-up)*
User feedback: still hit "Wikipedia's catching its breath" after ~6–7 drifts at a reasonable
pace. Diagnosed: raising the random bias to 0.5 (M2.5) tripled calls to `generator=random` (the
burst-limited endpoint), and the old route **re-rolled up to 3×** hunting for an imaged page
(random Wikipedia is ~70% imageless), so one drift could cost 2–3 requests → ~6–7 drifts trips
the ~8-request burst budget. Measured live: `grnlimit=20` is allowed for anon users and returns
~8 imaged cards in ONE request.

- [x] `src/lib/wiki.ts`: `selectCardBatch(pages)` — pure, imaged-first, ≤~25% imageless (falls
      back to all-imageless if a batch has none). Unit-tested (5 cases).
- [x] `src/app/api/wiki/random/route.ts`: now returns a **batch** (`Card[]`) from a single
      `grnlimit=20` + `exlimit=max` request; removed the wasteful re-roll loop.
- [x] `src/app/drift/page.tsx`: `randomBufferRef` holds the batch; random drifts served from it
      (instant), refilled **reactively only when empty** (not a background queue — honors the
      spirit of principle #2: a jar of interchangeable random cards, not the user's chosen forward
      path, with no teasing UI). "Surprise me" seeds the buffer from its initial batch.
- [x] **Test M2.6:** build + lint + 45 tests pass. Real-browser, 20 drifts at human pace:
      **only 2 random requests** (vs ~1+/drift), 21 related calls, **21/21 distinct cards**, the
      hint appeared **0 times**, zero JS/network errors. Rate-limit "take a break" issue resolved.

### M3 — Trails ✅
- [x] Record trail steps in memory: `card`, `arrivedVia` (seed/thread/drift), `timestamp`,
      `expanded` (already there) + **`dwellMs`** now tracked (best-effort: `dwellRef` + a
      `useEffect([pos])` accrues time onto the departed step; `endSession` finalizes the last stop).
- [x] "End & view trail" → real **Trail map** screen: `src/components/TrailMap.tsx` renders the
      pure `layoutMeander` geometry (`src/lib/trailmap.ts`) — meandering vertical spine, nodes
      alternating L/R with circular thumbnail + title, **thread edges solid/sage + label pill,
      drift edges dotted/grey**, read-more glow ring (dormant until M5). Replaced the stub `EndOverlay`.
- [x] Header stats via `src/lib/stats.ts` (`computeTrailStats` + `formatDuration`) + auto-name via
      `src/lib/naming.ts` (`autoTrailName` = `first → last`). All three libs unit-tested.
- [x] **Test M3:** build + lint clean, **62 unit tests pass** (17 new: naming/stats/trailmap).
      Real-browser (seed Octopus → pull a thread → 2 drifts → back → End): map shows 4 nodes = 4
      stops, the pulled-thread edge solid + labeled while drift edges dotted, name
      "Octopus → Grimpoteuthidae", stat line "4 stops · 14 sec · 1 thread pulled", thumbnails load,
      **zero console/runtime errors**, "Keep drifting" returns to the feed. (Screenshot verified.)

### M4 — Persistence & My Trails ✅
- [x] `src/lib/storage.ts`: localforage wrapper (`trails` CRUD, `settings`, `seen`, `sessions`);
      client-only lazy instance; `persistSeen` writes serialized to avoid read-modify-write races.
- [x] Save / like / rename / delete trails — from the end screen (editable name, Save, like) and the
      trail detail page. `crypto.randomUUID()` ids; re-saving **upserts** (preserves id/name/liked/createdAt).
- [x] **My Trails** page (`/trails`): grid with `TrailSparkline` mini SVG, date, stop count, liked
      heart; All/Liked filter; delete; empty state. Detail page (`/trails/[id]`): TrailMap + continue/
      rename/like/delete (`useParams`).
- [x] "Continue this trail" → `/drift?continue=<id>` rehydrates the trail's steps at the last stop;
      further drifting + save updates the same trail.
- [x] Persistent seen-list with FIFO decay (`src/lib/seen.ts`, cap 500) — hydrated on mount, appended
      per stop. Unit-tested (5 cases).
- [x] **Test M4:** build + lint + 67 tests pass. Real-browser E2E: save a trail (editable name),
      reload → **persists**; grid/filter/delete work; detail renames + likes; **continue restores
      history at the last stop**; continue+save **upserts (stays 1 trail, stops grew)** and **liked
      survives the re-save** (fixed a clobber bug found in testing); zero console/runtime errors.

### M5 — Homepage & polish ✅
- [x] `src/data/seeds.json`: 12 curated seed collections (10–20 strong titles each).
- [x] Homepage: tagline, seed-tile grid, prominent "Surprise me", My Trails link, stat line.
- [x] "Read more" expansion: fetch full lead extract (Action API) + "Open full article ↗".
      _(N.B. this reveals only the **lead** — Phase 4 M7 extends it to body paragraphs.)_
- [x] Export trail as **PNG** (`html-to-image`) and **Copy as text** (formatted w/ links).
- [x] Session stop counter + soft dismissible ~25-card nudge ("want to see your trail?").
- [x] Keyboard shortcuts; **dark mode** ("night library") toggle; look-&-feel pass (fonts, colors, motion).
- [x] Per-session stats stored in IndexedDB + personal "this week" stats view on `/trails`.
- [x] **Test M5:** implemented by the prior session; **this session confirmed 76 unit tests
      green + all deliverable files present** (seeds, ThemeToggle in layout, export.ts/
      export-image.ts, extended read-more in CardView, nudge, `recordSession`/`listSessions`).
      Full manual E2E per that session's handoff — not re-run this session.

**Phase 2 exit:** ✅ complete, daily-usable Drift with no AI dependency. Stop and play.

---

## Phase 3 — The AI Enhancement Layer  *(spec milestone M6)*

> ⏸ **DEFERRED to the future by user decision (2026-07-14). Do Phase 4 (below) first, then
> return here.** Nothing in Phase 4 depends on this; both are independent. (Forward tie-in:
> once this lands, the local `nomic-embed-text` taste-vector could replace Phase 4 M9's ORES
> topic-labeling — noted there.)

**Goal:** optional, feature-flagged Ollama enhancement of thread selection & labels, with
mandatory silent fallback to Phase 1/2 heuristics. Never breaks the app.

- [ ] `.env.local` flags: `AI_THREADS`, `AI_REWRITE`, `OLLAMA_MODEL` (default `qwen2.5:14b`).
- [ ] `src/lib/embeddings.ts` + `/api/embed` proxy: embed the ~20 candidates
      (`nomic-embed-text`), greedy max-min cosine → diverse shortlist of ~6. Unit-test the
      cosine / max-min selection with fixed vectors.
- [ ] `/api/threads` route → Ollama `POST /api/chat` (`format:"json"`, `keep_alive:"30m"`):
      pick final 3 + 2–5 word evocative labels. Validate returned titles match candidates exactly; drop mismatches.
- [ ] Wire the feed to prefer AI threads when `AI_THREADS=true`, within the prefetch window.
- [ ] Cache AI results in IndexedDB keyed by page title + model name.
- [ ] Graceful fallback: unreachable / timeout >6s / malformed JSON → embedding-only → plain
      heuristic. Unit-test the fallback selector; **manually test with Ollama stopped**.
- [ ] Optional `AI_REWRITE=true`: rephrase extract to a punchier 2-sentence hook (off by
      default; keep "From Wikipedia →" link; rephrase only, never add facts).
- [ ] **Test Phase 3:** with Ollama on → AI threads/labels appear within prefetch window;
      with Ollama off → app works identically via heuristic; cache avoids repeat cost.

**Phase 3 exit:** full spec v1 delivered.

---

## Phase 4 — Deeper Reading & a Gentle, Transparent Algorithm  *(feedback round v4 — CURRENT PRIORITY)*

> ▶ **START HERE.** Current priority; comes **before** the deferred Phase 3 (AI/Ollama). Three
> independently-testable milestones (M7 → M8 → M9), each test-gated like every other phase. Born
> from real use: (1) read-more is too short, (2) random cards are too random/boring, (3) drifting
> should slowly learn what I like — while staying transparent (the anti-slot-machine soul, §2).

**Verified API research (empirically tested this session — copy-paste-ready):**
- **Read-more (M7):** `extracts` `exchars` is **hard-capped at ~1200 chars** (asked 4000 → got 1208)
  and `exsentences` caps at 10 — neither can exceed the lead. ✅ To get body paragraphs, fetch the
  **full plaintext** (`prop=extracts&explaintext=1&exsectionformat=raw`, **no** `exintro`) and slice.
  Section headers arrive as `\x1e{level}\x1f{Title}` control markers (strip or render them).
- **Interesting-random + topic bias — ONE mechanism (M8/M9):** CirrusSearch supports an
  **`articletopic:`** keyword backed by the **ORES article-topic model (fixed 64-topic taxonomy** —
  Culture / Geography / History&Society / STEM; e.g. `STEM.Biology`, `STEM.Mathematics`). Query:
  `generator=search&gsrsearch=articletopic:<slug>&gsrsort=incoming_links_desc&gsroffset=<rand 0–400>&gsrlimit=20`
  \+ card props → a batch of **popular, on-topic, varied** cards in ONE request (verified: offset 29
  into `space` → Astronomical unit, Nebula, Parsec, Orion Arm). `gsrsort=random` alone returns obscure
  pages (reproduces the "boring" problem); the **incoming-links floor + random offset** is the sweet
  spot. Cold-start proof: `generator=random` → Krachia / River Kensey / Vortech (dull); `articletopic:history`
  \+ offset → Michelle Obama / Postage stamp / Athena / Babylon (interesting). Slug list (verify live):
  https://wikitech.wikimedia.org/wiki/Search/articletopic
- **Labeling a page's topics (M9 interest model):** ✅ public, no-auth topic scores via **Lift Wing**
  `POST https://api.wikimedia.org/service/lw/inference/v1/models/enwiki-articletopic:predict`
  `{"lang":"en","rev_id":<revid>}` (legacy fallback: `GET https://ores.wikimedia.org/v3/scores/enwiki/{revid}/articletopic`).
  Verified: Octopus → `STEM.Biology 0.99`. Needs the page revid (`prop=revisions&rvprop=ids`). Raw page
  **categories are junk** here ("Commercial molluscs", "Extant Pennsylvanian first appearances"); Wikidata
  P31 is too granular. Treat this endpoint **like Ollama: must degrade gracefully** (timeout / down /
  malformed → don't move the model, never break the app).

### M7 — "Read more", properly ✅  *(idea 1)*
Reveal the first **~6–8 body paragraphs** inline (continuous text, soft fade + "From Wikipedia ↗"),
not just the lead. (User choice, over section-headings / whole-article-inline.)
- [x] `src/lib/extract.ts` (pure, unit-tested): `topParagraphs(raw, {maxParagraphs=8, maxChars=3500})`
      — splits on newlines, drops blank lines + `== Heading ==` markup (used `exsectionformat=wiki`, more
      robust than the `raw` control-char format which `formatversion=2` strips), returns first paragraphs +
      a `hasMore` flag. Handles stubs honestly (returns what exists, `hasMore=false`). 7 unit tests.
- [x] `/api/wiki/summary`: added `extended=1` mode → `prop=extracts&explaintext=1&exsectionformat=wiki`
      (no `exintro`/`exsentences`); slices via `topParagraphs`; returns `{ extract, hasMore }`. `full=1`
      lead mode kept for back-compat.
- [x] `CardView.tsx`: "Read more" fetches `extended=1` (lazy, once), renders paragraphs split on `\n\n`;
      soft `bg-gradient-to-t from-paper-raised` fade when `open && hasMore`; kept "Show less", the `r`
      shortcut, and "From Wikipedia ↗". On fetch failure keeps the short extract.
- [x] **Test M7:** build + lint clean, **83 unit tests pass** (7 new). Real-browser (seed *Octopus*):
      read-more grew the reading column 419 → 3688 chars = **6 flowing paragraphs**, no `==` headings, fade
      present, threads still pinned, "Show less" collapses back, "From Wikipedia ↗" → `/wiki/Octopus`,
      **zero console/runtime errors**. Endpoint contract verified across Octopus/Whale fall/Mantis shrimp.
      _(Caught + fixed in testing: route returned `{text}` but CardView read `{extract}` — now aligned.)_

### M8 — Interesting random ✅  *(idea 2 — ships standalone; no personalization yet)*
Replace boring `generator=random` drift with **popular-but-varied** pages. Cold-start picks a
**uniformly-random topic**, so this is a self-contained win even before the interest model (M9) exists.
- [x] `src/lib/topics.ts`: the topic registry — **28 browseable ORES topics** (dropped geographic
      subregions + catch-all `*`). Each: `{ id, label, keyword, oresKey }` (`keyword` = `articletopic:`
      slug, all 28 validated live; `oresKey` for M9). Helpers `topicById/byKeyword/byOresKey`.
- [x] `src/lib/discover.ts` (pure, unit-tested): `uniformTopic(rng)`, `weightedTopic(weights, rng)`
      (M9), `randomOffset(rng, max=400)`, `interleave(arrays)`. (Topic-vs-interest split cleanly:
      discover does sampling, `interest.ts` supplies weights.)
- [x] `/api/wiki/discover?topic=<slug>&offset=<n>&limit=<n>`: CirrusSearch `articletopic:<slug>` +
      `gsrsort=incoming_links_desc` + `gsroffset` + `CARD_PROPS` → `Card[]` via `selectCardBatch`.
      **Allowlists the topic** (injection guard → 400 on unknown/injection). Graceful → `[]`/200.
- [x] `drift/page.tsx`: buffer holds **topic-tagged** cards; `refillRandomBuffer` → `fetchDiscoverBatch`
      (interleaves **3 topics × 4 cards** so a session doesn't stick on one topic). "Surprise me" seeds
      from a discover batch. **Dropped the `/api/wiki/random` fallback in refill** (it's the burst-limited
      endpoint — hammering it under throttle backfired; morelike-neighbour fallback in `advance()` covers a
      dry buffer). Mode chip shows the topic. `ArrivedVia` drift extended with `topic`/`reason`.
- [x] Also strengthened the junk filter (`isJunk`): incoming-links sorting surfaced high-link **list/index/
      "…listings in…" navigation hubs** (e.g. NRHP listings); now skipped (+ "Lists of", Index/Outline/
      Glossary/Timeline). Unit-tested.
- [x] **Test M8:** build + lint clean, **92 → 100 unit tests pass**. Real-browser: "Surprise me" seeds
      from discover (interesting starting points, not stubs); drifting yields **recognizable pages**
      (Linear B, Jupiter, Women's suffrage, Nebula…) with **6 distinct topics** across a session, **0 junk
      titles** after the filter, mode chip shows the topic, injection/unknown topic → 400, **zero JS errors**.
      _Rate-limit caveat (as documented before): heavy in-session testing self-throttles our IP; at human
      pace the hint stays rare, and the graceful path (spinner → hint, never a dead button) holds under throttle._

### M9 — A gentle, transparent interest model ✅  *(idea 3)*
Explicit **♥ / ✕** on cards feed a **visible, editable** interest profile that gently biases the **drift**
topic pick (**~70% liked topics / ~30% wildcard, never fully excludes a topic**). Threads stay 100%
user-driven. Signal source: **explicit like/dislike only** (user choice). ⚠️ **Deliberate, sanctioned
exception to spec §3's "no personalization" / principle §2.1 — permitted only because it stays transparent
and user-controlled.**
- [x] `/api/wiki/topics?title=<t>`: title → revid (`prop=revisions&rvprop=ids`) → **Lift Wing
      `enwiki-articletopic`** (public, no-auth, different host from en.wikipedia so not rate-limited) →
      topics with prob > 0.5, mapped via `topicByOresKey`. Timeout 4 s; **graceful**: any failure → `{topics:[]}`.
      All 28 `oresKey`s verified to match the live model's probability keys. Cached client-side.
- [x] `src/lib/interest.ts` (pure, unit-tested): `Interest = Record<TopicId, number>`; `applyFeedback(±STEP,
      clamped [FLOOR 0.1, CEIL 5])` — floor > 0 ⇒ never excluded; `topicWeights`; `pickDriftTopic(interest,
      {serendipity 0.3})` = 30% uniform + 70% interest-weighted. **Design fix:** the "interest" reason is
      derived from the *picked topic's actual liked-status*, so "Because you like X" is never shown for a topic
      you didn't like (truthfulness, §2.1).
- [x] `storage.ts`: `interests` (weight map) + `reactions` (per-title ♥/✕) + `topicsCache` keys with chained
      writes; `settings.personalize` (default on).
- [x] `CardView.tsx`: quiet ♥ / ✕ buttons (sage/neutral, non-casino), next to the mode chip. `handleReact`
      undoes the prior reaction + applies the new one (consistent toggling/switching); optimistic + non-blocking.
- [x] **Transparency:** drift reason line reads "Because you like {topic}" (interest pick) vs "Drifting ·
      {topic}" (wander). Personalization affects drift only; threads untouched.
- [x] **Interest profile view** (`/interests`): weights as bars (sorted, liked=sage), per-topic +/− nudge,
      reset, and the `personalize` on/off toggle with a plain-language explanation. Linked from `/` and `/trails`.
- [x] **Guardrails (constants + tests):** drift-only; `SERENDIPITY 0.3`; `WEIGHT_FLOOR 0.1` (>0 ⇒ nothing
      excluded); reason always shown; profile viewable/editable; one-switch off. _Forward note:_ Phase 3
      `nomic-embed-text` could later replace ORES labeling with a local taste-vector.
- [x] **Test M9:** build + lint clean, **100 unit tests pass** (8 new). Real-browser: boosting topics on
      `/interests` sorts them to the top (sage bars) and **persists** across reload; personalize toggle
      **persists off**; with topics boosted, **8/22 drifts showed "Because you like …"** (interest→drift→
      truthful-reason pipeline) while other topics still surfaced (serendipity floor); ♥ on a card **activates,
      persists across reload, toggles off**, ✕ works; `topics(Mathematics)→["mathematics"]`; **zero JS errors**.
      Graceful-by-construction: `setReaction` runs before the topics fetch, so a like records even if Lift Wing
      returns `[]`.

**Phase 4 exit:** ✅ deeper inline reading + a feed that's interesting by default and slowly, *transparently*
shaped by what you love — without becoming the slot machine Drift exists to replace.

---

# 🌱 IDEA PHASES (proposed — v2 direction, NOT yet committed)

> These are **candidate next phases** drafted for review (2026-07-14), not signed-off work. They are
> written in the same shape as the committed phases so any one can be picked up directly: enter plan
> mode, refine, and build. **Edit / reorder / delete freely** — this is a menu, not a queue. Each is
> independently valuable and (mostly) independently buildable; dependencies are called out where they
> exist. Nothing here is started; all boxes are unticked on purpose.
>
> **These intentionally revisit two v1 "out of scope" lines** (non-Wikipedia sources; a bit more
> algorithm) — see the amended "Out of scope" note at the bottom. The anti-slot-machine principles
> (§2) still bind every one of them; where a phase gets near a line, it says how it stays on the
> right side of it.
>
> **Suggested order & why:** Phase 6 (Threads With Intention) is the cheapest, most "makes-Drift-
> more-Drift" win and touches no new APIs — a good warm-up. Phase 5 (Realms) is the biggest lever
> for "do I still reach for this in week two" and is the user's headline ask. Phase 7 (Cross-Realm
> Threads) is the magic but **depends on the embedding layer** (revive Phase 3 first, or build its
> minimal subset). Phase 8 (Reward, Deepened) directly serves success-criterion #4 ("did I remember
> it two days later") and can slot in anytime.

---

## Phase 5 — Realms: Beyond Wikipedia  *(the "different tabs / other sources" direction — headline ask)*

**Goal:** Drift stops being a Wikipedia reader and becomes a **reader of vetted human knowledge**, with
switchable **realms** (tabs): *Encyclopedia* (today's Wikipedia feed, unchanged), *Gallery* (public-domain
art from open museum collections), and room for more. Same card, same thread mechanic, same trail map —
new wells of content. This keeps the app fresh across a week+ of use (the actual experiment, §9) and is the
single biggest lever on "do I open Drift instead of Instagram."

Realms are the honest, on-ethos read of "content is vetted, AI only reshapes" (§2.5): museum open-access
collections and public-domain libraries are *curated by humans*, not scraped — arguably better-vetted than
a random Wikipedia stub.

**Why Art/museums first (fit ranking, researched 2026-07-14):**
- 🥇 **Gallery (museum open access) — best fit.** Gorgeous full-bleed public-domain images (the app is
  image-forward and wants a "quiet reading room" — an art card *is* that), rich metadata that makes
  **real threads** ("more by this artist", "other Impressionists", "other objects from Japan", "more still
  lifes"), no API key, generous terms. Two strong no-key JSON sources:
  - **Art Institute of Chicago** — `GET https://api.artic.edu/api/v1/artworks/search?q=<term>&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,medium_display,place_of_origin,classification_title,term_titles,thumbnail,image_id&limit=20`.
    Images via IIIF: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`. Docs: https://api.artic.edu/docs/ — no key, but they ask for an `AIC-User-Agent` header (same etiquette pattern we already do for Wikimedia). Cannot paginate past 10,000.
  - **The Met** — `GET https://collectionapi.metmuseum.org/public/collection/v1/search?q=<term>&hasImages=true` → object ids; `GET .../objects/{id}` → full record (`primaryImage`, `artistDisplayName`, `medium`, `culture`, `department`, `objectDate`, `tags`, `isPublicDomain`). No key. ~470k objects. (Two-hop: search→ids→per-object; heavier than AIC's one-shot search — lead with AIC.)
  - Peers with the same open-access model if we want more depth later: Cleveland Museum of Art, Rijksmuseum (key), Smithsonian (key), National Gallery of Art.
- 🥈 **Library (Project Gutenberg via Gutendex) — good, text-leaning.** `GET https://gutendex.com/books?search=<term>&languages=en` → title, authors (+ birth/death years), subjects, bookshelves, `formats` incl. a cover JPEG and a plaintext URL. No key, no documented rate limit. Threads: same author / same subject / same bookshelf / same era. Card = "a book worth knowing" + an opening passage (slice the plaintext, reuse `extract.ts`) + "Read it free ↗". Covers are plain, so lean on typography.
- 🥉 **Today (Wikimedia-native) — lowest effort, great *beginnings*.** An "On this day / featured" realm: historical events, births, the featured article + picture of the day. Threads already work (it's Wikipedia). Verify the unauthenticated path first: `api.wikimedia.org/feed/v1/...` needs a Bearer token, but the older `en.wikipedia.org/api/rest_v1/feed/onthisday/all/{mm}/{dd}` and `/feed/featured/{yyyy}/{mm}/{dd}` historically work without auth — confirm live. This is more a **new front door** than a new realm; consider folding it into Phase 8's "beginning" work instead.
- ⏸ **Science (arXiv)** — Atom XML (not JSON), 3 req/s, no key, `http://export.arxiv.org/api/query?search_query=cat:astro-ph&sortBy=submittedDate`. **Caveats:** no images (bad fit for an image-forward feed), dense abstracts, no per-paper "related" endpoint (threads would need embeddings → Phase 7), and preprints are **not peer-reviewed** — brushes §2.5's "vetted". Park unless there's appetite; if built, label cards honestly as preprints.
- ⏸ **Data (Our World in Data)** — CSV + `.metadata.json`, no key (docs.owid.io). A "chart of the day" is a *different card type* (data viz, not image+prose+threads) and doesn't thread naturally. High effort, breaks the uniform model. Park for now.

### M10 — The source abstraction ✅ *(foundational refactor — zero user-visible change; DONE 2026-07-14)*
The old `Card` was Wikipedia-shaped: `pageTitle` doubled as the unique id and keyed the seen-set, thread
cache, reactions, and buffer dedup. Now split into `Card.source` (content origin) + `cardId` (app-wide id),
with everything defaulting to Wikipedia so pre-Phase-5 data still resolves.
- [x] `Card.source?: SourceId` + `Trail.realm?: RealmId` (both default via helpers; missing ⇒
      wikipedia/encyclopedia). `RelatedCandidate` gained optional `source`/`sourceUrl`/`threadLabel`/`facet`
      for the art/book realms. `src/lib/realms/types.ts` = leaf module (`SourceId`, `RealmId`, `RealmMeta`,
      `DiscoverPick`).
- [x] `src/lib/card.ts` (pure, 7 tests): `cardId`/`toCardId`/`cardSource`/`nativeId` +
      `normalizeSeenEntry` (legacy bare titles → `wikipedia:…`, known prefixes preserved). Seen-set,
      thread cache, reactions, and buffer dedup all re-keyed on `cardId`; `selectDiverseThreads` filters by
      `cardId`. `storage.ts` normalizes legacy seen/reaction keys on read (lazy migration) + adds `lastRealm`.
- [x] `src/lib/upstream.ts` — generic per-host request-spacing **gate** + 429/503 retry (extracted from
      `wiki-server.ts`, which now wraps it; its unit tests still pin the behaviour). Each source gets its own
      gate.
- [x] Realm registry: client `src/lib/realms/index.ts` (`getRealm`/`listRealms` + `discoverUrl`/`relatedUrl`/
      `summaryUrl` + per-realm `pickDiscover`) and server `src/lib/realms/server/{index,wikipedia}.ts`.
      Generic routes `/api/realm/[realm]/{discover,related,summary}` dispatch by realm (Next 16 async
      `params`); old `/api/wiki/{discover,related,summary}` deleted, `random`+`topics` kept as Encyclopedia
      helpers. Bucket allowlist (injection guard) preserved → 400.
- [x] `drift/page.tsx` + `CardView` are now realm-driven (read `?realm=`, route through the generic routes,
      set `data-realm`, gate ♥/✕ by `realmMeta.hasInterestModel`). Only Encyclopedia wired this milestone.
- [x] **Test M10:** build + lint clean, **107 unit tests green** (100 + 7 `card.ts`). Real-browser
      (`?title=Octopus`): seed → threads → thread-pull (Cephalopod limb) → read-more (557→3824) → ♥ (cardId-
      keyed, persists) → 6 distinct drift titles → trail map (5 thumbs) → save → "View in My Trails";
      surprise-me discover seeds a card; `data-realm="encyclopedia"`; **zero console/runtime errors**. Server
      routes return real `source`-stamped data; unknown realm / unknown+injection bucket / missing id → 400.
      **Legacy back-compat verified:** an injected pre-Phase-5 trail (no `realm`, cards with no `source`) +
      legacy bare-title seen + title-keyed reaction all list, open, and continue at the last stop (defaulting
      to Encyclopedia), then drift onward — zero errors.

> **Definitive milestone breakdown + verified API contracts live in the approved plan file**
> `~/.claude/plans/purring-skipping-breeze.md`. Locked decisions: homepage = **segmented tabs**; realms carry
> a **subtle per-realm accent** (Encyclopedia sage / Gallery terracotta / Library dusty-blue / Today amber,
> via a `[data-realm]` CSS scope over `--accent`); **interest model stays Encyclopedia-only** (Gallery/Library
> drift = interesting-random by facet, ♥/✕ hidden); **one trail = one realm** (cross-realm = Phase 7).

### M11 — Gallery realm + first multi-realm UI ✅ *(Art Institute of Chicago; DONE 2026-07-14)*
- [x] `realms/server/artic.ts` + pure `realms/artic.ts` + `artic.buckets.ts` (10 PD-rich buckets):
      `discover` = PD artworks by a bucket theme (`q` + `is_public_domain`) + random page; `related` = facet
      searches (**"More by {artist}"** via `artist_id` bool-must, **"Other {style}"** via `style_title`,
      **"Also from {place}"** via `place_of_origin`) — legible thread *directions* for free. IIIF URL builder,
      art→Card / art→candidate mappers (unit-tested, 8 new tests). Own `AIC-User-Agent` gate via `upstream.ts`.
      Registered `gallery` in both client + server registries.
- [x] `selectFacetThreads` (pure) for facet realms — one chip per distinct facet, label from the candidate;
      feed picks it by `realmMeta.threadMode`. Art card: `ImagePanel` shows the whole work (object-contain on a
      soft ground), `description` = "{artist} · {date}", source link "View at the Art Institute ↗", read-more =
      curatorial description/provenance, **no ♥/✕** (Gallery has no interest model).
- [x] Homepage **segmented tabs** (`RealmTabs`, each tab tinted by its own realm accent) — realm-aware seed
      grids (Encyclopedia titles / Gallery buckets) + "Surprise me in {realm}" + `lastRealm` persistence. Feed
      top-bar shows the realm marker. **Terracotta** accent scope in `globals.css` (light + dark) via
      `[data-realm="gallery"]`. My-Trails realm badge + per-trail accent tint (`data-realm` on each card).
- [x] **Test M11:** build + lint clean, **115 unit tests green** (107 + 8). API contract (curl): gallery
      discover returns real PD art w/ images + "{artist} · {date}"; related returns the 3 facet directions
      (verified Cassatt → "More by Mary Cassatt" / "Other Impressionism" / "Also from France"); extended returns
      real curatorial text. Real-browser (Impressionism seed): art card renders (image loads, object-contain),
      `data-realm="gallery"`, ♥/✕ hidden, facet chips shown, "More by Cézanne" → another Cézanne, read-more
      grew, 5 distinct art titles drifting, trail map (5 thumbs) → save → **My Trails shows the ❖ Gallery
      badge**; Encyclopedia unregressed (Octopus, ♥ present). **PNG export CORS resolved:** AIC IIIF images load
      with `crossOrigin` and `canvas.toDataURL` is untainted (the curl 403 is a bot block only). **Zero console
      errors.**

### M12 — Library + Today realms ⏸ *(DEFERRED by user decision 2026-07-14)*
User chose to ship Phase 5 with just **Encyclopedia + Gallery** for now — two focused, polished realms —
and add more later. The adapter interface (M10) makes this a clean drop-in whenever we return: each realm is
one server adapter + a registry entry + optional card-body tweak. Preserved research/design for when we do:
- [ ] `realms/server/gutenberg.ts` (+ buckets, book card body, dusty-blue accent): Gutendex discover by
      subject; facet threads (author/subject); read-more = opening passage from `text/plain` (strip Gutenberg
      header, reuse `extract.ts`). Proxy sends a real UA (Gutendex 403s bot UAs).
- [ ] `realms/server/today.ts` (contentSource wikipedia; + amber accent): discover = today's `onthisday`/
      `featured` feed (unauthenticated en.wikipedia REST — verified), shuffled; related/summary reuse Wikipedia;
      tab shows today's event tiles. No ♥/✕.

### M13 — Multi-realm polish & full look pass ✅ *(DONE 2026-07-14)*
- [x] My-Trails **realm filter chips** (shown only when trails span >1 realm; each chip glows in its own
      accent, toggles back to all) + realm badge + per-card accent tint (from M11). Trail-**detail** page now
      realm-aware (`data-realm` → terracotta/sage map edges + a realm label). Interests copy **scoped to
      Encyclopedia** ("Gallery isn't personalized"). Feed error/hint copy made **realm-agnostic** (no longer
      says "Wikipedia").
- [x] **Test M13:** build + lint clean, **115 tests green**. Real-browser: saved one Encyclopedia + one
      Gallery trail → My Trails shows both realm badges + the realm filter (Gallery filter hides the
      Encyclopedia trail); gallery trail detail is `data-realm="gallery"` with `--accent #b97d59`; **both
      accents verified in light + dark** (Gallery #b97d59→#cf9d80, Encyclopedia #6f8f74, all distinct);
      Interests page scoped to Encyclopedia. Graceful degradation: discover returns `[]` on failure, copy is
      source-neutral. **Zero console errors.**

**Phase 5 exit:** ✅ **Drift has tabs.** Two calm, polished realms — **Encyclopedia** (all of Wikipedia, sage,
topic-personalized drift) and **Gallery** (public-domain art from the Art Institute of Chicago, terracotta,
facet threads) — share one shell, the same pull-a-thread → trail-map loop, and per-realm accents in light +
dark. Everything degrades gracefully when a source is slow/down. (Library + Today deferred; trivial to add
later via the M10 adapter interface.)

---

## Phase 6 — Threads With Intention ✅ *(make the core mechanic legible — DONE 2026-07-14)*

**Goal:** Today the 3 thread chips are all the *same flavour* — "here are 3 related pages." That's a menu,
not steering. Drift's whole soul (§1, "you are the algorithm") is **direction**. Give each thread a
*character* so pulling one feels like a deliberate move, and the user can *see where it leads*:
- **↧ Go deeper** — a more specific / narrower facet of this subject.
- **↥ Zoom out** — the broader context this sits inside.
- **↔ Tangent** — a surprising lateral leap (the delightful non-obvious neighbour).

This is pure product craft, needs **no new API and no AI**, fits the existing `src/lib/*` pure-logic pattern,
and makes agency *felt*. It also plays perfectly with the trail map (edges could carry the direction glyph,
so a saved trail reads like a route: "deeper, deeper, tangent, out…").

> ✅ **DONE 2026-07-14.** Taxonomy decision (user): **"Aim high, always 3"** — aim for Deeper / Zoom out /
> Tangent; when a direction can't be found honestly, fill that slot with **Nearby** (closest related), never a
> fabricated relationship. Grounded in live `morelike` tests (deeper is reliable via title-containment +
> "species of X" descriptions; zoom-out only *sometimes* — hence the Nearby fallback). Scope: Encyclopedia
> only; Gallery facet threads unchanged. Plan file: `~/.claude/plans/purring-skipping-breeze.md`.
- [x] `src/lib/threads.ts` (pure, 12 tests): `classifyThreads(current, candidates, {seen,count})` +
      `isDeeper`/`isZoomOut`/`pickTangent` + `ThreadKind` (`deeper|zoomout|nearby|tangent`). Signals — deeper:
      current.title is the head of candidate.title, or a `/(species|genus|branch|…) of/` description referencing
      the current topic; zoom-out: candidate is the **head noun** of current.title (`phraseEndsWith`, so
      "Octopus" zooms out "Giant Pacific octopus" but "Pacific" doesn't), or a hypernym named in the current's
      **first sentence** ("…a large marine **cephalopod**…" → Cephalopod), with a precision guard against the
      title's own words; tangent: `classOf` divergence + furthest rank. Always-3 assembly, dedupe by `cardId`,
      thin-page graceful. Reuses `classOf`/`cardId`/`isJunk`.
- [x] `types.ts` (`Thread.kind`, `ArrivedVia` thread `kind`), `trailmap.ts` (`MeanderSegment.threadKind`).
      `ThreadChips.tsx`: two-line directional chip (kind glyph + word eyebrow + destination title) with a
      shared exported `KindIcon`/`KIND_META` (magnifier-+ deeper / magnifier-− zoom-out / diverging-arrow
      tangent / soft-wave nearby); facet (Gallery) chips render as before. `CardView` ModeChip names the
      direction ("Go deeper · {label}"); `TrailMap` draws the glyph on the thread edge. `drift/page.tsx`:
      Encyclopedia → `classifyThreads` (via a `cardForThreadsRef` to avoid a stale-closure race); records the
      kind on pull. Gallery path untouched.
- [x] **Test M14:** build + lint clean, **127 unit tests green** (115 + 12). Real-browser: **Octopus** →
      Go deeper / Nearby / Tangent (zoom-out honestly unavailable → Nearby, by design), correct chip order;
      **Giant Pacific octopus** → **Go deeper: Enteroctopus / Zoom out: Cephalopod / Tangent: Cuttlefish** (all
      three distinct, zoom-out surfaced); pulling a thread → mode chip names the direction + the trail map edge
      shows the glyph (kind persists in `ArrivedVia`); **Gallery unregressed** (facet chips, no direction
      words). **Zero console errors**; §2 intact (transparent "why", ≤1-ahead prefetch, no autoplay).

**Phase 6 exit:** pulling a thread feels like *choosing a direction*, not picking from a list — and the
trail map reads back the journey's shape. (Forward tie-in: Phase 7's embeddings/LLM can sharpen the
classifier and write more evocative labels, but the heuristic ships first and always works.)

---

## Phase 7 — Cross-Realm Threads: "Constellations"  ⏸ *(DEFERRED by user decision 2026-07-14 — AI/cost)*

> ⏸ **DEFERRED.** The user is staying away from the Ollama/AI layer for now (initial cost/capacity), and this
> phase depends on the embedding layer (Phase 3). Held until there's appetite for the local-AI stack. Nothing
> below is cancelled — it's the most "Drift" idea and worth returning to once AI is on the table.
>
> ⚠️ **Depends on the embedding layer from the deferred Phase 3** (local `nomic-embed-text` via Ollama).
> Do Phase 3 first, or build its minimal subset (embed endpoint + cosine + max-min) as M16 here. Also
> assumes **Phase 5** (realms exist to thread *between*).

**Goal:** the deepest expression of "you are the algorithm across all of human knowledge." Pull a thread on
the *Octopus* card and a chip offers Hokusai's *The Great Wave* (Gallery) or *Twenty Thousand Leagues Under
the Sea* (Library) — a jump *between realms* that's genuinely, visibly related. No single source can do
this; only a shared **semantic space** can. That space is embeddings — which is why the deferred Phase 3
isn't just "nicer labels", it's the **enabler of the app's most magical feature**. (This is the moment to
reframe/prioritise Phase 3 accordingly.)

- [ ] **M16 — Embedding layer** (revive Phase 3's embedding half, feature-flagged, graceful): `/api/embed`
      proxy → Ollama `nomic-embed-text`; `src/lib/embeddings.ts` cosine + greedy max-min; cache vectors in
      IndexedDB keyed by `cardId` + model. Unit-test the pure vector math with fixed vectors. **Never breaks
      the app** — Ollama down/slow/malformed ⇒ cross-realm threading silently disappears and in-realm
      threads carry on (§4).
- [ ] **M17 — Cross-realm related:** for the current card, embed its title+extract, and surface the nearest
      neighbours *from other realms'* discover pools (a small rotating candidate set per realm, embedded +
      cached). Offer **at most one** cross-realm chip alongside the in-realm threads so a session doesn't
      dissolve into noise — a special, rare "doorway", clearly marked.
- [ ] **M18 — Transparent by construction:** the cross-realm chip says *why* ("A wave, seen by a printmaker
      →", i.e. the shared thread), the mode chip names the realm you crossed into, and the trail map draws a
      distinct edge for a realm-crossing. The reason must be **honest** — derived from the actual semantic
      link, never invented (§2.1, §2.5). Keep threads still 100% user-driven; this adds a door, it never
      auto-walks through it.
- [ ] **Test Phase 7:** with Ollama on → an occasional, apt cross-realm chip appears within the prefetch
      window and lands somewhere genuinely related; with Ollama off → the app is exactly Phase 5 (in-realm
      only), no error, no empty chip. Cache means revisits cost nothing. A saved cross-realm trail exports
      and reads as a coherent constellation.

**Phase 7 exit:** Drift can thread the octopus to the wave to the novel — a transparent, user-steered walk
across art, science, and literature that no feed algorithm on earth offers, because *you* are the algorithm.

---

## Phase 8 — The Atlas: your constellation of curiosity ✅ *(M19 DONE 2026-07-14; M20–M22 parked)*

> ▶ **Scoped to M19 only (user, 2026-07-14).** The user wants **the Atlas page** — a constellation view of
> everything you've wandered, with the topics/clusters/nodes drawn out. M20–M22 are parked (see below).
> **This is the next phase being planned** (plan file: `~/.claude/plans/purring-skipping-breeze.md`).

**Goal:** today the reward is the per-session trail map — lovely, but it evaporates after "Save". Make the
reward *accumulate*: a single, growing constellation of *all* your saved trails, so you can see the shape of
your own curiosity. Anti-slot-machine register throughout (reward at the exit, calm, no streaks/metrics).

- [x] **M19 — The Atlas** (`/atlas`) ✅ *(DONE 2026-07-14)*: draws every saved trail as one **"clustered
      galaxies"** constellation. `src/lib/atlas.ts` (pure, 8 tests): `buildConstellation(trails)` (nodes deduped
      by `cardId` + visit counts; thread/drift edges aggregated with Phase-6 `kind`; clusters by **propagating a
      topic along each trail** — drift topic → meaningful seed → thread-inherit → realm fallback, majority vote)
      \+ `layoutConstellation` (sunflower/phyllotaxis packing within each island + row-pack of islands,
      deterministic). `Atlas.tsx` (SVG): realm-tinted cluster halos + labels (`data-realm`), neutral thread/
      drift edges, **dot nodes** sized by visits, drag-pan + zoom buttons + fit, hover `<title>`, click →
      most-recent trail, PNG export (fit-all before capture). `/atlas` page with empty state + stat line, linked
      from home + My Trails. **Verified:** build+lint clean, **135 tests green** (127 + 8); real-browser — empty
      state before trails; after saving 3 trails (2 Encyclopedia + 1 Gallery) the atlas shows **5 labeled topic
      islands** across **both realms** (sage + terracotta `data-realm` groups), cluster labels render, zoom
      grows the canvas (1100→1320), clicking a node opens its trail, **Export produced a PNG download**, zero
      console errors, §2 intact (read-only, calm).

**Parked (not this phase; revisit later):**
- [ ] **M20 — "Remember this?"** — spaced resurfacing at a session *beginning* (spec §12), serving "did I
      remember it two days later?" (§9 #4).
- [ ] **M21 — Weekly reflection** — a gentle, opt-in "this week" panel (descriptive, never gamified).
- [ ] **M22 — Keep a fact** — quiet "keep" of a card/sentence to a personal shelf, feeding the Atlas.

**Phase 8 exit (this scope):** a living Atlas — every session adds to a personal, zoomable constellation of
what you've wondered about, clustered by topic. The meta-reward, at the exit, never a scoreboard.

---

# 🌐 FUTURE DIRECTION — Drift as a (calm) social platform  *(v3+; proposed 2026-07-14, NOT started)*

> The user wants to grow Drift into a social platform: **accounts** (trails, interests, preferences all stored
> per-user), then **sharing cards & whole trails to other people**, and eventually a **native app**. This is a
> big, multi-phase step that **deliberately reopens spec §3's "Out" list** (accounts / social / mobile app).
>
> ⚠️ **Non-negotiable:** the anti-slot-machine principles (§2) still bind. A *social* Drift must NOT become
> the doomscroll it exists to replace — **no infinite feed, no like-counts as dopamine, no notification bait,
> no streaks/leaderboards.** Social features stay in Drift's register: calm, bounded, transparent, agency-
> first. If a social feature can't be built without engagement-maximizing patterns, it doesn't get built.
>
> **Recommended stack (researched 2026-07-14):** one integrated backend that serves the web app now *and* a
> future mobile app — **[Supabase](https://supabase.com/docs)** (Postgres + Auth + Row-Level Security +
> Storage + Realtime; generous free tier; first-class React Native SDKs). Postgres RLS does much of the
> per-user authorization. Alternatives weighed: **Better Auth** (own your users in your own Postgres, TS-native)
> and **Clerk** (best drop-in auth UX but gets expensive at scale, US-hosted user data) — see
> [comparison](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk). Auth.js/NextAuth is the free
> DIY option.
>
> **Keep-the-future-app-in-mind (architecture guidance, applies from Phase 9 on):**
> 1. **Pure logic already portable** — `src/lib/*` (filtering, diversity, drift, threads classifier, interest,
>    trailmap, atlas, card ids) has no React/DOM deps; extract it to a shared package later and the app reuses it.
> 2. **Everything behind an API/BaaS both web + app call** — no business logic trapped in React components;
>    the Supabase client (or a thin Next API layer) is the shared contract.
> 3. **Local-first sync** (so it stays instant + works offline, which an app needs): keep IndexedDB as the
>    fast local cache, sync to Postgres in the background. Use **server-generated timestamps** as source of
>    truth, a **`_deleted` soft-delete flag** (can't hard-delete until all clients replicate), and idempotent
>    writes. Build lean (custom sync of our small key-value stores) or adopt **RxDB/PowerSync/ElectricSQL** if
>    it grows — see [rxdb-supabase](https://github.com/marceljuenemann/rxdb-supabase) and
>    [local-first sync notes](https://www.techbasics.online/local-first-web-architecture-indexeddb-postgres-sync).

## Phase 9 — Accounts & Cloud Sync  *(the backend foundation — big; multi-milestone)*
**Goal:** optional accounts that persist a user's world (trails, interests, reactions, sessions, seen, kept)
in the cloud, syncing across devices — while keeping the app fully usable **signed-out/local** (accounts are
additive, never a gate to drifting). This is the foundation every later social feature builds on.

> **Decisions (with user, 2026-07-14):** backend = **Supabase** (user-provisioned cloud free tier, creds in
> git-ignored `.env`); auth first = **email + password** (magic-link/OAuth structured to drop in later);
> sync = **lean custom local-first** (no RxDB/PowerSync — overkill for our tiny KV data); schema applied by
> **pasting `supabase/migrations/0001_phase9_schema.sql` into Studio**, then verified via `npm run
> verify:supabase`. Direct browser→Supabase (secured by publishable key + RLS) is a sanctioned exception to
> §4's "proxy everything" (which exists for Wikipedia UA/CORS); the **secret key stays server-only**. Full
> design: `~/.claude/plans/adaptive-wondering-snail.md`.

### M23 — Supabase foundation: client, auth, schema + RLS  *(data sync NOT yet wired)*
- [x] `@supabase/supabase-js` added; `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
      `.env` (git-ignored); `.env.local.example` documents all vars (secret = server-only).
- [x] `src/lib/supabase/client.ts` — graceful singleton (null when unconfigured/SSR ⇒ app stays byte-for-byte
      the old local-only app). `src/components/AuthProvider.tsx` + `useAuth` (no-op when unconfigured).
- [x] `/account` page (calm email+password sign in / up / out) + quiet global `AccountButton` (hidden when
      unconfigured, no badges/dots). Wired into `layout.tsx`.
- [x] `supabase/migrations/0001_phase9_schema.sql` — `trails` (row-level), `reactions` (row-level, PK
      user_id+card_id), `user_kv` (blob: settings/interests/seen/sessions), all with `updated_at` triggers +
      RLS `user_id = auth.uid()`. `scripts/verify-supabase.mjs` (`npm run verify:supabase`) asserts tables +
      RLS isolation + trigger + upsert.
- [x] **Verified so far (build+lint+135 tests green):** real-browser — signed-out app unchanged + core loop
      works; `/account` renders; **sign in → session persists across reload → sign out**; account affordance
      reflects state; **degradation** (blank env) → app runs fully local, affordance hidden, zero errors.
- [x] **User step done (2026-07-14):** migration SQL pasted + "Confirm email" disabled. `npm run
      verify:supabase` is **all-green** (tables exist, RLS isolates non-owners, trigger stamps `updated_at`,
      upserts work). **M23 COMPLETE.**

### M24 — Local-first sync engine, proven end-to-end on Trails ✅ *(DONE 2026-07-14)*
- [x] `src/lib/sync/merge.ts` (pure, **11 unit tests**: LWW, dirty-wins, soft-delete, cursor advance, no-op
      detection, input-immutability). `src/lib/sync/replicator.ts` (thin, fully try/caught — never throws into
      the app). storage.ts got a **sync journal + cursors** (`syncState` key, one serialized chain),
      change-events (`subscribeStore`), a **recording toggle** (off ⇒ unconfigured app writes nothing extra),
      **serialized trail writes** (`withTrails`, since the replicator now writes concurrently), and
      `applyRemoteTrails`. **Trails only** this milestone.
- [x] Debounced push (1.5 s) of journaled upserts + soft-delete tombstones; pull on **sign-in / focus /
      visibility / `online`** (all do a full pull+push so a reconnect flushes offline edits); server-timestamp
      LWW via a `BEFORE INSERT/UPDATE` trigger; **first-sign-in adoption** of the signed-out user's trails;
      **sign-out keeps all local data** + journal (resumes on next sign-in). AuthProvider wires start/stop +
      recording. `/account` shows a quiet sync-status dot; the trails list re-reads on `storeUpdated`.
- [x] **Verified (build+lint+146 tests green):** two-profile real-browser E2E, **11/11 green, zero console
      errors** — signed-out save → **sign-in adopts it to the cloud**; **device B sees device A's trail**;
      **rename & delete propagate A→B** (soft-delete); **offline save works client-side and syncs on
      reconnect**. Degradation (blank env) re-confirmed from M23; Supabase-unreachable path covered by the
      offline test (errors caught, local unaffected).

### M25 — Sync the rest: reactions, interests, settings, seen, sessions ✅ *(DONE 2026-07-14)*
- [x] Replicator generalized into **collections** (`trails`, `reactions` — per-record LWW + tombstones) and
      **blobs** (`user_kv`: `interests`/`settings` whole-value LWW; `seen`/`sessions` **union** so two devices
      combine, via `pushSeen` / `mergeSessions`). `topicsCache` stays local-only. storage.ts got journaling +
      `applyRemote*` + serialization for every store; `mergeSessions` added to merge.ts (**+3 tests → 14**).
- [x] **Adoption correctness fix (caught by the test):** first-sign-in adoption now marks only **non-empty**
      blobs dirty — a fresh device PULLS the account's settings/interests/seen/sessions instead of clobbering
      them with local defaults.
- [x] **Verified (build+lint+149 tests green):** two-profile real-browser, **12/12 green, zero console
      errors** — device A likes a card (reaction), drifts (seen), ends a session (sessions), boosts a topic
      (interest), turns personalization off (settings); **all five stores land on the server**; a fresh
      device B **pulls settings (personalize=off) and the reaction (♥)**. seen/sessions share the verified blob
      path.

### M26 — Hardening, docs & Phase 9 exit ✅ *(DONE 2026-07-14)*
- [x] Resilience: focus/online/visibility trigger a coalesced pull+push (`inFlight`+`rerun` guard so a change
      mid-cycle still flushes); debounced push; sign-out keeps local data + journal. Known limits documented
      (LWW conflicts, one-account-per-device, seen/sessions union) in `docs/backend.md`.
- [x] **`docs/backend.md`** — full setup (env, one-time schema paste, `verify:supabase`), data model, how sync
      works, known limitations, and a **"Scaling Drift" guide** (free-tier limits; custom SMTP for auth email;
      Pro plan / project-pausing; blob→rows; PowerSync/Electric/RxDB; Realtime; pooling; backups; image CDN;
      opening signups). Replaced the stock `README.md` with a real Drift intro. Updated CLAUDE.md §3/§4/§7.
- [x] **Full regression (build+lint+149 tests green):** signed-out comprehensive flow (core loop, thread pull,
      react, save, reload-persist, continue, interests, atlas) **10/10, zero errors**; blank-env degradation
      **6/6, zero errors**; two-device + offline verified in M24/M25. §2 register held (quiet sync dot, no
      badges/streaks; accounts never gate drifting).

**Phase 9 exit:** ✅ Drift has **optional accounts** and **local-first cloud sync**. Sign in and your whole
world (trails, reactions, interests, settings, seen, sessions) follows you across devices; sign out or lose
the backend and Drift is exactly the calm local-only app it always was. This is the foundation Phases 10–12
build on. Backend/scaling docs: `docs/backend.md`.

## Phase 10 — Social graph & sharing  ✅ *(COMPLETE — 2026-07-16)*
**Goal:** find & add friends, send a card or a whole trail to a friend, and pick up where a friend's
curiosity left off — the spec's §12 "trail seeds from friends", made real.

> **Decisions (with user, 2026-07-16):** **mutual friends** (request → accept, not one-way follow);
> **handle-only discovery** (no name directory); **friend-inbox only** this phase (no public links —
> nothing readable without an account). Social data is **live-fetched** via `src/lib/social/*` (the Phase 9
> replicator is untouched); a continued/added received trail becomes the recipient's own local trail and
> syncs via Phase 9. "Continue theirs" reuses the existing `?continue=` path (no drift-page changes). §2
> holds: finite inbox (feed = Phase 11), quiet indicators, no vanity counts. Plan file:
> `~/.claude/plans/adaptive-wondering-snail.md`.

### M27 — Identity & the friend graph  🚧
- [x] `supabase/migrations/0002_phase10_social.sql`: `profiles` (unique handle `^[a-z0-9_]{3,30}$`),
      `friend_requests` (pending/accepted, request-based mutual model), `are_friends()` helper — all RLS +
      `set_updated_at` triggers (reuses 0001's function).
- [x] Pure logic: `src/lib/social/handles.ts` (normalize/validate) + `friends.ts`
      (`deriveRelationship`/`partition`/`otherPartyId`) — **12 unit tests**. `src/lib/social/client.ts` (graceful:
      `getMyProfile`/`upsertProfile`/`searchByHandle`/`listFriendData`/`send`+`respond`+`removeFriendship`).
- [x] Handle/display-name setup on `/account`; `/friends` page (search by handle → request; incoming
      accept/decline; outgoing cancel; friends list + unfriend); homepage **Friends** link (cloud-gated).
      `scripts/verify-social.mjs` (`npm run verify:social`).
- [x] **Verified so far (build+lint+161 tests green):** pre-migration graceful check — `/account` + `/friends`
      render without crashing, core drift loop unaffected (missing-table 4xx are expected and clear post-migration).
- [x] **User step done (2026-07-16):** `0002_phase10_social.sql` pasted. `npm run verify:social` **all-green**
      (profiles upsert + unique handle; request→see→accept; **RLS: unrelated user sees nothing, non-addressee
      can't accept**; `are_friends` true). Two-account real-browser E2E **11/11, zero console errors** (both set
      handles, A finds B by handle, request → B accepts → both friends → unfriend reflects on both). **M27 COMPLETE.**

### M28 — Sharing & the inbox ("send things" + "continue theirs")  🚧
- [x] `supabase/migrations/0003_phase10_shares.sql`: `shares` (snapshot payload) + RLS — **insert only between
      friends** via `are_friends()` + `set_updated_at` trigger. `src/lib/social/share.ts` (pure, **5 tests**:
      snapshot/import round-trip). `client.ts` share calls (`sendShare`/`listInbox`/`markShareRead`/
      `deleteShare`/`socialBadge`).
- [x] `ShareToFriend` dialog (pick friend + note + send) on the **trail detail** page and the **feed card**
      (quiet paper-plane in CardView, wired from drift). `/inbox` page: received trail/card, **Continue this
      trail** (snapshot → new local trail via module-scope `importSnapshot` → `?continue=`), **Add to my
      trails**, card preview + "View source ↗" + "Drift from here"; delete; mark-read on open. Homepage **Inbox**
      link; **quiet sage dot** on the account affordance (unread shares + incoming requests; no red/number, no polling).
- [x] `verify-social.mjs` extended with share tests. **Verified so far (build+lint+166 tests green).**
- [x] **User step done (2026-07-16):** `0003_phase10_shares.sql` pasted. `npm run verify:social` **all-green**
      (friend can send; **non-friend BLOCKED by RLS**; non-recipient reads nothing). Two-account real-browser
      E2E **10/10, zero console errors** — A sends B a trail (+ note) → B sees the quiet unread dot → inbox
      shows it → **B continues → B's own trail synced to the cloud**; card sharing via the feed paper-plane
      also lands in B's inbox. **M28 COMPLETE.**

### M29 — Calm guardrails, docs & Phase 10 exit ✅ *(DONE 2026-07-16)*
- [x] §2 register held throughout: finite newest-first inbox (no feed), single quiet **sage** unread dot
      (no red/number, focus-checked not polled), deliberate pick-a-friend sharing, handle-only discovery, no
      vanity counts. All social calls graceful (backend down → calm empty states; core loop untouched).
- [x] Docs: `docs/backend.md` extended (social tables + RLS + `are_friends` + §5b social layer + social scaling:
      blocking/abuse, rate-limits, handle indexing, digest-not-bait). `README`/`CLAUDE.md §4` updated.
- [x] **Full regression (build+lint+166 tests green):** two-account social E2E (M27 friends 11/11 + M28 sharing
      10/10, zero errors); **blank-env degradation 8/8** (no Friends/Inbox links, no share affordance, `/friends`
      + `/inbox` degrade to calm prompts, core loop works); **Phase 9 sync unregressed** (proven inside M28 — A's
      trail synced, B's continued copy synced). **M29 COMPLETE.**

**Phase 10 exit:** ✅ Drift is a **calm social platform**. You set a handle, find friends by handle, send a
friend request they accept, then **send a trail or card to a friend's inbox** and **continue theirs** (it
becomes your own synced copy). Friends-only sending is enforced in the DB (RLS + `are_friends`). Nothing about
signed-out/local Drift changed. The §2 soul held — a finite inbox, quiet awareness, deliberate sharing; the
doomscroll feed is deliberately deferred to Phase 11. Backend/scaling docs: `docs/backend.md`.

## Phase 11 — A calm social feed  ⏸ *(DEFERRED 2026-07-16 — optimize the core product + ship first)*
> ⏸ **DEFERRED by user decision (2026-07-16).** The user wants to optimize the main product and get it
> online/installable (Phase 13) before stepping further into the social-media dimension. Not cancelled — this
> is still the §2-hardest phase and worth returning to once the core is polished and in daily use.

**Goal:** "what the people I follow have been wandering" — **without** becoming a feed to doomscroll.
- [ ] A **bounded, digest-style** view (e.g. "this week's trails from people you follow"), explicitly **not**
      an infinite auto-loading feed. Finite, has an end, no "just one more".
- [ ] **Gentle, batched notifications** (a quiet digest, never per-event bait; opt-in). No red badges, no streaks.
- [ ] Minimal, non-competitive reactions (if any) — a quiet "loved this trail", never a public score race.

## Phase 12 — Mobile app  ⏸ *(DEFERRED 2026-07-16 — the installable PWA in Phase 13 is the lighter interim)*
> ⏸ **DEFERRED by user decision (2026-07-16).** Rather than build a native app now, Phase 13 ships an
> **installable PWA** (add-to-home-screen, standalone) — cheap, no app-store friction — so the user can test
> Drift as a web-app on their phone right away. A true native Expo/React-Native app stays the eventual step
> once the PWA has proven the mobile experience.

**Goal:** a real Drift app (iOS/Android) reusing the same backend.
- [ ] **Expo / React Native** app against the same Supabase backend; extract `src/lib/*` into a shared package
      consumed by both web and app (see architecture guidance). Rebuild the feed/card/trail-map UI natively
      (gestures map cleanly to the drift/thread mechanic). Web stays; the app is an additional client.

---

## Phase 13 — Go Live: deploy online (free) + installable web-app  🚀 *(CURRENT — started 2026-07-16)*
**Goal:** get Drift **online for free** and **installable on a phone as a web-app**, so it can be used and
tested in the real world — *before* extending the social dimension (Phases 11–12 deferred). Hosting =
**Vercel Hobby (free)**; backend = the **existing Supabase** project (no change). Two product changes fall
out of going multi-user: **accounts become required** when the cloud is configured (no anonymous drifting on
the public URL), and **each account sees only its own trails** (local data cleared on sign-out).

> **Decisions (with user, 2026-07-16):** host on **Vercel** (project already on the user's GitHub); **require
> sign-in** when cloud-configured (logged-out ⇒ a calm sign-in/create-account gate — a demo/anon mode is a
> later idea); **clear local data on sign-out** so no account's trails linger for the next; ship an
> **installable PWA** (manifest + icons + iOS meta, `display: standalone`) — **no service worker for now**
> (avoids stale-cache headaches; the app needs the network for content anyway); keep Supabase **"Confirm
> email" OFF** for now (frictionless friends-only signup). **Graceful degradation preserved:** the gate + all
> cloud behaviour activate ONLY when `isCloudConfigured()` is true, so a no-env local clone is byte-for-byte
> the old fully-local app (CLAUDE.md §4). The anti-slot-machine principles (§2) are untouched — this is about
> identity/hosting, not engagement mechanics. Full design in the Phase 13 plan file.

### M30 — Require an account + true per-account isolation ✅ *(DONE 2026-07-16)*
- [x] Auth **gate** (`src/components/AuthGate.tsx`, wrapped around `{children}` in `layout.tsx`):
      `cloudConfigured && !user` ⇒ a calm branded "Drift · sign in to start drifting" screen; `loading` ⇒ a
      quiet placeholder; `!cloudConfigured` ⇒ app ungated (local-only, §4). Shared `src/components/AuthForm.tsx`
      extracted from `/account` (used by both the gate and the account page).
- [x] **Clear all local stores on sign-out** — `clearAllLocalData()` in `storage.ts` (removes every store +
      sync journal/cursors/lastUserId, emits remote events, leaves `localStorage` theme mirror). `AuthProvider`
      `signOut()`: best-effort `flushSync()` → Supabase sign-out → `stopSync()` → `clearAllLocalData()`. Account
      switch: `handleSignIn` (replicator) now `clearAllLocalData()` on a different `lastUserId` (adoption path
      for first account unchanged).
- [x] Updated stale "additive / optional / never a gate" copy in `AuthProvider`, `AccountButton`, `/account`
      intro, and `docs/backend.md` (§1 core principle + the one-account-per-device limitation).
- [x] **Test M30:** build + lint + **166 unit tests green**. Real-browser (prod build, env set): **11/11** —
      logged-out shows the gate, `/trails` gated; sign-in reveals the app; an injected trail is **wiped from
      IndexedDB on sign-out** and the gate returns; re-sign-in loads cleanly; **zero console errors**. Blank
      Supabase env (dev): **6/6** — no gate, homepage + `/trails` load directly (§4 intact), zero errors.

### M31 — Installable web-app (PWA) + mobile polish ✅ *(DONE 2026-07-16)*
- [x] `app/manifest.ts` (name/short_name "Drift", `start_url:"/"`, `display:"standalone"`, `background_color`
      `#f5efe4` + `theme_color` `#6f8f74`, 192/512 + maskable icons). `layout.tsx`: `viewport.themeColor`
      (light `#f5efe4` / dark `#1b1917`) + `viewportFit:"cover"` + `metadata.appleWebApp` (`capable`, `title`,
      `statusBarStyle`). Icons auto-linked via file conventions (`app/icon.svg`, `app/apple-icon.png`).
- [x] `scripts/make-icons.mjs` — icons. _(Superseded by the user's real brand art, 2026-07-16: the script now
      derives everything from `logos/png/*` — copies the wordmark + monogram to `public/brand/`, uses the
      "D + dot" master for `src/app/icon.png` (favicon) / `apple-icon.png` / `public/icon-192/512` + a
      full-bleed `icon-maskable-512`. New `src/components/BrandLogo.tsx` (`Wordmark`/`Monogram`, no-JS
      light↔dark swap via `.brand-light/.brand-dark`) renders on the homepage hero, the AuthGate, and the
      feed top bar. Baked-in-font PNGs used because the brand SVGs rely on the Fraunces webfont.)_
- [x] **Mobile pass:** safe-area utilities in `globals.css` (`bottom-safe`/`pb-safe` = `calc(1rem +
      env(safe-area-inset-bottom))`) applied to the fixed ThemeToggle/AccountButton and the feed card wrapper
      + hint/nudge overlays (clear the iOS home indicator in standalone; no-ops in a normal tab). iOS
      `statusBarStyle:"default"` reserves the top status bar, so only the bottom needed handling. Card was
      already responsive (`md:flex-row`, `h-[34vh]` image band, `sm/lg` type) — audit found no overflow to fix.
- [x] **Test M31:** build + lint + **166 tests green**. Real-browser (iPhone-13 viewport, 390px): **11/11** —
      `/manifest.webmanifest` valid (`display:standalone`, 3 icons); **no horizontal overflow** on gate, home,
      drift, trails, interests, atlas, friends, inbox, account; live probe confirms the card title is visible +
      Read-more scrolls + threads pinned/reachable; touch taps navigate; **zero console errors**. (Real-device
      add-to-home-screen install is part of M32's post-deploy check with the user.)

### M32 — Production config + deploy docs (the user's go-live checklist) ✅ *(code/docs DONE 2026-07-16; live deploy = user step)*
- [x] **`docs/deploy.md`** — a step-by-step, copy-paste checklist for the user: push to GitHub → import the
      repo on Vercel → set env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
      optional `WIKI_USER_AGENT`/`ARTIC_USER_AGENT`; **secret key NOT set in prod**) → set Supabase **Site
      URL + redirect allow-list** to the Vercel domain → deploy → open on the phone → add to home screen.
      Free-tier notes (Vercel Hobby caps; Supabase 7-day idle pause) + a rollback/troubleshoot section
      included. Added a "Deploy it (free)" section + Docs pointer to `README.md`; updated `.env.local.example`.
- [x] Verified a **production build** (`npm run build` clean + TypeScript clean; `/manifest.webmanifest`,
      `/icon.svg`, `/apple-icon.png` emitted). The app runs against the **real Supabase project** — sign-in +
      the sign-out wipe + re-sign-in all verified green in M30 (env configured). Sync/sharing code paths are
      unchanged from Phases 9–10. No `vercel.json` needed (auto-detected).
- [ ] **Test M32 (post-deploy, WITH the user):** the live Vercel URL loads; sign-in works; a trail saved on
      the phone syncs to Supabase and appears on desktop (and vice-versa); friends/inbox work; the app is
      installed to the phone home screen and runs standalone. _(Awaiting the user's `docs/deploy.md` run.)_

**Phase 13 exit:** Drift is live on a free public URL, installable as a web-app on the phone, gated behind a
required account (each account private to its own trails), while an unconfigured local clone stays the calm
fully-local app it always was. The native app (Phase 12) and the calm feed (Phase 11) remain the next steps
when the user is ready.

---

# 🌱 THREE NEW DIRECTIONS (2026-07-17) — deepen what exists

> From a full-app brainstorm. The user's steer: **make the current app better/stronger/more interactive**,
> **keep two great realms** (no 3rd), and **product before social** (the calm feed / native app stay deferred).
> These are the committed next directions. **Phase 14 (Gallery) is being built first** (its detailed milestone
> plan is produced separately in plan mode); Phases 15–16 are captured here at idea-phase depth so they can be
> picked up whenever. All three bind the anti-slot-machine principles (§2). Nothing below is started; boxes are
> unticked on purpose. Mobile-first is a hard constraint for all of them (Drift is used mostly as a phone PWA).

---

## Phase 14 — Gallery, Deepened  *(make the second realm as strong as the first — STARTING 2026-07-17)*

**Goal:** the Gallery is currently ~half the Encyclopedia's richness — good AIC metadata is *fetched and
thrown away*, "Read more" is usually empty, the art is a flat 843px image with no zoom, threads are flat
"More by X" chips with no direction, and there's no personalization. Close that gap so the two realms feel
equally cared-for. Nothing here needs a new source or AI — it's craft over data we already pull. **Mobile is
the primary target**, so every addition must be small-screen-safe (labels that don't eat the viewport, a
zoom that feels native to a phone).

**Verified research (mobile-first, done 2026-07-17):**
- **Deep-zoom the art — lightweight, NOT OpenSeadragon.** AIC source images are huge (e.g. *The Great Wave*
  is `10169×7036`), so there's real detail to explore. The card keeps AIC's cached standard
  `…/full/843,/0/default.jpg`; **zoom lazily loads the sanctioned public-domain larger size
  `…/full/1686,/0/default.jpg`** (AIC docs: "you may use `1686` for larger images … unless there's a clear
  need"; zoom *is* that need) inside a **tap-to-open fullscreen lightbox with lightweight pinch-zoom-pan**.
  This avoids OpenSeadragon + IIIF tiling (too heavy for a calm PWA; the `info.json` is bot/paywalled anyway),
  respects AIC's "hit the cached sizes, one image at a time" etiquette, and keeps zoom in its **own mode** so
  pinch never fights the feed's vertical advance / horizontal realm-swipe gestures. OpenSeadragon stays a
  future option only if 1686 ever proves too small. Free calm touches from the API: `thumbnail.lqip` is a
  base64 blur placeholder (**blur-up load, no layout shift**) and `thumbnail.alt_text` gives real **a11y alt
  text**.
- **Museum label on mobile = progressive disclosure.** Keep the essentials inline (artist · date · title, as
  now); put the full label (medium, dimensions, credit line, department, place of origin, classification,
  subjects) behind an expandable **"Details"** section so it never eats a small screen. Because the mobile
  card already scrolls (image is a scroll-away hero), the simplest safe pattern is the label as **scroll
  content below the extract**; a bottom-sheet is the richer alternative if wanted. (NN/g: bottom sheets are
  progressive disclosure; museums are the canonical progressive-disclosure example.)
- **Metadata already fetched but unused:** `medium_display`, `dimensions`, `classification_title`,
  `department_title`, `style_title`, `subject_titles`, `place_of_origin`, `credit_line`, `color` (dominant
  HSL) — all present on the artwork record, none surfaced today.

**Sub-directions (exact milestone breakdown to come from the plan-mode plan file):**
- [x] **Museum-label panel — DONE & verified (2026-07-17).** Surfaces the already-fetched AIC fields as a calm,
      tap-to-open **"Details"** label (Medium / Dimensions / Classification / Department / Origin / Subjects /
      Credit; skips empties). Generic `Card.facts` + `zoomUrl`/`blurDataUrl`/`imageAlt` added to `types.ts` (all
      optional, back-compat); pure `artFacts()` in `realms/artic.ts` (+`ARTIC_FIELDS` gained `dimensions,
      credit_line,thumbnail`); `CardView` renders the disclosure as inline scroll content (never an overlay →
      mobile-safe) + a blur-up (`lqip`) load + real `alt_text`. **Verified:** build+lint clean, **201 tests**
      (+4), real-browser 390px **12/12** (label discloses, 0 horizontal overflow, alt present, Encyclopedia
      unregressed, zero console errors). _Headless caveat: AIC image pixels are bot-blocked in headless Chromium
      (inherited-working in real browsers); the 34dvh hero band + blur placeholder render correctly._
- [x] **Deep-zoom lightbox — DONE & verified (2026-07-17).** Tap the artwork → a fullscreen `ArtZoom`
      (`react-zoom-pan-pinch` 4.0.3) pinch-zoom-pan on the 1686px image, `lqip` blur-up, `alt_text` for a11y,
      calm (opt-in, no autoplay). **Rendered via a portal to `<body>`** so its touch/wheel never reaches the
      feed's gesture handlers (own mode); body-scroll lock; close via ✕ / Esc (capture-phase, so the library
      can't swallow the first Escape) / backdrop-tap; focus moves into the dialog on open (a11y). Gated to
      `source==="artic" && zoomUrl`. **Verified:** build+lint clean, 201 tests, real-browser 390px **11/11**
      (opens, body-locks, pan surface, close paths, feed does NOT advance during zoom, Encyclopedia not
      zoomable, zero console errors). Same headless AIC-image caveat (chrome + blur render; artwork pixels load
      in a real browser).
- [x] **Directional / legible art threads — DONE & verified (2026-07-17).** Facet chips now have *character*
      like the Encyclopedia's directions: a two-line chip with an **eyebrow** + entity — **MORE BY** {artist}
      (deeper into an oeuvre), **THE MOVEMENT** {style} (broader), **THE SUBJECT** {subject} (a lateral tangent
      via `subject_titles`, newly used), **ALSO FROM** {place} (fallback). `Thread.eyebrow`/`RelatedCandidate.eyebrow`
      added; `articRelated` builds the 4 facets (best-effort, so a single-work artist yields no dead chip) and
      `selectFacetThreads` now shows **distinct directions only** (no duplicate-facet padding). `ThreadChips`
      renders the eyebrow chip (mirrors the `kind` chip). **Verified:** build+lint clean, **202 tests**, live
      related API returns all 4 eyebrows + the subject facet, browser shows the ideal trio (Cassatt → MORE BY /
      THE MOVEMENT / THE SUBJECT) and a 2-direction card shows 2 distinct chips (no dup), zero console errors.
- [x] **Richer, structured discovery — DONE & verified (2026-07-17).** Buckets gained an optional structured
      `filter` (a `match` on `style_title` / `classification_title` / `subject_titles`), used where verified
      cleaner than full-text (impressionism → style: **241 focused vs 61k noisy**; textiles/landscape/portrait/
      mythology); noisy cases (still-life, botanical, ukiyo-e, ancient, birds) keep full-text. `articDiscover`
      also samples **deeper for variety** (page ≤ 30, with a total_pages-aware fallback so it never overshoots
      to empty). Injection guard unchanged (unknown bucket → 400/[]). **Verified:** build+lint clean, **203
      tests**, live discover shows on-theme impressionist works varying across offsets (Bedroom → Equestrienne →
      Water Lily Pond) and full-text buckets still work.
- [ ] **(Optional, DEFERRED) light Gallery personalization** — a facet-based taste model (favorite
      artists/movements) mirroring the Encyclopedia interest model, kept transparent + editable (§2.1). Left
      deferred (the locked default is "Gallery drift = interesting-random by facet"); a clean follow-up if wanted.

**Anti-slot-machine notes:** zoom and details are opt-in and calm; discovery stays bounded (no infinite art
firehose); no autoplay/Ken-Burns pans (§2.2); any personalization stays transparent + user-controlled (§2.1).

**Phase 14 exit:** ✅ **COMPLETE & verified (2026-07-17), M-G1–M-G4 (M-G5 optional/deferred).** An art card now
reads like a real museum object you can lean into: a progressively-disclosed museum label, art you can
pinch-zoom on your phone, threads with direction (MORE BY / THE MOVEMENT / THE SUBJECT / ALSO FROM), and
cleaner, more varied discovery. The Gallery now matches the Encyclopedia's care. **203 unit tests, build+lint
clean; real-browser 390px verified per milestone (M-G1 12/12, M-G2 11/11, M-G3 chips+distinctness, M-G4 live
discover) + an integrated end-to-end pass 11/11, zero console errors.** New dep: `react-zoom-pan-pinch`. §2
held throughout (opt-in, calm, bounded, no autoplay). Encyclopedia fully unregressed. _(Headless caveat: AIC
image pixels are bot-blocked in headless Chromium; chrome/label/blur render correctly, and images load in a
real browser as always.)_

---

## Phase 15 — Cross-Realm Doorways: one connected world  *(the "magic" — no AI needed)*

**Goal:** today a Gallery trail and an Encyclopedia trail never touch, and the deferred Phase 7 "constellation"
idea was gated on the AI/embedding layer. **It isn't anymore.** Verified 2026-07-17: every art card carries
clean strings — `artist_title` ("Katsushika Hokusai"), `style_title` ("Ukiyo-e"), `place_of_origin`,
`subject_titles` — and **all of them resolve cleanly onto the Wikipedia article via the summary endpoint Drift
already proxies** (live: Hokusai → *Hokusai*, "Ukiyo-e" → *Ukiyo-e*, "Claude Monet" → *Claude Monet*,
"Impressionism" → *Impressionism*, redirects and all). So a **factual, transparent, no-Ollama bridge** exists
in both directions. This is the app's most "you are the algorithm across all of human knowledge" feature,
finally cheap.

- [ ] **Doorway threads (the core, ships first + small).** On a Gallery card, one quiet cross-realm chip:
      **"The artist, in the Encyclopedia →"** / **"{Movement}, the idea →"** (resolve the AIC string to its
      Wikipedia page). On an Encyclopedia article about an artist/movement/place, **"See it in the Gallery →"**
      (AIC search on the title). **At most one** doorway alongside the in-realm threads so a session doesn't
      dissolve; clearly marked as a realm-crossing; the reason is **honest** — the shared entity, never invented
      (§2.1/§2.5). A door, never an auto-walk-through.
- [ ] **User idea 1 — horizontal swipe between realms + trails that span both.** Reframe realms from "pick one
      per session" to **one connected world you move through**: **horizontally swipe to switch the active realm
      at any time**, and let a **single trail contain cards from both realms** (start in either, cross via
      doorways *or* a swipe). This **reverses the locked "one trail = one realm" decision** — the trail's realm
      becomes **per-card** (cards already carry `source`; `Trail.realm` becomes a primary/derived hint), and the
      trail map + Atlas must render **mixed-realm edges and tints**. **Mobile-gesture caution (researched):**
      horizontal-swipe-vs-vertical-scroll is a well-known conflict; Drift already solved read-vs-advance in
      `src/lib/gesture.ts`, so add **axis-lock intent detection** (commit to the dominant axis from the initial
      drag angle) and keep **zoom in its own fullscreen mode** so three gesture axes never compete. Decide
      precisely what a horizontal swipe *means* (switch realm vs. follow the nearest doorway) before building.
- [ ] **User idea 2 — a living, sendable Atlas.** Make the Atlas *explorable and alive*, not static dots.
      **Tap a node → a calm detail card** (thumbnail, title, one-line, "Revisit" / "Drift from here") — a
      bottom-sheet on mobile, a popover on desktop. **Research caution:** star-map libs (d3-celestial) note that
      *gesture-zoom clashes with UI on mobile* → prefer **tap-to-select + tap-based zoom controls + a
      bottom-sheet**, not hover. Give it **art-piece quality** — realm-tinted nebulae/halos, constellation
      lines, gentle motion **only on interaction** (stay calm; no looping twinkle/autoplay — §2.2). Make it **the
      ultimate thing to share**: a beautiful **titled + dated PNG** now (reuse `export-image.ts`), and later a
      shareable Atlas snapshot to a friend's inbox (ties into the existing social layer). Fold in the Atlas
      fixes from the audit: **cross-realm edges/tints**, better clustering (today it collapses to one realm-blob
      for heavy single-realm users), node labels + an edge legend, filters (realm / time / liked), and honest
      handling of branches (history is a flat array today).
- [ ] **Test Phase 15:** doorways land somewhere genuinely related and say why; a trail can weave realms and its
      map/Atlas render the crossing; horizontal swipe switches realms without fighting read/advance/zoom;
      tapping an Atlas node opens its detail; export produces a shareable image. §2 intact throughout.

**Notes / dependencies:** independent of AI. Biggest of the three — it touches the **trail data model**
(per-card realm), the **gesture layer** (third axis), and the **Atlas**. Sequence it so the **doorway chip
ships first and small**; horizontal-swipe + trails-span-both is the structural change; the living-Atlas can be
built alongside or after. This **deliberately reverses the "one trail = one realm" decision** (a user call, in
the spirit of the earlier scope reopenings) — §2 stays non-negotiable.

---

## Phase 16 — Memory & Reflection: the thing a feed can't do  *(serves §9 #4 directly)*

**Goal:** Drift's actual experiment (§9 #4) is "did I learn things I remember two days later?" A feed can never
help with that; Drift can. These are the parked M20–M22 ideas — **none are social or a new realm**, the
smallest surface area of the three but the deepest differentiator. Sessions are already instrumented; most of
it just never comes back to the user (dwell is captured but unused; `readMores` is computed then dropped).

- [ ] **M22 — Keep a fact / keep a card.** A quiet "keep" of a card (or a highlighted sentence) to a personal
      shelf — the *generation effect*: the act of keeping is what makes it stick. Feeds the Atlas; synced via
      the `storage.ts` seam. No counts, no badges.
- [ ] **M20 — "Remember this?"** Gentle spaced resurfacing at a session *beginning* (a card from a past trail
      as an opener: "A while ago you wandered into X"). Reward + reinforcement at the entrance, calm and opt-in;
      pairs with the "session beginnings feel alive" grab-bag item.
- [ ] **M21 — "Shape of your week."** A descriptive, opt-in reflection (topics visited, longest wander,
      thread-vs-drift ratio, dwell) built from the session stats already stored — **never gamified, no streaks**
      (§2.4). Also: persist `readMores` into `SessionStats` (currently dropped) so it can be reflected back.

**Phase 16 exit:** Drift doesn't just help you wander — it helps you *keep* what you found and quietly remember
it later, which is the whole point of the experiment.

---

## Cross-cutting smaller polish (grab-bag — do anytime, not a phase)

- [x] **Mobile reading-scroll fix (2026-07-17):** the feed's advance gesture is now scroll-aware — the card
      text scrolls to read and only an *overscroll past the end* advances (back = overscroll past the top).
      On phones the **whole card scrolls** (image scrolls away) with threads pinned as a bottom bar; desktop
      keeps its split-panel. Chosen over a CSS scroll-snap rewrite (fragile nested-snap + iOS momentum bugs;
      fights Drift's generate-next-on-demand model). Pure decision logic in `src/lib/gesture.ts`
      (`edgesOf`/`resolveSwipe`/`isWheelReadingScroll`, 17 unit tests); scroll-aware `onWheel`/`onTouch*`
      handlers in `drift/page.tsx` (locate the region via `[data-drift-scroll]` + `overscroll-y-contain`);
      layout in `CardView.tsx`. **Verified:** 183 unit tests, build+lint clean, ad-hoc mobile(390px)+desktop
      Playwright E2E **16/16** — mid-content swipe scrolls without advancing, overscroll advances, back at
      top, desktop wheel/arrows — light+dark screenshots, zero console errors. _Real-device iOS pass still
      recommended (Chromium touch emulation ≠ Safari momentum/rubber-band/dynamic toolbar)._
- [x] **Session modes — Trail vs "Just drift" (2026-07-17):** a calm homepage toggle ("Keep a trail of this
      session", default ON, remembered in `settings.sessionMode` + synced). Trail mode is unchanged; **Just
      drift** (`?mode=endless`) strips the trail framing — no breadcrumb rail, the end action becomes a quiet
      optional **"Keep this trail"** escape hatch (opens the same save overlay), and the ~25-card nudge softens
      to a trail-free "a nice place to pause?" (→ Head home) — while keeping the gentle stops counter (§2.4) and
      individual card sharing. History still accrues in memory so the escape hatch can save it. Files:
      `src/app/page.tsx` (toggle + `?mode=`), `drift/page.tsx` (endless state + softened nudge), `FeedChrome.tsx`
      (rail/button), `storage.ts` (`sessionMode`). **Verified:** 183 unit tests, build+lint clean, ad-hoc
      Playwright E2E **16/16** (toggle default/persist/wiring; endless hides rail + shows "Keep this trail" +
      escape-hatch opens the save overlay; trail mode unchanged), zero console errors.
- [x] **Auth overhaul (2026-07-17):** Google + Apple OAuth (`signInWithProvider` → `signInWithOAuth`;
      buttons in `OAuthButtons.tsx`, shown only for providers in `NEXT_PUBLIC_OAUTH_PROVIDERS`, so no dead
      buttons — Apple built but not enabled yet); **email verification** UX (a "check your email" panel +
      resend, `emailRedirectTo` on sign-up); **password reset** (`requestPasswordReset` → `/account/reset`
      page → `updatePassword`) with a "Forgot your password?" link; **change password** on `/account`; client
      switched to `flowType:"pkce"` (client-side code exchange via `detectSessionInUrl`, no server route). Pure
      `parseOAuthProviders` (`src/lib/auth.ts`, +5 tests). Files: `AuthProvider.tsx`, `AuthForm.tsx`,
      `OAuthButtons.tsx`, `app/account/reset/page.tsx`, `app/account/page.tsx`, `supabase/client.ts`; docs
      (`deploy.md` Step 4, `backend.md` §7) + `.env.local.example` updated. **Verified:** 188 tests, build+lint
      clean, real-browser 8/8 configured (Google button → `/auth/v1/authorize`, forgot-password panel, sign-in,
      change-pw validation, reset page) + 6/6 ungated degradation, zero console errors. **Committed `2a17486`.**
      **OPEN:** email delivery — built-in sender is ~2/hr + template-locked on new free-tier, so Confirm-email
      is OFF; when the user sets up **custom SMTP (Resend) + a domain**, turn Confirm-email back on and deliver
      branded HTML templates for Confirm-signup + Reset-password (paste into Supabase → Email Templates, which
      unlock under custom SMTP). Apple: enable in Supabase + add `apple` to the env list when there's a paid
      Apple Developer account.
- [x] **Logged-out landing page (2026-07-17):** turned the minimal sign-in gate into a proper marketing/onboarding
      page for signed-out visitors of the hosted (cloud-configured) app. New `src/components/landing/`:
      `Landing.tsx` (composition: sticky bar, hero, sections, inline `#join` with `AuthForm`, footer + content
      credits), `ThreadDemo.tsx` (the interactive centerpiece — maps demo threads onto the real `Thread` shape so
      it reuses `<ThreadChips/>`; diagonal "pull" via the app's `cardVariants`+`spring`; growing breadcrumb;
      `useReducedMotion` fallback), `Reveal.tsx` (scroll-reveal, reduced-motion aware), `data.ts` (+`data.test.ts`,
      7 tests: a fully-connected demo card graph + `EXAMPLE_TRAIL` for the reused `<TrailMap/>`). `AuthGate.tsx`
      now returns `<Landing/>` in the configured+signed-out branch (loading + `user`→children branches unchanged →
      app still fully gated; no-cloud clone still ungated). `AuthForm` gained an optional `initialMode` (default
      `"signin"`; landing passes `"signup"`). Imagery = 8 CC0 AIC artworks in `public/landing/` (Hokusai, Hiroshige,
      Monet, Caillebotte, Van Gogh, Dürer), fetched via IIIF + optimized with `sips`; **no runtime fetch** (respects
      §2 + rate limits). Anti-slot-machine kept even in marketing: interaction-driven (no autoplay), honest copy.
      **Verified:** build+lint clean, **195 tests** (+7); ad-hoc Playwright signed-out **26/26** (renders, demo
      advance/drift/reset, CTA→join form scroll, create-account default, light+dark, mobile 0px overflow,
      reduced-motion, zero console errors), Gallery terracotta scope confirmed, blank-env degradation **6/6**.
      _Not exercised:_ a live sign-in (the `.env` `SUPABASE_EMAIL/PASSWORD` are stale — "Invalid login credentials"
      from a direct Supabase call, unrelated to this change; the `user`→app branch is byte-identical per git diff).
- [ ] **Replace the boilerplate `README.md`** — it's still stock `create-next-app`. It's the front door for
      any future contributor (or future you); it should say what Drift is, how to run it, and point at the
      spec/plan.
- [ ] **Empty/homogeneous threads** on narrow pages still fall back to "drift onward ↓" — fine, but Phase 6's
      classifier + Phase 7's embeddings both improve this; note the interaction.
- [ ] **Ambient reading polish:** a subtle reading-progress cue on long "read more", optional focus/full-bleed
      mode. Stay calm — no Ken Burns pans (that flirts with autoplay, §2.2).
- [ ] **Encyclopedia "quick facts"** (from the 2026-07-17 brainstorm, "richer reading" direction): surface a
      few structured Wikipedia facts (dates / taxonomy / coordinates via the Action API or Wikidata) as a small
      calm strip on the card, so an Encyclopedia card shows more than a one-line description. Cheap richness;
      factual only (§2.5). Not a full phase — a polish item.
- [ ] **Session "beginning" variety:** rotate the homepage seeds / add a "pick up where curiosity left off"
      entry, so the *beginning* feels alive (pairs with Phase 8 M20 and the Today realm).

---

## Out of scope for v1 (do not build unless asked)

Accounts / social / comments, mobile packaging, non-Wikipedia sources, and all
`drift-spec.md §12` parking-lot ideas. **Exception:** the spec's blanket ban on
"recommendation/personalization models" is deliberately relaxed for **Phase 4 M9** — but *only*
as the transparent, drift-only, user-controlled interest model specified there. Any opaque or
thread-affecting personalization remains out of scope.

> **Amendment (2026-07-14):** this list governed **v1** (Phases 1–4). The 🌱 **IDEA PHASES** above
> propose a **v2** that deliberately reopens two lines — **non-Wikipedia sources** (Phase 5, as vetted
> open-access realms) and a little more **algorithm** (Phases 6–7, still transparent + user-steered) —
> plus several §12 parking-lot ideas (Phase 8). None are committed; they become in-scope only when the
> user picks one up. The anti-slot-machine principles (§2) remain non-negotiable for all of them.

> **Amendment (2026-07-16):** Phase 13 (Go Live) makes **accounts required in the deployed/multi-user
> context** — i.e. *only when the cloud is configured*. This reverses the earlier "accounts are additive,
> never a gate" stance **for the hosted app** (a deliberate user decision, in the same spirit as Phases 9–12
> reopening the spec's "no accounts" line). A no-env local clone stays ungated and fully local (§4 intact),
> and §2 is untouched. A future demo/anonymous mode may soften the gate later.
