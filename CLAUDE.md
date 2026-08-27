# CLAUDE.md — Drift

Guidance for Claude Code (and every future session) working in this repository. Read this
first, every session. The full product spec lives in `drift-spec.md`; the living
implementation plan and progress tracker lives in `plan.md`.

---

## 1. What we're building

**Drift** is a local-first web app for "healthy scrolling" — an antidote to doomscroll slot
machines like TikTok/Instagram. It's a feed of full-screen "knowledge cards" where **the
user is the algorithm**: every card exposes visible "threads" (related directions) you can
pull to steer your own rabbit hole. Sessions have a beginning (a topic seed), a middle (the
trail), and an end (a shareable **trail map** of where your curiosity wandered).

Cards come from **realms** (`src/lib/realms/`): **Encyclopedia** (Wikipedia), **Gallery**
(The Met's CC0 Open Access collection), and **Papers** (arXiv, built but switched off behind
`NEXT_PUBLIC_REALM_PAPERS`).

⚠️ **THIS SECTION USED TO SAY "a hobby project for personal use — no accounts, no database,
no deployment, no social features", AND EVERY CLAUSE OF THAT IS NOW FALSE.** It is recorded
here rather than quietly deleted because it is the kind of stale line that silently
mis-briefs a whole session: it is the first thing anyone reads, and §8.5 used to repeat it as
an instruction. What is actually true today:

- **Accounts exist and the hosted app is gated behind one** (Phase 13, `AuthGate`).
- **There is a database.** Supabase Postgres, optional, with the schema and RLS in
  `supabase/migrations/`. IndexedDB is still the source of truth for a session and the app
  stays fully usable signed-out or unconfigured; the cloud syncs, it does not own.
- **It is deployed**, at `usedrift.org` on Vercel, and read by real people.
- **There are social features** (profiles, friends, sharing) and **public share links**
  (`/s/<token>`), the latter of which makes Drift an "online platform" under the DSA. See
  `supabase/migrations/0004_public_shares.sql`.
- **It takes money.** A one-time €7 supporter unlock through Stripe, with a daily reading
  meter, a refund path and a cooldown (Phases 32/32B).

`npm run dev` at `localhost:3000` still runs the whole thing locally with no configuration
at all, and that must stay true (§4, graceful degradation).

## 2. The anti-slot-machine principles (hard product constraints, not nice-to-haves)

These are *why the app exists*. Never violate them, even when a change would be easier
without them:

1. **Transparency over opacity** — the user always sees *why* the next card appeared (the
   thread they chose, or "drift" if random). No hidden ranking.
2. **Agency over autoplay** — nothing advances automatically. No autoplay, no infinite
   preloading that teases "just one more." Prefetch **at most 1 card ahead**.
   ⚠️ *That rule is about what is RENDERED, not about how many upstream calls a request
   makes.* The discover and random routes deliberately fetch a BATCH of ~20 cards' worth of
   metadata at a time (`/api/wiki/random`, `lib/discover.ts`) because `generator=random` is
   Wikimedia's burst-limited endpoint and one-card-at-a-time cost 2-3 requests per drift. No
   card is ever rendered or teased ahead of the one you are on, which is the thing the
   principle protects. Do not "fix" the batching to satisfy a literal reading, and do not use
   it as licence to render ahead.
3. **Sessions have shape** — beginning (seed) → middle (trail) → end (trail map). The
   reward (the trail map) is placed at the *exit*, not the next swipe.
4. **Gentle awareness, not guilt** — a quiet "N stops" counter; after ~25 cards a soft,
   dismissible nudge. No red badges, no streaks, no notification patterns.
