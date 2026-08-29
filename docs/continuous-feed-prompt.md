# Working on the reading feed

> ⚠️ **THE PROJECT THIS FILE WAS WRITTEN TO DRIVE IS FINISHED** (Phase 7, 29 August 2026). There
> is no "next phase" to take, and `plan-continuous-feed.md` is now history rather than a queue of
> work. What survives is this: the feed is a scroll-snap scroller, it is subtle, and the way to
> work on it safely is the way described below. **Steps 2 and 3 assume a phase to pick up and no
> longer apply as written** — read them as how to research and plan a CHANGE to the feed, which is
> the part that still holds.
>
> If you are here for a bug or a feature in the feed, the short version is: read `CLAUDE.md` §12,
> then `docs/continuous-feed.md` (especially §9, the invariants), then the code. Measure before
> you decide anything. Gate with `npm run verify:feed`.

**Paste this whole file as the first message of a new session**, or say: "read
`docs/continuous-feed-prompt.md` first and do what it says."

---

## What you are joining

Drift is a calm, local-first web app for healthy scrolling: full-screen knowledge cards where the
reader is the algorithm, steering by pulling visible "threads". It is live at `usedrift.org` in a
small beta. `docs/onboarding-prompt.md` is the general introduction to it.

**This branch (`continuous-feed`) is one project inside it:** replacing the discrete, one-card-at-
a-time swipe with a continuous scroll-snap feed, the way a social feed works, without turning
Drift into the thing it exists to be an antidote to.

---

## Step 1 — Read, in this order. All of it, before proposing anything.

1. **`docs/onboarding-prompt.md`** then **`CLAUDE.md`** — what Drift is and the rules that bind
   every change. §2 (the anti-slot-machine principles), §4 (hard-won API facts and the
   graceful-degradation contract), §7 (commands, and the traps around running two servers),
   §8 (the working agreement), §10 (WCAG 2.2 AA and its two gates).
2. **`docs/continuous-feed.md`** — **the reference for this project.** The research, the
   architecture, the rate-limit arithmetic, the hazards, and ten invariants that must not break.
   It is the single most important file for you. Read every word of §3, §7 and §9.
3. **`plan-continuous-feed.md`** — **where we actually are.** Read the "Current status" block,
   then the phase you are about to work in, then the decision log at the bottom.
4. **`plan.md`** — the main line's tracker. You need its "Current status" block for context on
   what else exists; you do not need its full history.
5. The code the phase touches, in this shape:
   - `src/app/(app)/drift/useDriftSession.ts` — the **engine**: everything a session IS.
   - `src/app/(app)/drift/ContinuousFeed.tsx` — the **scroller**. Its header comment lists the
     three properties that hold the whole thing up.
   - `src/app/(app)/drift/page.tsx` — nothing but the Suspense boundary the engine needs. (There
     was a `DiscreteFeed.tsx` beside it, the card-at-a-time shell, and a `lib/feedmode.ts` flag
     to choose between them. Phase 7 deleted both.)
   - `src/lib/feedqueue.ts`, `lookahead.ts`, `branch.ts`, `focus.ts`, `doors.ts`, `limits.ts` — the
     pure logic, all tested.
   The comments explain *why*, and usually name the bug that motivated the shape. Trust them and
   keep writing in the same register.

**While reading, hold on to these, because they are what people get wrong here:**

- An **uncommitted card is not part of the session**. It is not in the trail, not in `seen`, not
  counted by the meter. That split is the whole architecture.
- **Threads and the doorway are fetched for the current card and at most one ahead, never for
  every rendered card.** Doing otherwise takes a Gallery screenful from ~9 to ~45 Met requests
  against a bucket of roughly 80 per 30 seconds, and an open breaker serves zero cards.
- **`seenRef`/`persistSeen` fire on commit, never on materialise.** `seen` means "the reader read
  this"; a queued card has not happened yet. The ids the queue has spoken for are **derived** from
  the queue (`pendingIds`), never tracked alongside it — `docs/continuous-feed.md` §8.7 explains why
  a second set was going to be the worst bug in the project.
