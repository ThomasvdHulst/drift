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
> 🌱 **Proposed next (2026-07-14):** four **IDEA PHASES** (5–8) are drafted below the committed phases for
> review — Realms/tabs (non-Wikipedia sources), Threads With Intention, Cross-Realm "Constellations", and a
> deepened Reward. Not started; a menu to pick from. Phase 3 (AI/Ollama) stays deferred but is reframed as
> the enabler of Phase 7.
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

### M10 — The source abstraction *(foundational refactor — do this first; no user-visible change)*
The current `Card` is Wikipedia-shaped: `pageTitle` doubles as the unique id and is the key for the seen-set,
the thread cache, reactions, and buffer dedup. Multi-source needs a source-namespaced identity **without
breaking saved trails** (which embed full `Card`s) or existing seen/reaction data.
- [ ] Extend `Card` with `source: SourceId` (`"wikipedia" | "artic" | ...`). **Treat a missing `source` as
      `"wikipedia"`** so every pre-Phase-5 saved trail, seen title, and reaction still resolves. Add a
      stable `cardId` = `` `${source}:${nativeId}` `` helper (pure, `src/lib/card.ts`); migrate the seen-set,
      `threadCache`, `reactions`, and buffer dedup to key on `cardId` (bare-title keys read as `wikipedia:`).
- [ ] Define a `Realm` adapter interface (`src/lib/realms/types.ts`): `discover(topic?, offset?) → Card[]`,
      `related(card) → RelatedCandidate[]`, `summary(id) → Card`, `extended(id) → {extract, hasMore}`,
      plus realm metadata (`id`, `label`, `glyph`, seeds, topic taxonomy). **Refactor the existing
      Wikipedia code into the first adapter** (`realms/wikipedia.ts`) behind this interface — the API routes
      become thin dispatchers (`/api/realm/[realm]/discover`, `.../related`, ...). Keep every current route
      working (alias or delegate) so nothing regresses.
- [ ] Unit-test `cardId` round-tripping + the missing-source→wikipedia back-compat path. Existing 100 tests
      stay green (this is a pure refactor).
- [ ] **Test M10:** build + lint + tests green; the Encyclopedia realm behaves *identically* to today
      (real-browser: seed, drift, threads, react, save, continue, export all unchanged); a saved pre-refactor
      trail still opens and continues. Zero behavioural change is the pass condition.