5. **Content is vetted, AI only reshapes** — all content originates from openly-licensed,
   human-curated sources (Wikipedia/Wikimedia, and The Metropolitan Museum of Art's CC0 Open
   Access collection). AI may summarize, label, and curate; it must **never invent facts**.
   ⚠️ **A THIRD SOURCE IS BUILT AND SWITCHED OFF, AND TURNING IT ON IS NOT A ONE-LINER.**
   The Papers realm reads **arXiv** and is gated behind `NEXT_PUBLIC_REALM_PAPERS`, which is
   `0`. Nothing is wrong while it stays `0`, but arXiv appears in **none** of the four places
   that have to name a source: `/sources`, `/privacy`, `/colophon`, and
   `docs/processing-record.md`. Flipping the flag without updating all four makes two
   published legal documents wrong at once. The licence *position* is already decided and is
   fine: arXiv per-paper licences vary, so `lib/licenses.ts` deliberately makes **no** licence
   claim for that source (`licenceFor` returns null) and the card shows a plain "arXiv"
   credit. It is the four documents that are missing, not the thinking. Update them **first**,
   then flip the flag.

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
- **AI layer: NOT BUILT.** Phase 3 (local Ollama at `http://localhost:11434`, feature-flagged
  thread selection and labelling) is **deferred by choice** and no code implements it — there is
  no `/api/threads`, no Ollama client, and nothing reads `AI_THREADS` / `AI_REWRITE` /
  `OLLAMA_MODEL`. `plan.md` has always recorded it as deferred; this file used to describe it in
  the present tense, which read as shipped surface area and sent a reviewer hunting for a
  subsystem that does not exist. The design notes for it are kept in §4 and Phase 3 of `plan.md`
  for whenever it is picked up.

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
- 📰 **"What's current" comes from Wikipedia, not a news API** (Phase 23). `Portal:Current events`
  has one page per day (`Portal:Current events/2026 July 22` — **no zero padding**) whose wikitext is
  `'''Section'''` headings over nested `*` bullets of `[[wikilinks]]`. **30 day-pages fetch in ONE
  Action API call** (`action=query&prop=revisions&rvprop=content&rvslots=main&titles=A|B|…`, 50-title
  limit). Ten stable sections; ~2,300 unique articles per 30 days. This is why Drift can have a
  "current" feed with **zero new licensing exposure**: it is the same CC BY-SA corpus, we read only
  the link targets, and no headline or publisher content is ever stored or shown. Do NOT replace this
  with a news API — see `memory/content-licensing-realms.md` for why that path was parked.
  Parsing/ranking lives in `src/lib/current.ts`; when fetching card props for a title list, pass
  **`exlimit=max`** or only the first page gets an extract.
- 🔗 **A thread carries the sentence it is linked in ("the bridge", Phase 28).** `morelike:` says
  two pages are similar but not *why*, so `/api/realm/encyclopedia/related` also fetches the current
  article's **lead** (`action=parse&section=0`) and attaches the sentence in which the lead links
  each candidate. That is **one extra Wikimedia call per card**, deliberately made with a 2.5s
  timeout and **`retries: 0`**: a bridge is a bonus, and an optional thing must never delay threads
  or spend the shared rate budget. Rules live in `src/lib/bridge.ts` and are not negotiable — whole
  sentences only (never truncated), 40 to 200 characters, one quote per card. About 42% of chips
  carry one; a lead-poor article simply shows the plain chips it always did.
