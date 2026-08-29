# Prompt for an independent audit of the continuous-feed project

Paste everything below the line as the first message of a **fresh Claude Code session** in this
repository, on the `continuous-feed` branch. Written 2026-08-29, before the branch was merged.

---

## Your role

You are auditing a finished piece of work **before it is merged to `main` and deployed to real
readers**. It was written by another AI session working with the owner, over eight phases. Every
gate is green and the author believes it is ready.

**Treat that belief as an untested hypothesis.** Your entire value here is your willingness to
reach the opposite conclusion. The author already audited their own work once, found six bugs, and
fixed them; you are the pass that comes after that one, so the easy findings are gone and the ones
left will be where nobody has looked.

Two failure modes, in order of importance:

1. **Rubber-stamping.** Do not conclude "this is careful work" because the comments are thorough
   and the documents are detailed. They are, and that is exactly what makes a wrong claim hard to
   spot. Several documents in this repo make specific, measured, load-bearing claims. Some of them
   are cheap to check. Check them rather than reading them.
2. **Noise.** A list of forty style opinions buries the one real bug. Rank ruthlessly. If a finding
   cannot be stated as "this input produces this wrong behaviour", or "this document says X and the
   code does Y", it probably is not a finding.

If you find nothing serious, say so plainly. That is a legitimate result and more useful than a
manufactured one.

## What Drift is

A calm, local-first web app for "healthy scrolling": full-screen knowledge cards where the reader
is the algorithm, steering by pulling visible "threads" on each card. Content comes from Wikipedia
(CC BY-SA) and The Metropolitan Museum of Art's CC0 collection. A session has a beginning (a seed),
a middle (a trail), and an end (a shareable trail map). It is **live at `usedrift.org`** in a small
beta, with accounts, a Supabase backend, public share links and a one-off supporter payment.

It exists as an antidote to doomscroll feeds, and `CLAUDE.md` §2 holds five anti-slot-machine
principles that are hard product constraints, not preferences.

## What this project did

Replaced the discrete, one-card-at-a-time swipe feed with a **continuous CSS scroll-snap
scroller**, one card per screen, 1:1 with the finger, without turning Drift into the thing it
exists to be an antidote to.

The central idea: a card is **materialised** (rendered into a bounded queue below the reader,
costing a discover request and nothing else) and later **committed** (>=75% visible, held 300 ms),
and only committing puts it in the trail, in the `seen` store, in the daily meter and in the guided
tour. An uncommitted card has not happened, so steering throws the queue away with nothing to undo.