### M11 — The Gallery realm *(Art Institute of Chicago)*
- [ ] `realms/artic.ts` implementing the adapter: `discover` = public-domain artworks by a browse facet
      (department / style / place) with a random offset (mirror the `articletopic:` + offset trick that made
      drift "interesting, not obscure"); `related` = same-artist ∪ same-classification ∪ shared subject term,
      diversified with the **existing `selectDiverseThreads` heuristic** (reuse, don't reinvent). Server-side
      junk filter (no image, no title). IIIF thumbnail URL builder. `AIC-User-Agent` header via the
      `wiki-server.ts` request-spacing/retry gate pattern (generalize it to a shared `upstream.ts`).
- [ ] Map art metadata onto `Card`: `displayTitle` = work title; `description` = "{artist}, {date}";
      `extract` = medium + place + a sentence of provenance/blurb if present; `sourceUrl` = the artic.edu page.
      Threads carry evocative labels ("More by Hokusai", "Other woodblock prints", "Also from Edo Japan").
- [ ] Gallery seeds (`src/data/seeds.artic.json`): ~10 tiles (Impressionism, Japanese prints, Ancient
      Mediterranean, Modern, Portraits, Still life, Textiles, Landscapes…). Graceful empties everywhere.
- [ ] **Test M11:** build + lint + tests green (new pure bits — IIIF URL builder, art→Card mapper — unit
      tested); real-browser: a Gallery session shows real public-domain images, pulling "more by this artist"
      actually stays with the artist, drifting stays varied-but-interesting, a mixed trail (art stops) saves +
      exports as a PNG with images (CORS/IIIF must allow canvas — verify, like Wikimedia thumbnails do).

### M12 — Realm switcher (the "tabs") + homepage
- [ ] Homepage becomes realm-aware: a quiet tab/segmented control (*Encyclopedia · Gallery · …*), each with
      its own seed grid + "Surprise me". Calm, no badges (§6). Persist last-used realm in `settings`.
- [ ] `/drift` reads a `realm` param; the feed's discover/related/threads route through that realm's adapter.
      The mode chip + trail map already show "how you travelled" — extend the language so a **realm switch
      mid-trail is legible** (e.g. a stop's node hints which realm it came from). Decide the default drift
      policy: stay in-realm (simple, ship this) vs. mix realms (that's Phase 7's cross-realm magic — keep it
      out of scope here).
- [ ] **Test M12:** build + lint + tests; real-browser: switch to Gallery from the homepage, drift a full
      session, switch back, saved trails from both realms coexist in My Trails and render correctly. No
      console errors; principles §2 intact (still 1-ahead prefetch, still transparent, still no autoplay).

### M13 — (Optional) a second content realm
- [ ] Pick one from the fit ranking above — **Library (Gutendex)** is the natural second (a different
      *kind* of knowing: books, authors, ideas over time) and is a clean adapter with an opening-passage read.
      *Or* ship **Today** as a front-door instead (see Phase 8). Reuse the M10 adapter interface wholesale.
- [ ] **Test M13:** as above, per realm.

**Phase 5 exit:** Drift has tabs. You can spend a session wandering the world's public-domain art or a
library of great books with the exact same pull-a-thread-see-your-trail loop — and every realm degrades
gracefully when its source is slow or down.

---

## Phase 6 — Threads With Intention  *(make the core mechanic legible — cheapest "more Drift" win)*

**Goal:** Today the 3 thread chips are all the *same flavour* — "here are 3 related pages." That's a menu,
not steering. Drift's whole soul (§1, "you are the algorithm") is **direction**. Give each thread a
*character* so pulling one feels like a deliberate move, and the user can *see where it leads*:
- **↧ Go deeper** — a more specific / narrower facet of this subject.
- **↥ Zoom out** — the broader context this sits inside.
- **↔ Tangent** — a surprising lateral leap (the delightful non-obvious neighbour).

This is pure product craft, needs **no new API and no AI**, fits the existing `src/lib/*` pure-logic pattern,
and makes agency *felt*. It also plays perfectly with the trail map (edges could carry the direction glyph,
so a saved trail reads like a route: "deeper, deeper, tangent, out…").

- [ ] `src/lib/threads.ts` (pure, unit-tested): classify the ~20 `morelike` candidates into
      deeper / broader / tangent using cheap, transparent signals — title containment ("X" ⊂ "X (specific)"),
      description-class overlap vs. divergence (reuse `classOf` from `diversity.ts`), and `morelike` rank
      position (top = closest ⇒ deeper/adjacent; mid-tail = tangent). Return exactly one of each when
      possible, else fall back to today's diverse-3. **Never fabricate** a relationship it can't justify —
      if it can't tell, it's an unlabelled "related" chip (honesty > cleverness, §2.1).
- [ ] `ThreadChips.tsx`: give each chip its direction glyph + a one-word kind, keep the sage calm. The
      thread-follow transition can lean into the direction (deeper = pull *down/in*, out = pull *up/back*,
      tangent = the current sideways pull) — distinct, physical, still not a casino.
- [ ] Trail map + `ArrivedVia` thread edges optionally carry the direction, so the map narrates the *shape*
      of the rabbit hole. Back-compatible (older trails just omit it).
- [ ] **Test M14:** build + lint + tests (the classifier is the star — many unit cases: containment,
      class overlap, rank tiers, degenerate/narrow topics falling back cleanly); real-browser: on a broad
      page (e.g. *Octopus*) the three chips genuinely differ in character and each lands where its label
      promised; on a narrow page it degrades to plain related chips without lying. Principles §2 intact.

**Phase 6 exit:** pulling a thread feels like *choosing a direction*, not picking from a list — and the
trail map reads back the journey's shape. (Forward tie-in: Phase 7's embeddings/LLM can sharpen the
classifier and write more evocative labels, but the heuristic ships first and always works.)

---

## Phase 7 — Cross-Realm Threads: "Constellations"  *(the magic — DEPENDS on an embedding layer)*

> ⚠️ **Depends on the embedding layer from the deferred Phase 3** (local `nomic-embed-text` via Ollama).
> Do Phase 3 first, or build its minimal subset (embed endpoint + cosine + max-min) as M16 here. Also
> assumes **Phase 5** (realms exist to thread *between*). This is the most ambitious idea and the most
> "Drift" — hold it until the foundations are in.

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

## Phase 8 — The Reward, Deepened  *(dopamine at the exit + learning that sticks — serves success #3 & #4)*

**Goal:** today the reward is the per-session trail map — lovely, but it evaporates after "Save". The
experiment's real questions are "does the trail map feel like a reward?" and "**did I learn things I remember
two days later?**" (§9 #3, #4). This phase makes the reward *accumulate* and gently helps memory stick —
all in the anti-slot-machine register (reward at the exit, gentle awareness, never streaks/guilt).

- [ ] **M19 — The Atlas** (`/atlas`): a single, growing constellation built from *all* saved trails — nodes
      you've visited, clustered by topic (the M9 interest topics are ready-made clusters), edges where you
      threaded between them. The meta-reward: "here is the shape of my curiosity." Pure layout logic in
      `src/lib/atlas.ts` (unit-tested), SVG paint like `TrailMap`. Read-only, calm, zoomable. Export as PNG.
- [ ] **M20 — "Remember this?"** (spec §12 spaced resurfacing): occasionally — *only at a natural session
      beginning*, never mid-drift, never as a notification — offer to reopen a card from a past trail you
      haven't seen in a few days. Directly targets success-criterion #4. Fully optional, dismissible, quiet.
- [ ] **M21 — Weekly reflection** (spec §12 + §9): a gentle, opt-in "this week" panel on `/trails` or
      `/atlas` — "5 drifts · 3 realms · a few things worth remembering: {a}, {b}, {c}." **Descriptive, not
      gamified** — no streaks, no goals, no "you're falling behind." Built only on the per-session stats we
      already record. If it starts to feel like a metric to chase, cut it (§9).
- [ ] **M22 — Keep a fact** (marginalia): a quiet "keep" on a card (or a highlighted sentence) that saves it
      to a personal "kept" shelf *without* needing to save the whole trail — so a single gem isn't lost.
      Feeds the Atlas and the weekly reflection. Storage via a new `kept` key in `storage.ts`.
- [ ] **Test Phase 8:** each milestone real-browser verified — Atlas renders from multiple saved trails and
      grows as you add more; "Remember this?" surfaces only at a beginning and only for aged cards; the
      weekly panel reads as calm reflection, not a scoreboard; a kept fact persists and appears on the shelf.
      Principles §2 hold — especially §2.3 (reward at the exit) and §2.4 (gentle, no guilt).

**Phase 8 exit:** the reward compounds — every session adds to a personal atlas of what you've wondered
about, and the app quietly helps you *remember* it. That's the difference between "I scrolled" and "I learned."

---

## Cross-cutting smaller polish (grab-bag — do anytime, not a phase)

- [ ] **Replace the boilerplate `README.md`** — it's still stock `create-next-app`. It's the front door for
      any future contributor (or future you); it should say what Drift is, how to run it, and point at the
      spec/plan.
- [ ] **Empty/homogeneous threads** on narrow pages still fall back to "drift onward ↓" — fine, but Phase 6's
      classifier + Phase 7's embeddings both improve this; note the interaction.
- [ ] **Ambient reading polish:** a subtle reading-progress cue on long "read more", optional focus/full-bleed
      mode. Stay calm — no Ken Burns pans (that flirts with autoplay, §2.2).
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
