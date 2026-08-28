# Starting a session on the continuous feed

**Paste this whole file as the first message of a new session**, or say: "read
`docs/continuous-feed-prompt.md` first and do what it says."

It is written to stay true whatever phase the work is in. It does not say where we are, because
`plan-continuous-feed.md` keeps that and would go stale here within a week. Follow it in order
and do not skip step 1 because the task "looks small".

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
5. The code the phase touches. Start with `src/app/(app)/drift/page.tsx` (the feed),
   `src/lib/lookahead.ts`, `src/lib/branch.ts`, `src/lib/focus.ts`, `src/lib/doors.ts`,
   `src/lib/limits.ts`. The comments in those files explain *why*, and usually name the bug that
   motivated the shape. Trust them and keep writing in the same register.

**While reading, hold on to these five, because they are what people get wrong here:**

- An **uncommitted card is not part of the session**. It is not in the trail, not in `seen`, not
  counted by the meter. That split is the whole architecture.
- **Threads and the doorway are fetched for the current card and at most one ahead, never for
  every rendered card.** Doing otherwise takes a Gallery screenful from ~9 to ~45 Met requests
  against a bucket of roughly 80 per 30 seconds, and an open breaker serves zero cards.
- **`seenRef`/`persistSeen` fire on commit, never on materialise.** The queue needs its own
  pending set. `docs/continuous-feed.md` §8.7 says why this is the likeliest bug in the project.
- **`history` is append-only** and every feed item is exactly one viewport tall. Those two
  properties are what make forking, branch-switching and windowing scroll-safe.
- The owner has decided the scroller goes ahead **and** that `CLAUDE.md §2.2`,
  `drift-spec.md §2.2`/§7, `/principles` §2 and `/how-it-works` will be rewritten to say what the
  app really does. That rewrite ships **with** the feed, never after it.

---

## Step 2 — Research the next phase before planning it

Take the next unticked phase in `plan-continuous-feed.md`. **You may take more than one phase at
a time if they genuinely belong together** — a pure-logic module and the code that first uses it,
say. Say which phases you are taking and why. Do not silently expand scope, and do not split a
phase so small that the owner cannot play with the result.

Then, in this order:

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
     Rebuild normally afterwards.
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
- which of the ten invariants in `docs/continuous-feed.md` §9 the phase could break, and what
  stops it;
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
  measures nothing and still says PASS);
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
questions for the owner, keep the ten invariants, verify for real, and write down what you
learned.