- 🖼️ **The Gallery reads from The MET, not the Art Institute (Phase 31).** `www.artic.edu` went
  behind a blanket Cloudflare block in Dec 2025 and returns **403 to everyone** — real Chrome, our
  Vercel origin, even `/robots.txt`. Their JSON API (`api.artic.edu`) still works, which is why the
  symptom was "cards but no pictures". Do NOT try to revive it; it is not our IP and not fixable in
  our code ([their issue #151](https://github.com/art-institute-of-chicago/data-aggregator/issues/151)).
  The Met's API (`collectionapi.metmuseum.org`, no key) differs in four ways that shape the adapter:
  - **Search returns object IDs only**, and the WHOLE array at once (no offset/limit). So a batch is
    `1 search + N record fetches`. Both are cached in-process (`bucketIds`, `objectCache`) and at the
    edge; the full pool is actually a better fit for `discover(offset)` than pagination was.
  - **Their edge throttles with `403`, not `429`, and sends no `Retry-After`.** Hence
    `retryOn: [403]` (an opt-in on `fetchJson` — never make that global, the Art Institute's 403 is
    permanent) and a `makeGate(50)`. **Docs claim 80 req/SECOND; measured, it is ~80 requests per
    ~30 SECONDS** (403 after 83 requests at 20/s; recovers after ~31s of quiet). Repeated tripping
    shrinks the budget hard — down to 6 requests after a day of heavy use. Trust the edge, not the
    docs.
  - **Budget the request COST of a feature, because ids-only search makes it high.** Measured per
    action: a cold room is **21** requests (1 search + ~20 record fetches), one card's threads **8**,
    a discover batch of 4 is **5**. So "start a new drift" is ~30 and two in a row approach the
    ceiling. The knobs are `OVERFETCH_BAKED`/`OVERFETCH_LIVE` and the
    `FACETS_SHOWN`/`PER_FACET`/`FETCH_PER_FACET` constants in `metRelated` — the client only ever
    shows ONE candidate per facet, capped at three (`selectFacetThreads`), so fetching more than a
    spare each is pure waste.
  - ⚠️ **THE BIGGEST CONSUMER OF THE MUSEUM IS THE ENCYCLOPEDIA, NOT THE GALLERY.** `/api/doorway`
    fires on EVERY card in BOTH realms (`drift/page.tsx:941`), and from an Encyclopedia card it
    searches The Met for the article title. In a 25-reader load rehearsal that was **491 of 494
    cards and 92.6% of all Met traffic**; nineteen Encyclopedia readers cost the museum twelve times
    what six Gallery readers did. Do not reason about Gallery load without counting the doorway.
    Measure with `NODE_OPTIONS="--import ./scripts/bots/upstream-count.mjs"` rather than guessing —
    the cost is all fan-out and invisible in the code.
  - ⚠️ **Their search ORs the words together, and it accepts PHRASE QUOTES — but ONLY the doorway
    may use them.** Unquoted, `q=Powers of the president of the United States` returns **55,804**
    results; quoted it returns **0**. The doorway's gate (`passesReverseGate`) wants the term as a
    SUBSTRING of the artwork's title or tags, so every one of those 55,804 was going to be rejected
    after five record fetches. `phraseQuery` (`lib/realms/met.ts`) is therefore used by `metTopMatch`
    and **nowhere else**. It was briefly applied to `metRelated`'s three facet searches too and that
    silently deleted thread chips: a facet search costs one request whatever it returns and only the
    first three ids are ever fetched, so quoting saves nothing there and sometimes returns nothing at
    all. Measured live, twice (27 Aug): `artistOrCulture q=Winslow Homer` → **13** works,
    `q="Winslow Homer"` → **0**; and it moves the other way just as arbitrarily (Hokusai 10 → 427).
    Their quoting is not a phrase operator in any consistent sense — use it only where it is measured
    to pay. **Never quote `q: "*"`** — the place facet needs the wildcard.
  - **A refusal must not be retried into the ground.** `retryOn: [403]` with two retries makes every
    403 cost three requests exactly when the museum is telling us to stop, which is how a rehearsal
    turned ~3,181 requests into 1,470 refusals and left the budget shrunk all day. Met calls now use
    **one** retry, not two: the 300 ms backoff is nowhere near the ~31s their bucket needs, so a
    second attempt almost never succeeds and costs a third of everything spent while throttled.
    `metBreaker` (`makeBreaker` in `lib/upstream.ts`, opt-in per source, wired ONLY to the Met —
    never Wikimedia) opens after 5 consecutive refusals and makes no request for 35s. While open a
    cold instance serves a Gallery room zero cards and the feed falls back to a thread neighbour; the
    baked pools do NOT cover this, because they supply ids and the records still have to be fetched.
  - ⚠️ **A BREAKER THAT IS NEVER TOLD HOW A PROBE WENT WILL WEDGE OPEN.** The half-open probe used to
    be a sticky `probing` flag that only `record()` could clear, and `record()` ran only when a
    RESPONSE came back — so a probe whose fetch *threw* (timeout, reset, DNS) left the circuit shut
    for the life of the process. The symptom is unmistakable and was reported as "the Gallery died
    and stayed dead": `[met] search skipped: circuit open` repeating, every discover answering in
    3-8 ms with no upstream request behind it, long after the cooldown. Two things keep it fixed and
    both must stay: the probe holds a **time-boxed slot**, and `fetchUpstream` **reports a thrown
    fetch to the breaker**.
  - ⚠️ **NEVER CACHE AN EMPTY ANSWER AT THE EDGE.** `/api/realm/[realm]/related` sent
    `s-maxage=86400` on whatever came back, so a card whose threads were empty because the museum was
    throttling — or because the breaker was open and we deliberately made no request — had "this card
    has no threads" frozen into the CDN **for a day**, for every reader, with nothing in the app that
    would re-ask. Discover has guarded against this since Phase 31; related and the Gallery half of
    the doorway did not. The rule applies to every route that answers from an upstream: a real answer
    caches, an empty one gets NO_STORE. Where a caller's answer is cached for a day it must be able
    to tell "we looked and there is nothing" from "we could not look" — that is what
    `searchIds({rethrow})`, `fetchObject({rethrow})` and `UpstreamError.status` are for (a 404 is a
    settled answer; a 403 is not).
  - **The gate carries a rolling BUDGET, not just spacing** (`makeGate(50, { burst: 30, windowMs:
    15_000, maxWaitMs: 5_000 })`). Spacing alone cannot express a bucket: at 20 req/s one reader
    opening the Gallery spent ~30 requests in two seconds and the next drift was refused. A refusal
    is strictly worse than a wait, so the gate waits at the edge of the budget instead — but only up
    to `maxWaitMs`, because the feed aborts a discover batch after 6s and holding one longer would
    spend the museum's budget on a batch nobody receives. Past that it throws `GateBudgetError` and
    makes no request. Measured after (local `next start`, upstream counter): a 12-card Gallery
    session is **96 Met requests in 57s with zero 403s, zero breaker trips, threads on every card**.
  - ⚠️ **`searchIds` rethrowing and the doorway's cache lifetime are ONE decision.** The doorway
    route caches "no doorway" for a **day**, which is only honest because `searchIds({rethrow:true})`
    makes a throttled search an error rather than an empty result. Lengthen one without the other
    and a busy second freezes "nothing here" onto a card until tomorrow. Every other `searchIds`
    caller keeps the forgiving `[]`.
  - **In production the CDN absorbs nearly all of this and in dev NOTHING does.** discover/related/
    summary all carry `s-maxage=86400`; verified on the live site (`x-vercel-cache: MISS` then
    `HIT`). So local development hits the limit far more readily than the deployed app ever will,
    and a throttle while developing is not a signal about production.
  - **No aggregations and no style/movement field.** The artist-drift rings, the form/era picker and
    the relevance-scored Encyclopedia→Gallery doorway were all built on those and are deferred to
    Phase B. Do not fake a movement from subject tags.
  - **No descriptive prose, no alt text, no blur placeholder.** `extract` is the catalogue line;
    `imageAlt` is composed from the record (`metImageAlt`) and invents nothing. "Read more" is
    therefore GATED on `Card.hasBody` and, where the museum gives an exact `artistWikidata_URL`,
    filled with that artist's Wikipedia lead — a different work under a different licence, so it
    carries its own heading and its own CC BY-SA credit, never the card's CC0 line.
  - ⚠️ **Their search is parameter-ORDER sensitive and fails SILENTLY.** `q` must come LAST or the
    other filters are ignored: `medium=Prints&dateBegin=1600&dateEnd=1800&q=*` returns **16,405**,
    the identical query with `q` moved earlier returns **1**. Nothing documents this. `searchIds`
    in `server/met.ts` enforces the ordering centrally so no caller can get it wrong.
  - ⚠️ **The Met has NOT released its Impressionists.** Every Monet is catalogued but
    `isPublicDomain: false` with no image, so an artist search for Monet correctly returns nothing.
    The Art Institute was strong exactly there. Not a bug; do not "fix" it.
  - **Room pools and form/period counts are BAKED** into `src/lib/realms/met.pools.json` by
    `scripts/probe-met-pools.mjs` (hand-run, merges the two passes). That is what keeps a room
    readable while the museum is throttling us. The EU copyright test is deliberately NOT baked: it
    is recomputed per request because the cut-off widens every 1 January.
- 🎨 **Artwork is served through `/api/img/met/{dept}/{name}/{width}`** (sharp resize), and there
  is deliberately no flag to disable it. ⚠️ **`width` is an ALLOWLIST of exactly `160 | 843 | 1686`**
  (`MET_IMAGE_WIDTHS`, `lib/realms/met.ts`), not a range. It accepted any integer 16-1686 until
  2026-08-27, which is ~1,286 CDN cache keys **per artwork**, each its own multi-megabyte original
  fetch, reachable by anyone — measured live, widths 701/703/707 each answered `x-vercel-cache: MISS`
  with a separate upstream fetch. Add a width to that constant, never to the route. One thing is NOT
  proxied and that is deliberate: `previewUrl` (the ~600px `web-large` placeholder, `metPreviewUrl`)
  is **hotlinked**, so it appears instantly and costs us no bandwidth. It is a plain decorative
  `<img>` with no `crossOrigin`. That hotlink is why `/privacy` must name the museum as well as
  Wikimedia — the reader's browser reaches it directly. ⚠️ **That route has THREE protections you must not
  strip, all added after it 502'd for twenty seconds at a time (2026-08-26):** its own gate and
  breaker on `images.metmuseum.org` (a *different* host from the API, and its failure mode is
  slowness, not 403, so a timeout counts against the breaker); an explicit `maxDuration = 25` with
  fetch timeouts sized to fit inside it (there was none, so Vercel's 10s/15s default killed the
  function before its own 20s timeout could answer); and a **fallback to `web-large` when the
  original will not come**, served with a SHORT cache so a soft picture cannot freeze into the CDN
  for thirty days. Measured on the same artwork: 502 after 20s became 200 with a real image in 10s.
  Also: **a request at or below 400px never touches the original at all.** The trail map asks for
  160 and was pulling a ~3.4 MB original per node to make a thumbnail; it is now 8 KB in 0.5s. The
  structural reason the proxy exists: the Met publishes only fixed sizes (largest "small" ≈600px, too
  soft for a card; next is a ~4000px/8MB original), so arbitrary widths have to be made somewhere.
  ⚠️ **There used to be a second reason here — "it sends no CORS header, which breaks the trail map's
  `crossOrigin="anonymous"` thumbnails" — and it has EXPIRED.** Re-measured 2026-08-27 four ways
  (`web-large` and `original`, with and without an `Origin` header): `images.metmuseum.org` returns
  `access-control-allow-origin: *` every time. The old measurement was right when taken. Do not quote
  the CORS argument; the size argument carries the decision alone.
  The URL is rebuilt from two anchored components, never taken from upstream. Note the PNG export
  drops images entirely by design (`export-image.ts`, audit B-5) — that is NOT a reason for the proxy.
- **Always proxy external calls through Next.js API routes** (`/api/wiki/*`, `/api/realm/*`),
  never call Wikipedia directly from the browser. Reasons: (a) browsers cannot set
  the `Api-User-Agent`/`User-Agent` header Wikimedia etiquette requires; (b) it centralizes
  junk-filtering and the dead-endpoint workaround; (c) it keeps all AI logic server-side and
  dodges `localhost:11434` CORS.
- **Set a descriptive `Api-User-Agent` header** on every Wikimedia request (e.g.
  `Drift/0.1 (local hobby project; contact: <email>)`).
- **For the deferred Phase 3 only** (nothing below is wired up today — see §3): Ollama is
  installed and running locally with the needed models: `qwen2.5:14b`
  (LLM default), `gemma3:27b` (optional quality mode), `nomic-embed-text` (768-dim
  embeddings). Chat: `POST /api/chat` with `format:"json"` + `keep_alive:"30m"`.
  Embeddings: `POST /api/embed` → `{ embeddings: [[...768]] }`.
- **When the AI layer is built, it must never break the app.** Ollama unreachable / timeout
  (>6s) / malformed JSON → silently fall back to embedding-only diversity, then to the plain
  heuristic. The app must work fully with Ollama off. (Stated as a standing design constraint
  for Phase 3; there is no AI layer to break today.)
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
npm run audit:contrast  # WCAG 2.2 AA contrast sweep of the RUNNING app (see §10)

# Load rehearsal — simulated readers against a local production rig (see §11)
npm run bots:seed -- --count 25   # burner accounts + supporter unlock (idempotent)
npm run bots:run  -- --bots 25 --minutes 20
npm run bots:teardown             # delete every load_bot account
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

⚠️ **NEVER RUN `next build` IN A DIRECTORY A LIVE `next start` IS SERVING FROM, and be careful
with the scratch dir above, which is exactly where this happens.** The rebuild overwrites the
`.next` the running server is still reading, and the result is far nastier than a crash: the
server keeps answering **HTTP 200** with server-rendered HTML, while its CSS and JS chunks now
point at content-hashed filenames that no longer exist. Pages look *almost* right and behave
subtly wrong. Measured symptoms from one such instance: `ChunkLoadError` in the console on some
routes, and `npm run audit:contrast` reporting **19 dark-mode contrast failures on `/`** that a
clean build of the identical commit does not reproduce (the topic tiles lost the rule that picks
their dark face, so it measured near-white on near-white). Both were chased as product bugs
before the rig was suspected. **If a measurement disagrees with what a browser shows you, kill
the server, delete `.next`, rebuild, and re-measure before believing it.** Two independent
measurements agreeing against a third is a signal about the third.

⚠️ Related: **several `next start` processes may share one build directory happily, but only if
nothing rebuilds it while they run.** That is why §11's load rig builds once and then starts K
instances, and why it never builds again mid-run.

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
3. **Graceful degradation is mandatory** — anything touching Ollama must fall back cleanly
   (see §4). Never let an optional dependency being down break the core loop.
4. **Match the existing code style and structure.** Read neighboring files before adding
   new ones. Keep pure logic (filtering, diversity selection, drift weighting, naming) in
   `src/lib/*` as small, unit-testable functions — that's where bugs hide.
5. **Stay in scope.** Work the current phase in `plan.md`. Do not add content sources,
   dependencies, third-party services, metrics or `drift-spec.md` §12 "parking lot" ideas
   unless explicitly asked. Engagement-maximizing metrics are never in scope.
   ⚠️ This rule used to read "Do not add accounts, databases, non-Wikipedia sources", which
   stopped being true once Phases 9, 13, 31 and 32 shipped exactly those. Read literally it
   told a session that load-bearing, already-shipped subsystems were out of bounds. Scope is
   defined by `plan.md`'s current phase, not by that list.
6. **Ask before destructive or irreversible actions.** Don't `git init`/commit/push unless
   the user asks. Don't delete or overwrite files you didn't create without flagging it.
7. **Prefer plan mode for non-trivial work.** For a new phase or a meaningfully complex
   step, enter plan mode and get sign-off before writing code.
8. **Keep secrets/config in `.env.local`** (git-ignored). Provide a committed
   `.env.local.example`. (The `AI_THREADS` / `AI_REWRITE` / `OLLAMA_MODEL` flags belong to the
   deferred Phase 3 and are read by nothing today — see §3.)

## 9. Success criteria for the experiment (the actual point)

The app exists to answer, after a week of personal use: Do I reach for Drift instead of
Instagram/YouTube? Does pulling threads feel better than being fed? Do sessions end
naturally and does the trail map feel like a reward? Did I learn things I remember two days
later? Instrument lightly (per-session stats in IndexedDB) to support this — never build
engagement-maximizing metrics.

## 10. Colour contrast — the rules the palette must keep (2026-07-28)

Drift conforms to **WCAG 2.2 Level AA**. Every colour decision has to keep it there, so
before changing a token, a tint, or a text opacity, know these:

- **1.4.3** text **4.5:1**; large text (≥24px, or ≥18.66px bold) **3:1**.
  **1.4.11** UI component boundaries/states and meaningful graphics **3:1**.
  **2.4.7** a visible focus indicator at every tab stop.
  Exempt: disabled controls, `aria-hidden` decoration, logotypes.
- **All colour lives in `src/app/globals.css`.** There are no Tailwind palette colours in
  this codebase (no `text-gray-500`) and it must stay that way — the tokens are the single
  point of control that makes conformance checkable.
- **Two border tokens, and the difference matters.** `--line` is the decorative hairline
  (1.2:1, exempt). `--line-strong` (3:1) is for the boundary of a **control** — text
  inputs, textareas, icon-only buttons. A button with a visible text label keeps `--line`;
  1.4.11 allows it, because the label identifies the control. Don't "fix" `--line`.
- **Focus is one shared utility**, `focus-ring` (or `focus-ring-within` for a wrapped
  input): a 2px `--accent-strong` outline at 2px offset. Don't hand-roll a border swap.
- **Never dim text below the bar.** `text-ink/75` is the lowest passing ink opacity;
  `text-ink-soft` is already at its floor and takes no `/NN`. `text-accent` is a
  **non-text** colour (3:1) — for accent-coloured *text* use `text-accent-strong`.
- **A pale tint mixed over dark paper produces a mid-tone that fails AA.** This is why
  dark tile faces and the Papers cover label are DERIVED by re-lighting the authored hue
  in OKLCH (`src/lib/tiles.ts`) rather than mixed. Lowering the mix percentage cannot fix
  it: it trades text contrast against the neighbour-distinguishability rule and there is
  no value where both hold. Both faces are published as custom properties and CSS picks
  off `[data-theme]`, because the theme is only known pre-paint.

**Two gates, and they check different things.** `npm run test` proves the *tokens* are
legal — `src/lib/contrast.test.ts` reads the real hexes out of globals.css, so retuning a
token without updating anything else goes red on its own. `npm run audit:contrast` proves
the *rendered composite* is legal: it drives Playwright over every route in both themes and
measures actual pixels, catching what static token maths cannot (opacity stacking,
`color-mix`, tinted surfaces). It needs a dev server (§7) and is not part of `npm test`.

⚠️ **Turbopack does not reliably rebuild `globals.css` in a copied scratch instance.** If a
new CSS rule seems to have no effect, it is almost certainly stale cache, not your code:
delete `.next` and restart before debugging anything else.

## 11. Load rehearsal — the bot swarm (`scripts/bots/`, 2026-08-26)

Before handing out flyers we need evidence Drift holds up with 20 to 50 readers at once.
`scripts/bots/` runs simulated readers with real accounts, real supporter unlocks and
randomised reading speeds, and writes a report to `reports/loadtest/<timestamp>/`.

**It runs against a LOCAL rig, and that is deliberate.** Vercel permits load testing on
Enterprise plans only and states that an unannounced one gets its source IP blocked. Running
locally also moves the upstream spend onto your own connection instead of the live site's,
which matters most for the Gallery: The Met throttles at ~80 requests per **30 seconds** and
repeated tripping shrinks that budget for a **day** (§4). `run.mjs` refuses a non-localhost
`--base` without an explicit flag and caps it at 5 bots; `GALLERY_CAP` caps museum bots at 10.

**Two pieces make local comparable to production, and without them it is not:**

- **`edge.mjs`, a caching reverse proxy**, standing where Vercel's CDN stands. It reads the
  `Cache-Control` the app itself emits (so it can never drift from `lib/cache-headers.ts`) and
  mirrors the `carriesUserSession` bypass. Without it every bot request reaches an upstream and
  the run measures a system nobody deploys. It asks upstream for `accept-encoding: identity` —
  buffering gzip and re-serving it is what silently fed browser bots a blank page.
- **K `next start` instances** (never `next dev`, which would measure Turbopack). The gate in
  `upstream.ts` is per PROCESS; with one instance it becomes a global serialiser that pins the
  whole swarm at 200 req/min, which production does not do. Several `next start` share one build
  directory happily (verified).

**The fidelity gates.** `src/lib/loadbot*.test.ts` pin the harness's copied URL builders,
buckets and discover constants against the app's own, and pin the emulator against the real
cache profiles — a plain Node script cannot import the app's modules, so the copies are checked
rather than trusted. At runtime the report compares **requests per card** between the HTTP bots
and the real browser bots; measured 2.57 vs 2.67 (4% apart), against the ~2.4 in
`docs/beta-readiness.md`. If those two diverge, the volume bots are lying and the report says so.

⚠️ **Bot accounts must carry `app_metadata.welcomed: true`.** `AuthProvider` fires
`/api/email/welcome` on every confirmed sign-in and that route sends via Resend unless the stamp
is set. Without it a 50-bot run means 50 hard bounces to `.invalid` against a real sending
reputation. Teardown selects on `app_metadata.load_bot`, never on the address.