- **`history` is append-only** and every feed item is exactly one viewport tall. Those two
  properties are what make forking, branch-switching and windowing scroll-safe.
- **Only the ACTIVE card carries `data-tour` and `data-drift-scroll`**, and only it loads the
  full-size image. Four cards are in the DOM; anything that looks a marker up with `querySelector`
  finds the topmost one otherwise, which is how two tour steps broke.
- **The feed moves on its own in exactly one place** — carrying the reader onto the ending card —
  and only when they are already on the last card. That guard is not optional.
- **The queue hangs under the TIP, so only the tip may fill it or steer it.** The engine derives
  the realm, the focus and the fallback threads from `pos`, which is wherever the reader is
  standing — so the feed fetches nothing at all while somebody is scrolled up re-reading.
- **An effect nothing can fire is a dead branch that looks like working code.** This feed runs
  from effects, not gestures. Four of the six bugs the pre-Phase-7 audit found were that same
  shape (`docs/continuous-feed.md` §4.8), and none of them was visible by reading.
- **The published pages and the internal rules were deliberately rewritten DIFFERENTLY**, and it
  is worth knowing which is which before you edit either. `/principles` §2 and `/how-it-works`
  simply had the promises we cannot keep removed, with nothing added about queues or scrolling —
  a reader wants a page that is true, not a changelog. `CLAUDE.md §2.2`/§6 and
  `drift-spec.md §2.2`/§7 keep the superseded wording visible under a ⚠️ and say what replaced
  it, because a session that reads "Prefetch at most 1 card ahead" will "fix" the queue out of
  existence. `docs/continuous-feed.md` §3.1 records the reasoning.

---

## Step 2 — Research the change before planning it