This directly reversed a principle the app **published on two live pages** ("no card sliding
partway into view", "at most one card ahead"). That reversal was a deliberate owner decision and
the pages were rewritten in the same change.

## Read these, in this order, before forming any opinion

1. `docs/onboarding-prompt.md`, then **`CLAUDE.md` in full**. Pay attention to §2 (the principles,
   including the ⚠️ in §2.2 recording the reversal), §4 (hard-won upstream facts: dead endpoints,
   the Met's rate limiting, the circuit breaker, what must never be cached), §7 (commands and the
   traps around running servers), §8 (the working agreement), §10 (WCAG 2.2 AA and its two gates),
   and §12 (the map of this feed).
2. **`docs/continuous-feed.md`, every word.** This is the reference for the project: the research,
   the measurements, the rate-limit arithmetic, the hazards, and **seventeen invariants in §9**
   that the whole design rests on. §4.8 is the author's own pre-Phase-7 audit (six bugs) and §4.9
   is what Phase 7 measured. Read §5 (the architecture), §7 (the upstream budget) and §9 twice.
3. `plan-continuous-feed.md`: the status block, then the progress log at the bottom. It says what
   shipped and, more usefully, why each thing is shaped the way it is.
4. `plan.md`: the "Current status" block only, for context on what else exists in the app.
5. Then the code:
   - `src/app/(app)/drift/useDriftSession.ts` (~2,400 lines) is the **engine**: everything a
     session IS. React, but no DOM opinions.
   - `src/app/(app)/drift/ContinuousFeed.tsx` (~1,200 lines) is the **scroller**: the
     IntersectionObserver, the queue, the commit, the keyboard, the steering. Its header comment
     lists the three properties that hold the whole thing up.
   - `src/lib/feedqueue.ts`, `lookahead.ts`, `branch.ts`, `focus.ts`, `doors.ts`, `limits.ts`:
     pure, React-free, DOM-free, all unit-tested.
   - `src/components/CardView.tsx`, `TerminusCard.tsx`, `FeedChrome.tsx`.

The comments in this codebase explain *why*, and usually name the bug that produced the shape. A
⚠️ marks something someone already paid for. Read them, and be suspicious of any that no longer
match the code around them.

## The diff you are auditing

```
git diff main...HEAD --stat        # 33 files, ~8,500 insertions, ~3,200 deletions
git log --oneline main..HEAD       # four commits
```

**Audit the whole project, not just the last commit.** The final phase (retiring the old shell,
rewriting the published promises, repointing the load-test and contrast harnesses) is the freshest
and least-reviewed, so weight it, but the architecture landed earlier and a design flaw there is
worth more than a slip in the last commit.

## Where the bugs in this codebase have actually been

Not a checklist to tick. This is where four separate rounds of real bugs came from, so it is where
to point a fifth.

- **An effect that nothing can fire is a dead branch that looks like working code.** A
  card-at-a-time feed runs from gestures; this one runs from **effects**. Four of the six bugs in
  the author's own audit were that shape: a failed refill with no timer behind it ended the feed
  permanently; a `useCallback` memoised on a value that never changes pinned a stale engine object
  for a whole session and silently killed the degraded fallback. **Trace every effect's dependency
  list and ask what can actually re-fire it, especially in states where nothing else is changing.**
- **`.first()` is a trap, twice over.** Four cards are in the DOM at once, and each card renders
  its threads twice (one copy always `md:hidden`). Any `querySelector` or Playwright locator that
  is not scoped to the active card is probably finding the wrong one. This caused two real tour
  bugs and several false test failures.
- **The `seen` set's lifetime.** `seenRef` and `persistSeen` must fire on **commit**, never on
  materialise. `persistSeen` writes to IndexedDB with a FIFO cap of ~500, so marking a queued card
  seen and then discarding it denies the reader a card they never saw, durably.
- **The Met's budget.** ~80 requests per ~30 seconds, `403` with no `Retry-After`, and repeated
  tripping shrinks the budget for a **day**. Threads and the doorway are fetched for the current
  card and at most one ahead; doing it for all four rendered cards takes a Gallery screenful from
  ~9 requests to ~45, and an open circuit breaker serves a Gallery room zero cards. `CLAUDE.md` §4
  has the full picture, including why an empty answer must never be cached at the edge.
- **The invariants in `docs/continuous-feed.md` §9.** Read each one, then go and find the code that
  enforces it. **An invariant that no code enforces is the finding.** This has already happened
  once here: three exports of `feedqueue.ts` were documented as load-bearing, unit-tested, and
  called from nowhere at all.
- **Documents that assert measurements.** The repo's habit is to record numbers. Some are now old.
  Where a claim is cheap to verify, verify it.

## Also worth your attention, because it is the freshest work

- The **published pages** (`/principles` §2, `/how-it-works`) were rewritten to remove promises the
  app can no longer keep. Read them as a reader would and ask whether anything still on them is
  false, and whether anything removed left a sentence that no longer parses. Then check the rest of
  the public pages, the landing page and the guided tour copy for the same class of staleness: they
  describe a feed that no longer exists in some places, and the author found three such claims by
  accident rather than by searching exhaustively.
- The **engine was stripped** of about ten exports that only the deleted shell used. Confirm
  nothing removed is still needed, and more interestingly, confirm nothing that *should* have been
  removed is still there.
- **`scripts/bots/`** (the load-test harness) and **`scripts/audit-contrast.mjs`** were repointed
  at the scroller. `src/lib/loadbot*.test.ts` pin the harness's copied constants against the app's.
  A harness that measures the wrong thing while reporting success is the most dangerous artefact in
  this repo, and it was in exactly that state until the last commit.
- **`scripts/verify-feed.mjs`** is the feed's gate, 65 checks per viewport. Ask what it does *not*
  cover.

## What is already known to be unverified

Do not spend time rediscovering these. Do challenge them if you think the risk is understated.

- **iOS.** Nobody has a device. `scroll-snap-stop: always` is the mitigation for WebKit's historic
  hard-flick; `docs/continuous-feed.md` §4.9 finding 20 names a second WebKit hazard (cached snap
  positions going stale when children change, which the queue does constantly).
- **The full 25-reader load rehearsal.** A 3-bot smoke run passed; the volume run has not happened,
  so `docs/beta-readiness.md`'s "≈2.4 Wikimedia calls per card" still describes the old feed.
- **`day-done`** (the daily allowance ending) end to end. It needs a signed-in account and a live
  backend; its arithmetic is unit-tested.

## How to run things here, and the traps

```bash
npm run test           # vitest, ~1,394 tests, fast
npm run build          # the type-check gate
npm run lint           # must be clean with ZERO warnings
```

To exercise the feed in a browser you must build with the cloud vars blanked, because
`NEXT_PUBLIC_*` is inlined at build time and the app is login-gated whenever they are present:

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build
npx next start -p 3106
BASE=http://localhost:3106 npm run verify:feed        # expect 130/130
BASE=http://localhost:3106 npm run audit:contrast     # expect PASS, ~5,000 nodes, 33 views x 2
```

- ⚠️ **Never run `next build` in a directory a live `next start` is serving from.** The result is
  not a crash: the server keeps answering HTTP 200 while its chunks point at files that no longer
  exist, and you will chase phantom bugs. Kill the server first.
- ⚠️ **Never run `verify:feed` and `audit:contrast` at the same time.** Both cross into the
  Gallery, and locally there is no CDN in front of The Met's bucket. When a Gallery check fails,
  read the server log before reading the code.
- ⚠️ **Local has no CDN**, so it hits upstream limits far more readily than production ever will. A
  breaker trip while developing is not a signal about production.
- Playwright is already a dependency. Driving the real feed with the keyboard (ArrowDown scrolls
  on, ArrowUp scrolls back, 1/2/3 pull threads) is the most reliable way to prove anything.
- `NODE_OPTIONS="--import ./scripts/bots/upstream-count.mjs" npx next start -p 3106`, then
  `kill -USR2 <the next-server pid>`, prints and resets per-host upstream counts.
- Numbers to hold the claims against: **130/130** on `verify:feed`, **PASS at 5,014 nodes over 33
  views x 2 themes** on `audit:contrast`, **1,394 tests**, and per committed card **1.36
  `/api/realm/*/related`, 1.36 `/api/doorway`, 0.27 discover** (Encyclopedia, 11 stops, 60/40
  thread/drift, Read more every fourth).

## What to do with what you find

**Establish a green baseline first** (build, lint, test), so you can tell what you broke from what
was already broken.

**Fix directly, without asking:**

- typos, stale comments, dead imports, a comment that describes code that no longer exists
- a genuinely one-line, behaviour-preserving correction with an obvious right answer
- a missing unit test for logic that is already correct
- anything confined to one file that cannot change what a reader sees

Re-run the gates after, and list what you did.

**Report back and WAIT for approval, do not implement:**

- anything that changes what a reader sees or feels
- anything touching one of the seventeen invariants, the commit path, the queue, the upstream
  budget, or the `seen` store
- anything spanning more than one file, or requiring a new test to prove
- anything where you are not certain, and anything where more than one fix is defensible

For each of those, give the owner:

1. **What is wrong**, in one sentence.
2. **How it fails**: the concrete input, state or sequence that produces the wrong behaviour. If
   you could not reproduce it, say "suspected, not reproduced" and say exactly that.
3. **Severity**: does it break the app, mislead a reader, cost upstream budget, or is it tidiness?
4. **Where**: `file:line`.
5. **Your proposed fix**, specific enough to approve or reject without further discussion, and any
   alternative worth considering.

Order the whole report by severity, and **separate what you verified from what you inferred by
reading.** Say plainly what you did not have time or means to check.

## Ground rules

- **Do not commit, push, merge, or rebase.** The owner merges.
- Do not add dependencies, content sources, services or features. Nothing is in scope that was not
  already in the branch.
- Match the surrounding code's style and especially its comment density. Comments here explain
  *why* and name the bug that motivated the shape. Never delete a ⚠️ without replacing the
  protection it describes.
- All colour lives in `src/app/globals.css` as tokens. There are no Tailwind palette colours in
  this codebase and it must stay that way.
- Say what you actually ran and what you only read. Show failing output rather than describing it.