(Written for the phased build. With the project finished, read "the phase" as "the change you are
about to make" — everything below still applies, and the measurement recipes especially.)

1. **Read the code you are about to change**, fully. Not a grep of the function names.
2. **Search the web** for anything the phase depends on that we have not already measured: CSS
   scroll snap behaviour, `content-visibility`, IntersectionObserver, nested scrolling, browser
   support. Do not trust a memory of an API's browser support in a codebase this careful; check.
   Record what you find in `docs/continuous-feed.md` with the source linked.
3. **Measure, do not guess.** This project has already been redirected once by measurement: the
   plan assumed images were the bottleneck and the numbers showed it was the thread chips, which
   changed the order of the work. The tools:
   - `NODE_OPTIONS="--import ./scripts/bots/upstream-count.mjs" npx next start -p 3106`, then
     `kill -USR2 <the next-server pid, NOT the npm wrapper>` prints and resets per-host counts.
   - Playwright is a dependency; drive the real feed with the keyboard (ArrowDown drifts, 1/2/3
     pull threads, ArrowUp goes back) exactly as `scripts/bots/bot-browser.mjs` does.
   - Counting the CLIENT's requests per route is usually the honest measure. Upstream counts vary
     enormously card to card (one doorway is a search plus up to five record fetches).
   - ⚠️ To test the feed without signing in you must **rebuild** with the cloud vars blanked
     (`NEXT_PUBLIC_*` is inlined at build time, so blanking it at `next start` does nothing):
     `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build`.
     Rebuild normally afterwards. (There used to be a `NEXT_PUBLIC_FEED_CONTINUOUS=1` in front of
     that line. Every build is the scroller now.)
   - ⚠️ Local has **no CDN**, so it hits the Met's limit far more readily than production ever
     will. A breaker trip while developing is not a signal about production (`CLAUDE.md §4`).
     Give the museum a rest between runs rather than concluding something is broken.
   - ⚠️ Never run `next build` in a directory a live `next start` is serving from (`CLAUDE.md §7`).

---

## Step 3 — Plan it formally

Enter **plan mode** and write a plan that a stranger could execute:

- a **Context** section: what problem this phase solves and what "done" looks like;
- the concrete files and functions, and which existing helpers you are reusing rather than
  rewriting (`lib/branch.ts`, `lib/lookahead.ts`, `lib/doors.ts`, `lib/focus.ts`, `lib/gesture.ts`
  and `lib/limits.ts` already hold most of the thinking);
- which of the invariants in `docs/continuous-feed.md` §9 the phase could break, and what stops
  it;
- the upstream-cost consequence, in requests per card, with the number you measured;
- a **verification** section: which tests, which gates, and which real-browser flows.

**Ask the owner choice questions with `AskUserQuestion` whenever two paths would produce
materially different products** — a peek versus no peek, an overlay versus a card in the scroll,
one feed versus two behind a flag. They have said they do not have strong technical opinions and
trust the engineering judgment, so do not ask them to choose an algorithm. Ask them about things
they can feel as a reader. Give a recommendation with each question.

Then call `ExitPlanMode` and wait.

---

## Step 4 — Build it the way this repo builds things

- **Pure logic goes in `src/lib/*`, with tests**, React-free and DOM-free. The component calls
  into it. That separation is the main defence against the bugs that actually happen here.
- **Match the comment density.** Comments in this codebase explain *why*, and frequently name the
  bug that produced the shape. A `⚠️` marks something someone already paid for. Write in that
  register and never delete one of those warnings without replacing the protection it describes.
- **All colour lives in `src/app/globals.css`** as tokens. No Tailwind palette colours, ever.
- Anything optional (a backend, a mail sender, an anti-spam service) **degrades, never breaks**.
- Stay in the phase. Do not add sources, dependencies or parking-lot ideas nobody asked for.
- Ask before anything destructive. Do not commit or push unless asked.

---

## Step 5 — Nothing is done until it is verified

`CLAUDE.md §8.1` is not a formality. Before you call a phase complete:

- `npm run build` clean (this is the type-check gate), `npm run lint` clean with **zero warnings**,
  `npm run test` green;
- `BASE=<your port> npm run audit:contrast` PASS if anything visual changed (pass `BASE` or it
  measures nothing and still says PASS). ⚠️ **THIS USED TO SAY "run the standing gate against a
  flag-off build", AND THAT IS NOW IMPOSSIBLE AND BACKWARDS.** There is no flag and no other feed:
  Phase 7 repointed `audit-contrast.mjs` at the scroller (its `branchInFeed` row presses ArrowUp
  where it used to click a "Previous stop" button that no longer exists), so it must be run against
  the ordinary build like everything else;
- **`BASE=<your port> npm run verify:feed`** — **130 checks** over the real feed, 65 at each of two
  viewports. This is the gate for anything touching the scroller. It needs the cloud vars blanked,
  nothing more: `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build`
  (there used to be a `NEXT_PUBLIC_FEED_CONTINUOUS=1` in front of that; every build is the scroller
  now). ⚠️ Never alongside `audit:contrast` — both cross into the Gallery;
- the **real screen exercised in a real browser**, including a thread pull, a realm cross, going
  back, a branch, and the trail map. A phone if the phase touches gestures or scrolling;
- the upstream cost re-measured and compared against the number you recorded in step 2;
- **say plainly what you could not verify.** Never report an untested step as done.

Then:

- tick the boxes in `plan-continuous-feed.md`, update its "Current status" block, and add a short
  entry saying what shipped and **why it is shaped that way**;
- fold any new measurement or hazard into `docs/continuous-feed.md` so the next session inherits
  it instead of rediscovering it;
- report the before/after numbers to the owner and **stop**, so they can play with it before you
  start the next phase.

---

## The one-line version, if you read nothing else

Read `docs/continuous-feed.md` and `plan-continuous-feed.md`, take the next unticked phase (or
several if they belong together), measure before you build, plan it in plan mode with real
questions for the owner, keep the invariants in §9, run `npm run verify:feed`, and write down what
you learned.

⚠️ **And when a browser check fails, suspect the check first.** Nearly every "bug" found while
building this feed turned out to be the test: `.first()` resolving to the phone copy of a component
that is `md:hidden`, a click landing in the gap inside a `data-tour` container that holds two
controls, an invented bucket slug, or the Met's rate limiter. Confirm the failure a second way
before changing product code.
