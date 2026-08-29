# Continuous feed — implementation plan & progress tracker

The tracker for the `continuous-feed` branch. Same rules as `plan.md`: read this first, work
the current phase in order, tick boxes (`- [ ]` → `- [x]`) only when something is **tested with
success**, and add a log entry when a phase lands.

**The reference document is `docs/continuous-feed.md`.** It holds the research, the
architecture, the rate-limit arithmetic and the invariants. Read it before this file. Nothing
here repeats its reasoning; this is only the order of work.

**Starting a fresh session?** Paste `docs/continuous-feed-prompt.md` as your first message, or
say "read `docs/continuous-feed-prompt.md` first". It is the single prompt that brings a new
assistant all the way from nothing to a formal plan for the next phase.

> ## Current status: 2026-08-29 — ✅ THE PROJECT IS COMPLETE
>
> **Phases 0 to 7 are done.** `/drift` is a continuous scroll-snap feed and there is no other one:
> Phase 7 deleted the card-at-a-time shell, `lib/feedmode.ts`, `?feed=classic` and
> `NEXT_PUBLIC_FEED_CONTINUOUS`, rewrote the four promise surfaces, and repointed both harnesses.
>
> **`docs/continuous-feed.md` is the reference** and outlives this file: the research, the
> measurements, the rate-limit arithmetic, and **seventeen invariants** (§9) that the design rests
> on. `CLAUDE.md §12` is the short map for someone who never opens it. This tracker is now history.
>
> ### 🧪 The gates
>
> | | |
> |---|---|
> | `npm run test` | **1,394** green, 83 files |
> | `npm run build` | clean (the type-check gate) |
> | `npm run lint` | clean, **zero** warnings |
> | `npm run verify:feed` | **130/130**, 65 checks each at 1280x900 and 390x844 |
> | `npm run audit:contrast` | **PASS**, 5,014 nodes over 33 views x 2 themes |
>
> ⚠️ **DO NOT RUN `verify:feed` ALONGSIDE ANOTHER BROWSER SUITE.** Both passes cross into the
> Gallery, and locally there is no CDN in front of The Met's ~80-requests-per-30-seconds bucket
> (CLAUDE.md §4). When a Gallery check fails, read the server log before reading the code.
>
> ### 📏 Cost, re-measured on the finished feed
>
> Encyclopedia, 11 committed stops, 60/40 thread/drift, Read more every fourth — the mix
> `docs/beta-readiness.md` used. **Identical before and after Phase 7's engine strip**, which is how
> we know that part was behaviour-neutral:
>
> | route | per committed card |
> |---|--:|
> | `/api/realm/*/related` | 1.36 |
> | `/api/doorway` | 1.36 |
> | `/api/realm/*/summary` | 0.36 |
> | `/api/realm/*/discover` | **0.27** |
> | total `/api` | 3.36 |
>
> The two 1.36s are lookahead not yet consumed; they amortise with session length (1.15 over 26
> cards). **Discover went DOWN** from the old feed's ~0.5, because a thread pull hands three
> materialised cards back to the buffer instead of leaving them unfetched.
>
> ### 🔴 Still unverified, said plainly
>
> - **iOS.** No device here. `scroll-snap-stop: always` is the mitigation for WebKit's historic
>   hard-flick, and `commitAt` keeps the trail honest even if it does not hold. Watch also for
>   WebKit's cached snap positions going stale as the queue adds and removes children
>   (`docs/continuous-feed.md` §4.9, finding 20). **Try it on a phone.**
> - **The 25-reader load rehearsal has not been re-run** since the harness was repointed. So
>   `docs/beta-readiness.md`'s ≈2.4 Wikimedia calls per card still describes the OLD feed, and the
>   new retry ladder has still never been measured against a throttling Met. The harness is ready;
>   the run is not done. Two boxes in Phase 7 are open for exactly this.
> - **`day-done` end to end.** The meter needs a signed-in account and a backend; with the cloud
>   vars blanked it correctly fails open. Its arithmetic is unit-tested and it renders through the
>   same `TerminusCard` as the three endings that ARE tested in a browser.
>
> ### ✅ Two pre-existing `main` bugs, fixed here
>
> Both were uncovered by Phase 7's own work rather than sought out, and both are recorded in the log
> entry below.
>
> 1. **The focus banner's WCAG AA failure.** "Drift freely" measured **4.42:1** against a 4.5 bar,
>    from tint stacking. Fixed by dropping the release button's nested tint; **re-measured at
>    5.69:1**. The audit's route list now renders a focus banner, so the class of bug is no longer
>    invisible.
> 2. **`StorageNotice` covering "Save trail".** Hit-tested: the element at the centre of the button
>    was the notice. It steps aside while the exit screen is open now, the way it already did for
>    the guided tour, and comes back when the screen closes.
>
---

## Phase 0 — Make the discrete feed feel instant ✅ COMPLETE

**Ships to `main` on its own. Did not touch principle §2.** Nothing here renders a card ahead; it
prepares the *next buffered card's* data, which `CLAUDE.md §2.2` already permits.

⚠️ **The order below is not the order this phase was planned in.** It was planned images-first, on
reasoning; the baseline measurement said chips-first, and the plan was changed to follow the
numbers. That habit is the thing to copy, not this conclusion.

- [x] **Measured the baseline first.** 12 drifts per realm, local production build, Playwright,
      `upstream-count.mjs`. Encyclopedia chips 3,347 ms median, Gallery 1,847 ms, transition
      530 ms in both realms, picture already ready. Numbers in `docs/continuous-feed.md` §2.
- [x] `src/lib/lookahead.ts` — one predicate for "may this buffered card be served?", shared by
      the destructive take and the new non-destructive peek, so preparation can never name a
      different card from the one that gets shown. 14 unit tests.
- [x] **Prepare the next card's threads and doorway, one card only**, after
      `PREPARE_NEXT_AFTER_MS` (1.2 s) so a reader moving quickly never pays for it. Skipped under
      a pool-served focus and after a heart-like, where the next card does not come from the buffer.
- [x] **`threadsFor`: at most one request in flight per card id.** The fix that makes preparation
      free rather than wasteful, and the one to remember. It also retired the old
      abort-on-cleanup, which never cancelled anything upstream because our routes do not forward
      `request.signal`.
- [x] **Warm the next card's picture**, asymmetrically: `previewUrl` and Wikipedia thumbnails are
      hotlinked by the browser and cost us nothing; `/api/img/met/...` is ours and is never warmed
      speculatively. The test is on the URL, not the realm.
- [x] **Background top-up at a low-water mark** (`REFILL_LOW_WATER = 3`), outside the busy lock,
      stamped with the realm and focus it was started under so a late arrival cannot re-seed the
      buffer from a focus the reader has released. Visible stalls: 1 per 24 drifts to 0.
- [x] **Retuned the transition** (stiffness 260 to 380, damping 30 to 34) and made it honour
      `prefers-reduced-motion`, which motion/react does not do by itself. 530 ms to 146 ms.
- [x] **The one-word honesty fix** on `/principles` and `/how-it-works`.
- [x] Verified: no rise in upstream cost (1.0 `/related` and 1.0 `/doorway` per card, before and
      after), build + lint + 1,372 tests + contrast audit all clean, real-browser pass over
      drift / thread / back / cross / trail map with zero console errors.

## Phase 1 — Extract the session engine ✅ COMPLETE

- [x] `src/app/(app)/drift/useDriftSession.ts` (2,362 lines) holds everything that decides WHAT the
      reader sees: the session-load effect and its restart guards, the branch model, the focus
      stack, every buffer and pool, threads and the Phase 0 preparation, reactions, the meter,
      doors, dwell, and every move. Co-located with the route, the way `useAuth` lives in
      `AuthProvider.tsx`; it is React code, so it does not belong in `src/lib`.
- [x] `page.tsx` (549 lines) is now only HOW a card appears: gestures, keyboard, the transition,
      the markup. It destructures the hook in one statement so **every JSX line is unchanged**,
      which is what made the diff reviewable by eye.
- [x] `EndOverlay.tsx` (281 lines) moved out verbatim. Both shells need it and the scroller cannot
      import it from `page.tsx`.
- [x] Two things are exposed as functions rather than as refs, because a ref on a hook's public
      surface becomes permanent the moment anyone uses it: `onTrailSaved(t)` and `isBusy()`. The
      second matters — a gesture handler needs the ref synchronously, not the `advancing` state one
      render behind it, or a fast wheel slips an extra tick into the gap.
- [x] **The load-bot fidelity gate caught the move and is re-pointed.** `loadbot.test.ts` reads
      `REFILL_TOPICS` / `DISCOVER_LIMIT` / `SEED_LIMIT` out of the feed source; they moved, it went
      red, exactly as CLAUDE.md §11 intends. The comments in `scripts/bots/*` that named the old
      file were updated too.
- [x] Verified **30/30** in a real browser across every entry point: four seed kinds, all five
      focus kinds, drift / thread / back / forward / rail jump / branch-from-a-revisited-stop /
      the ways switch at a fork / realm cross both ways, the trail map with save, rename, like and
      export, and re-entry by `?continue=` and `?from=`. Zero console errors.
- [x] Performance re-measured and **unchanged**: 145-148 ms to a full stop, 1.00 `/related` and
      1.00 `/doorway` per card, zero busy-lock stalls, in both realms.
- [x] Build, lint (zero warnings), 1,403 tests, contrast audit PASS.

---

## Phase 2 — `src/lib/feedqueue.ts` ✅ COMPLETE

Pure, React-free, DOM-free, network-free. 31 tests. **Wired to nothing** — the scroller that
consumes it is Phase 3.

- [x] `FeedItem` (`step` | `queued` | `ad` | `terminus`) with guards, and `queuedItem()` keyed on
      the card id so the queue, the thread cache and `seen` all name a card the same way.
- [x] `commitDecision` with `COMMIT_RATIO` 0.75 and `COMMIT_SETTLE_MS` 300. The settle window is
      the part that matters: `scroll-snap-stop: always` halts a fling at *every* card, so
      visibility alone would record six stops from one gesture.
- [x] `queueCapacity`, clamped by the day's remaining stops and **failing open** on `null`.
- [x] ⚠️ **`pendingIds` DERIVES the spoken-for ids from the queue rather than tracking them.**
      This is a deliberate improvement on the plan, which had a separate pending set released by
      hand. `docs/continuous-feed.md` §8.7 named that set the likeliest bug in the project — an id
      added on materialise and forgotten on discard either leaks (the card can never be served
      again, and `persistSeen` makes that durable) or duplicates. Deriving makes both impossible:
      dropping an item IS releasing its id, in the same statement.
- [x] ~~`isCandidate` builds on `lookahead.isServable` instead of repeating it~~ — ⚠️ **DELETED
      by the pre-Phase-7 audit.** It was exported, unit-tested and called from nowhere at all, and
      a defence the docs describe as load-bearing but no code consults is worse than none, because
      it stops the next person looking. `fill` now checks `pendingIds` where cards actually enter
      the queue. Left visible rather than quietly removed, because the tick was real and the claim
      was not.
- [x] `invalidateQueue` returns the dropped cards, not just an emptied queue. They cost real
      upstream requests, and the caller should return them to the discover buffer — otherwise every
      thread pull throws away three cards of the Met's daily budget.
- [x] `trimToCapacity` drops from the END, so a closing day runs the feed out under the reader's
      thumb rather than in front of it.
- [x] `insertAfterLike` inserts and never overwrites, and never touches an item the reader has
      begun to reveal.
- [x] `terminusReason` / `appendTerminus`, idempotent, with the day always outranking every other
      ending.

---

## Phases 3 + 4 — the scroller, and steering on it ✅ COMPLETE

Shipped together, and the reason is a principle rather than convenience: Phase 3 alone would have
rendered thread chips it could not honour, and a control that does not do what it says is a bug
here (§2).

- [x] `src/lib/feedmode.ts` — the flag, shaped like `lib/ads.ts`. `?feed=classic` overrides it, and
      **only in that direction**: a URL may never switch the unfinished feed ON, so a deployment
      that has not opted in cannot be talked into serving it.
- [x] `page.tsx` is now a two-line switch; `DiscreteFeed.tsx` is the old shell, moved unchanged.
- [x] `ContinuousFeed.tsx` — `scroll-snap-type: y mandatory`, `scroll-snap-stop: always` on every
      item, one scroller-height each, `tabindex=0` and an `aria-label` so a keyboard reader can
      reach it, overlays hoisted out of the scroller, the document itself never scrolling.
- [x] Commit on arrival: one IntersectionObserver, `threshold: [0, 0.75]`, with a 300 ms settle.
      Two signals from it — `active` immediate so the chrome never lags the finger, `commit` settled
      so the trail follows the reader.
- [x] `commitAt` in `feedqueue.ts` (+6 tests): commits in order and hands back any cards a flick
      jumped over, so the trail records what was READ whatever the platform does.
- [x] Threads for the active card and **exactly one ahead**, never for every rendered card.
- [x] Nested scrolling: `overscroll-behavior-y: auto` via a new `scrollChaining` prop on `CardView`.
      Verified at both viewports: reading mid-article does not drift you off the card, and reaching
      its end lets you carry on.
- [x] Keyboard: one key, one card (native key scrolling moves ~40 px and mandatory snap drags it
      straight back, so arrows would look dead without this). `1`/`2`/`3` still pull.
- [x] Steering: thread pull, realm cross, focus release and orbit all void the queue, hand the
      cards back to the buffer, and rebuild — **after** the move lands, never during.
- [x] The ♥ insert, which never overwrites anything the reader has begun to reveal.
- [x] `FILL_BACKOFF_MS` — see the log entry. The continuous feed retries a failing source far
      harder than the old one did, and that had to be stopped.

---

## Phases 5 + 6 — forks, re-entry and endings ✅ COMPLETE

- [x] **Deferred images.** `CardView` loads the full-size picture for the active card and its
      neighbours only; the hotlinked preview stands in elsewhere. Gated on the URL
      (`startsWith("/api/")`), not the realm — a Wikipedia thumbnail is hotlinked and cheap, so it
      is never deferred.
- [x] **`ways`, `onWay` and `revisiting`** wired for the active card. A revisited card now says
      "Another way from here"; a fork offers its switch.
- [x] **Forking from a revisited stop.** A fork REPLACES the line below the fork rather than
      lengthening it (`step:2` becomes `step:3`), which is exactly what made the first test of it
      look like a failure.
- [x] **Re-entry**: `?continue=` lands on the tip, `?from=<stop>` on that stop.
- [x] **The terminus card** (`src/components/TerminusCard.tsx`) — `pool-dry`, `caught-up`,
      `day-done`, replacing the transient toasts, which are now suppressed for the queue.
- [x] **The auto-snap, with its guard.** The reader is carried onto the ending only if they are
      already on the last card. Somebody scrolled up re-reading is never dragged to the bottom.
- [x] **Ads** as their own queue item, counted on COMMIT rather than on materialise.
- [x] **The tour**: `CardView` emits its `data-tour` and `data-drift-scroll` markers only when it
      is the active card, and `holdNav` freezes the scroller with `overflow: hidden`.
- [x] **`npm run verify:feed`** — 53/53 at both viewports.
- [x] Build, lint, 1,415 tests, contrast (standing gate plus the new card measured separately).

---

## Phase 7 — Prove it, then tell the truth about it ✅ COMPLETE

The last phase. One feed, four surfaces that describe it honestly, and two harnesses that
measure the app that actually exists.

- [x] **Retired the discrete shell.** `DiscreteFeed.tsx`, `lib/feedmode.ts` and its tests, the
      `?feed=classic` override, the flag in `.env.local.example`, and the `THE FLAG` section of
      `verify:feed` (67 checks → 65). `page.tsx` is now nothing but the Suspense boundary the
      engine's `useSearchParams` needs.
- [x] **Removed what only that shell used**, rather than leaving it exported and uncalled — the
      shape the pre-Phase-7 audit found three times in `feedqueue`. `FeedBottomNav` and its
      `data-feed-nav` rule; `edgesOf` / `resolveSwipe` / `isWheelReadingScroll` in `lib/gesture.ts`
      with their tests (`resolveHorizontalSwipe` stays — the realm cross still uses it); and nine
      names off the engine (`advance`, `goBack`, `isBusy`, `showAd`, `dir`, `ways`, `current`,
      `threads`, `threadsLoading`, `dayIsSpent`), plus `doDrift`, which only `advance` called.
      ⚠️ `threads` and `current` are still COMPUTED — `nextDriftCard`'s degraded fallback reads
      `threads` from render scope, which is audit finding 11 — only their exports are gone.
- [x] **Updated `scripts/bots/` and the fidelity gates.** The browser driver was not "drifted", it
      was **dead**: see the log entry. `bot-http.mjs` now models the queue, the one-ahead
      lookahead and the void-on-thread-pull; `QUEUE_AHEAD` is pinned by importing
      `src/lib/feedqueue.ts` rather than scraping it.
- [x] **Rewrote the four promise surfaces**, published and internal, and deliberately not the same
      way. See the decision log and `docs/continuous-feed.md` §3.1.
- [x] **Gave the contrast audit a focus route** (`/drift?focus=field&bucket=architecture`) and
      repointed its `branchInFeed` row from clicking "Previous stop" to pressing ArrowUp.
- [x] **Fixed the two pre-existing bugs that work uncovered**: the focus banner's 4.42:1 "Drift
      freely" (a nested tint on the release button) and `StorageNotice` swallowing the click on
      "Save trail".
- [x] **`CLAUDE.md` §12** is the feed's map for anyone who never reads `docs/continuous-feed.md`;
      §2.2 records the reversal, §6 drops the motion sentence, §7 lists `verify:feed`.
- [ ] **Full load rehearsal**: 25 readers, both realms, against the local production rig. Compare
      Met requests, 403s and breaker trips against the 96-requests / zero-403s Gallery baseline,
      and re-measure Wikimedia calls per card for `docs/beta-readiness.md` (currently ≈2.4, which
      predates the scroller).
- [ ] **Measure the new retry ladder against a THROTTLING Met.** Every failure probe in the
      pre-Phase-7 audit used Wikipedia routes. The rehearsal above is where this gets settled;
      `rig.mjs` already counts throttles per host and breaker openings from the instance logs.
- [x] Fold this branch's status into `plan.md` and add a progress-log entry there.

---

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-08-28 | Branch `continuous-feed` off `main` at `4d21047` | Owner asked for the main line to stay unaffected. |
| 2026-08-28 | `plan.md` and `CLAUDE.md` left untouched on this branch | They are `main`'s source of truth; editing them here guarantees a conflict. Phase 7 folds the result back. |
| 2026-08-28 | Queue depth **3**, not 5 | One screen of lookahead plus two; keeps a Gallery rebuild inside the Met's 30-per-15s burst allowance; keeps the floor of the feed visible, which is the §2 argument. `docs/continuous-feed.md` §7.4. |
| 2026-08-28 | `content-visibility: auto`, not unmount-based virtualization | Uniform item height plus skipped off-screen rendering gives the win with none of the scroll-jump risk that breaks react-window under scroll snap. §4.2. |
| 2026-08-28 | Commit at 75% visibility **plus a settle window** | `scroll-snap-stop: always` stops a fling at every card, so visibility alone would record six stops from one gesture. §6.2. |
| 2026-08-28 | Threads and the doorway: current card and **one ahead only** | All-N would take a Gallery screenful from ~9 to ~45 Met requests against a ~80-per-30s bucket. This is the one way to genuinely break the app. §7.2. |
| 2026-08-28 | Phase 0 ships to `main` independently | It needs no principle change and it measures whether the rest is even needed. |
| 2026-08-29 | **Remove the flag and the old shell entirely**, no escape hatch | Owner's call. A switch nobody will flip is dead weight, and two shells over one engine is a gate that has to stay green twice, forever. |
| 2026-08-29 | **Published pages: remove the broken promises, say nothing about the new mechanism** | Owner's call, and the right one for a reader: `/principles` and `/how-it-works` describe the app, not its changelog. A page that explains why it used to say something else is a page about itself. |
| 2026-08-29 | **Internal docs: the opposite — keep the old wording visible under a ⚠️** | `CLAUDE.md` and `drift-spec.md` are instructions to future sessions. A session that reads "Prefetch at most 1 card ahead" will "fix" the queue out of existence, which is exactly what `CLAUDE.md §1` keeps stale text visible to prevent. |
| 2026-08-29 | **Strip the engine's dead exports too**, not just delete the shell | The pre-Phase-7 audit's own lesson: an exported, tested, uncalled `isCandidate` is worse than no defence, because its presence stops the next person looking. Nine names went; the ones still used INSIDE the hook stayed. |
| 2026-08-29 | Fix the two pre-existing `main` bugs here | Not scope creep in the end: adding the focus route to the contrast audit turns the 4.42:1 banner failure into a red gate, so the fix is required by the phase. The `StorageNotice` one is a line, and it stands between a first-time reader and saving their first trail. |

## Open questions for the owner — all three answered

1. **The peek.** ✅ Accepted, and shaped rather than removed. The `SEAM` constant in
   `ContinuousFeed.tsx` is the decision: a band of paper between cards, so what you see mid-drag
   is the next card's top edge rather than a readable slice of it. Edge to edge would have been
   the shape of the feeds Drift exists to be an antidote to.
2. **Where should the day's end live?** ✅ Inside the feed, as a card you scroll into
   (`TerminusCard`). It answers "why did it stop?" in the place the question is actually asked —
   the bottom — instead of as a toast over the middle of whatever you were reading.
3. **Ship both feeds, or replace?** ✅ **Replace.** Decided 28 August, executed in Phase 7. There
   is one feed and no flag.

---

## Progress log

### Phase 0 — instant stops on the discrete feed (2026-08-28)

The ask was "make swiping seamless, it should not load each time". Reading the feed first showed
the premise was mostly wrong: `randomBufferRef` already holds up to 12 cards and a drift normally
costs no network call at all. So the question became *what does* cost the time, and that was
measured rather than argued.

It was not what anyone expected. The picture was already ready as soon as the transition settled,
within 2 ms of the title, in both realms. The **thread chips** were the wait: 3.3 seconds at the
median in the Encyclopedia. And **530 ms of every single stop was animation**, identical in both
realms and unaffected by the network or by a warm buffer.

Four changes, in the order the numbers put them:

1. Prepare the next buffered card's chips and picture, **one card only**, on a 1.2 s dwell timer so
   a fast reader never pays for work they will not use.
2. Keep **at most one threads request in flight per card**, so a reader arriving before the
   preparation lands adopts it instead of starting a second identical one. Without this the
   preparation was pure waste for anyone moving quickly: 14 `/related` and 15 `/doorway` over 13
   cards where 12 and 12 were needed. This is the piece to remember. Anything that prefetches from
   here on must go through `threadsFor`.
3. Warm the next picture, but **only what the browser hotlinks**. `/api/img/met/...` is our own
   proxy, and a cold miss there is a function invocation plus a multi-megabyte original from a host
   with its own gate and breaker. That is not something to spend on a card nobody may open.
4. Retune the transition and honour `prefers-reduced-motion`, which motion/react does not do on its
   own.

Result, at reading pace: **everything lands together in about 150 ms**, at exactly the same
upstream cost, 1.0 `/related` and 1.0 `/doorway` per card before and after.

Two smaller things fell out of it. The background buffer top-up now runs outside the busy lock and
is stamped with the realm and focus it was started under, because otherwise a slow refill could
land after `releaseFocus` and quietly re-seed the feed with cards from a focus the reader had
already let go of. And the old abort-on-cleanup was removed: our API routes do not forward
`request.signal`, so aborting never cancelled anything upstream. It only threw away an answer we
had already paid for, and the in-flight map covers the StrictMode double-invoke it also guarded.

**What this does not fix, and the honest reason the project continues:** the gesture is still
discrete. You swipe, you release, and then the app moves. It is fast now, but it is never 1:1 with
your finger, and that is what "seamless like a social feed" actually means. Only the scroller
delivers that, which is Phases 1 to 7.

### Phases 1 and 2 — the groundwork (2026-08-28)

Two phases with nothing to look at, which is the point: after them the app behaves exactly as it
did before, and the scroller has somewhere to stand.

**Phase 1** split `drift/page.tsx` in three. The rule used to decide what went where is worth
keeping: *if it decides WHAT the reader sees it is the engine; if it decides HOW it appears it is a
shell.* So the session-load effect, the branch model, the focus stack, the buffers and pools, the
threads, the meter and every move went into `useDriftSession`; the gestures, the keyboard, the
spring and the markup stayed.

The extraction was done by slicing the file rather than retyping it, and the shell destructures the
hook in a single statement so **every line of JSX is unchanged**. That was chosen deliberately over
a tidier grouped return (`{ session, nav, focus }`): the entire value of this phase is that it
provably changed nothing, and a diff whose 230 lines of markup are untouched is one a person can
actually check.

Two things are exposed as functions rather than as refs, because a ref on a hook's public surface
becomes permanent the moment anyone uses it. `isBusy()` is the interesting one: the wheel handler
needs the busy flag *synchronously*, not the `advancing` state one render behind it, or a fast
wheel slips an extra tick into the gap.

**The load-bot fidelity gate did its job.** `loadbot.test.ts` reads `REFILL_TOPICS`,
`DISCOVER_LIMIT` and `SEED_LIMIT` straight out of the feed's source to pin the bot harness against
the app; the constants moved and it went red immediately. That is exactly the failure CLAUDE.md §11
built it for. It is re-pointed at `useDriftSession.ts`, with a note not to relax the regex into
something that can silently match nothing.

**Phase 2** built `src/lib/feedqueue.ts`, and one design decision in it is worth recording because
it removes a hazard rather than managing one. The plan called for a separate set of "pending" card
ids, added on materialise and released on discard, and `docs/continuous-feed.md` §8.7 called that
set the likeliest bug in the whole project: forget to release and the card is denied forever (and
`persistSeen` makes that durable); release twice and it is queued twice. `pendingIds` instead
**derives** the spoken-for ids from the queue itself. Dropping an item is releasing its id, in the
same statement, and the two cannot drift apart because there is only one of them.

`invalidateQueue` also hands back the cards it dropped rather than discarding them. They cost real
upstream requests, and returning them to the discover buffer is the difference between a thread
pull being free and it costing three cards of the Met's daily budget.

**Verification.** 30 checks in a real browser across every entry point (four seed kinds, five focus
kinds, drift / thread / back / forward / rail jump / branch from a revisited stop / the ways switch
at a fork / realm cross both ways, the exit screen with save, rename, like and export, and re-entry
by `?continue=` and `?from=`), zero console errors, and the Phase 0 numbers re-measured unchanged.

Three checks failed on the first pass and all three were the test lying, not the app: two used
invented bucket slugs, and one looked for the ways switch with `.first()`, which resolves to the
phone copy that is `md:hidden` on a desktop viewport. Worth remembering — a browser check that
fails is a claim about the test as much as about the code.

**One real bug found, and deliberately not fixed.** `StorageNotice` is `fixed bottom-safe z-40`;
the exit screen is `absolute inset-0 z-20`. On a 1280x900 viewport the notice sits over "Save
trail" and swallows the click, so a first-time reader who has not dismissed it cannot save their
first trail. Both files are byte-identical to `main`, so it is pre-existing and out of scope here,
but it is a one-line fix worth making on `main`.

### Phases 3 and 4 — the scroller (2026-08-28)

The feed you can actually scroll. `scroll-snap-type: y mandatory` with `scroll-snap-stop: always`,
one card per screen, a bounded three-card queue below the tip, and a commit that happens when the
reader arrives rather than when the card is created.

Four bugs were found by measuring, and each one is now a comment at the place it matters. They are
worth reading before touching this code, because none of them would have been found by reading it.

**A background refill must not take the engine's busy lock.** `busyRef` is what stops a second move
starting while one is in flight, so `crossRealm`, `onThread` and `goBack` all early-return while it
is set. In a card-at-a-time feed that is exactly right, because a refill only ever happens inside
the move the reader is waiting on. This shell tops the queue up constantly, so the lock was set most
of the time and **tapping "Cross to the Gallery" silently did nothing**. `nextDriftCard` now takes a
`background` flag.

**The engine derives the realm during render.** So a refill fired immediately after `await
crossRealm()` still saw the realm we had just left, and stacked three Encyclopedia cards under a
Gallery card. The refill has to be deferred to an effect that runs after the render which makes the
new realm true — hence the steer tick, which looks like ceremony and is not.

**The continuous feed retries a failing source much harder than the old one did**, because its
refill runs from an effect rather than from a swipe. Measured against a Met that was already
refusing: **2.62 discover calls per card, against 0.54 once the museum had rested.** Retrying
hardest exactly when a source is asking us to stop is backwards, and it is how a brief throttle
becomes a shrunk daily budget (CLAUDE.md §4). `FILL_BACKOFF_MS` leaves it alone for four seconds
after an empty answer; a deliberate steer clears the cooldown, because the reader has just asked for
something different.

**Key the item on the card, not on the slot.** A slot key changes from `queued:…` to `step:…` the
instant a card commits, so keying on it unmounts and remounts the card at exactly that moment: a
flash and a re-fetched image on every stop.

**The windowing question is settled, for now.** At 26 committed cards the DOM holds 29 slots, 3,394
nodes, 54 images and 11 MB of heap. Neither `content-visibility` nor placeholder windowing is worth
its risk at this size, so neither was built. Uniform item height keeps both doors open.

**Cost.** 1.15 `/related` and 1.15 `/doorway` per committed card over 26 cards. The excess over 1.00
is the lookahead that has not been consumed yet, and it amortises with session length (1.31 over 13
cards, 1.15 over 26). There are **no duplicate requests** — measured directly, 15 asks across 14
cards the reader could reach, with one orphan from a skipped card that went back to the buffer.

**What could not be verified: iOS.** WebKit has historically sent a hard flick to the end of a snap
container instead of stopping at the next item, and it disables momentum scrolling under mandatory
snap. `scroll-snap-stop: always` is the documented fix and has been Baseline since July 2022, but
there is no device here to prove it. The design deliberately does not depend on it: `commitAt`
returns any skipped cards to the buffer uncommitted, so the trail stays a record of what was read
whatever the platform does. It still wants trying on a real phone.

**Three of the first browser failures were the test lying, not the app** — invented bucket slugs, a
`.first()` that resolved to the phone copy of a component that is `md:hidden` on desktop, and a
click on the `data-tour` container that holds "Read more" *and* the source link, which lands in the
gap between them. A browser check that fails is a claim about the test as much as about the code.

**A second harness that assumes the old feed.** The contrast audit's `endTrail` and `branchInFeed`
rows walk the feed by clicking "Previous stop" and by taking `[data-tour="card-threads"] button`
`.first()`. The scroller renders no bottom nav (going back is scrolling up) and keeps four cards in
the DOM at once, so those selectors either miss or hit the wrong card, and each miss costs a 30
second Playwright timeout. Against a continuous build the audit ran for over twenty minutes and
proved less than it looked like it did. The standing gate is unaffected while the flag is off, and
updating it belongs with the load-bot work in Phase 7 — but it is worth knowing before someone
points the audit at a continuous build and trusts the PASS.

**And it found a real bug on the way, in the old feed.** Measured with the audit's own code against
four feed views: "Drift freely" in the focus banner is **4.42:1 in the light theme, under the 4.5
bar**. It reproduces identically with the flag off, so it is not this branch's doing. The cause is
tint stacking, which `CLAUDE.md` §10 warns static token maths cannot catch: the banner pill is
`bg-accent/12`, the release button inside it adds `bg-accent/10`, and the label ends up on about
accent/21 over paper rather than accent/12. It has never been caught because the audit's route list
renders no view with a focus banner at all. Two fixes, both for `main`: drop the nested tint from
the release button, and add one focus route to `ROUTES` so the class of bug stops being invisible.

### Phases 5 and 6 — the occasional half (2026-08-28)

The half a reader only meets sometimes, which is the half that survives hand testing unnoticed.
Four bugs, and the interesting thing is that three of them were invisible to every gate we had.

**A ref cannot trigger a render, and that is why the ending never appeared.** The feed recorded "a
refill came back empty" in a ref, because the backoff needs to read it synchronously. But the
effect that places the ending card had nothing to fire on: the queue length never changed (it was
already zero) and refs do not re-render. It is a ref *and* a counter now, and the comment says why
both.

**A fork does not lengthen the line, it replaces it.** `step:0 | step:1 | step:2` becomes
`step:0 | step:1 | step:3`. Counting step slots to prove a fork happened therefore proves nothing,
and made a working feature look broken for a while. The trail's own counter is the honest measure.

**`.first()` is a trap here, twice over**, and it caught me three separate times: the card renders
its threads twice (pinned for desktop, inlined for phone, one of them always `md:hidden`), and four
cards are in the DOM at once. It also explains two tour bugs — `TourOverlay` spotlighted the topmost
card rather than the one being read, and the "swipe up" step scrolled the wrong card's reading
region. `CardView` now emits its `data-tour` and `data-drift-scroll` markers only when it is the
active card, which fixes every card-scoped step at once and makes the load bots' `.first()` resolve
to the right card too.

**The Gallery cold start was an image burst.** Four cards render at once and a Gallery card's
full-size image comes through our own proxy, which fetches a multi-megabyte original each — four
concurrent sharp resizes where the old feed asked for one. The heavy image is now loaded for the
active card and its neighbours only. The rule is asymmetric on purpose and tests the URL rather
than the realm: a Wikipedia thumbnail is hotlinked by the browser and costs us nothing.

**The ending, and the one time this feed moves on its own.** A dry pool used to fire a toast
wherever the reader happened to be standing, which is the wrong place to answer "why did it stop?" —
that question is asked at the bottom. It is a card now, and the scroller ends on it. The reader is
carried onto it, **but only if they are already on the last card**: somebody scrolled up re-reading
an earlier stop is never dragged to the bottom. That guard is what keeps the move honest, because it
means the feed is never advancing anyone *through* content, only showing them the exit.

**`npm run verify:feed`.** Ad-hoc scripts do not survive a session, and this feed's failure modes
are all in the wiring between the engine, the scroller and the observer — where no unit test
reaches. So the checks are committed: 53 of them, at two viewports, including endings forced by
answering discover *and* the thread fallback with an empty list (blocking only discover does not dry
the feed, because falling back to a thread neighbour is deliberate and correct). It also retries a
Gallery view once after a pause and says "upstream would not answer" rather than "failed", so the
next person does not spend an hour chasing the museum's rate limiter.

### The pre-Phase-7 audit (2026-08-29)

Before retiring the old feed, the new one was pulled apart deliberately. The reasoning was that
every gate we have was green, and every gate we have walks the paths a working feed walks: open
it, drift, pull a thread, cross, end. So the audit went at the three kinds of place a gate does
not reach — **a source that fails rather than answers, a reader parked somewhere unusual, and a
keyboard** — and found six bugs in about an hour. Two of them were serious enough that the feed
was not shippable.

**Four of the six are the same mistake in different clothes, and that is the thing to remember.**
A card-at-a-time feed runs from gestures: something is always about to happen because a thumb is
about to move. A continuous feed runs from **effects**, and an effect that nothing can fire is a
dead branch that looks like working code.

- **One empty refill ended the feed forever.** `fill` stamped a backoff and returned; the effect
  that would call it again fires on the queue changing, on a steer and on the day's capacity, and
  none of those happens while the feed sits empty. Measured: with the upstream answering 503 the
  scroller read `step:0 | terminus:pool-dry` within six seconds — *"you have read this area dry"*,
  on a free drift over the whole of Wikipedia — and after the source recovered it was still that,
  fifteen seconds and four ArrowDowns later. Only a steer escaped.
- **`fill` was memoised on `[capacity]`, which never changes for an unmetered reader**, so it kept
  the engine object from the render it was built in for the entire session. The old comment said
  the engine's functions "read refs", and most of them do — but `nextDriftCard`'s degraded
  fallback, the random untapped thread that keeps the feed alive while discover is throttled,
  reads `threads` from the render scope. Pinned to a session's first render that list is empty,
  because the seed's chips have not arrived. So with discover answering `[]` and `related`
  perfectly healthy, the fallback fired **zero** times and the feed simply stopped. Worse,
  `verify-feed.mjs` asserted the opposite in a comment, which is why nobody looked.

The other four:

- **A card could be appended after the ending card** — `fill` pushed onto the end of the queue
  whatever was in it. Measured: `step:0 | queued:met:254779 | terminus:pool-dry | queued:… |
  queued:…`, a reader scrolling past "you have read this area dry" into two more cards.
- **The queue was refilled for the stop the reader was standing on, not the tip it hangs below.**
  The engine derives realm, focus and fallback threads from `pos`. Cross to the Gallery, scroll up
  three, and the session reads as Encyclopedia again with three Met cards queued under a Gallery
  tip; a ♥ up there proved the wake-up path was live, putting `queued:wikipedia:Cephalopod` on top
  of them, four deep against a capacity of three.
- **Tab carried a keyboard reader down the feed.** Four cards are laid out at once and the browser
  scrolls focus into view, so tabbing off the active card's last chip walked into the queue and
  moved the reader three cards on, committing each.
- **Three of `feedqueue`'s exports were wired to nothing**, including `pendingIds` — which this
  very file calls the fix for "the likeliest bug in the whole project" — and `isCandidate`, which
  was exported, unit-tested and called from nowhere at all.

**What was done about it**, and the three shapes worth copying:

1. **A pause is a different sentence from an ending.** A fourth terminus, `source-quiet`: "The
   source is catching its breath." It is the only one that retries (doubling backoff, capped at
   60 s), the only one that clears itself when a card arrives, the only one with a "Try again"
   button, and the only one nobody is ever auto-snapped onto — because a pause is not an exit, and
   because leaving the reader on their last real card is what lets the retry replace the ending
   rather than the card under their eye. The engine can tell the two apart now:
   `fetchDiscoverBatch` records whether **any** of its parallel picks got an answer at all, which
   is a different question from whether it liked the answer.
2. **No ending at all until the refill has come back empty twice.** "Empty right now" is not
   "empty", and the first refill of a session is the clearest case: it runs before the chips the
   fallback needs have arrived. A spent day is the exception, because that is a fact we hold
   rather than an answer we are waiting for.
3. **The queue continues the TIP, so only the tip fills it** — and only a ♥ at the tip may steer
   it. This has a visible consequence that is a small product change, not just a fix: **the feed
   now fetches nothing at all while somebody is scrolled up re-reading.** That is cheaper, it is
   less speculative, and it is more in the direction of §2 than what it replaced. It also removed
   the premise of one existing check (the old auto-snap guard forced an ending while the reader
   was parked, and that moment no longer exists), so that check was rewritten around the property
   that actually holds.

Plus: `inert` on every card but the active one; `pendingIds` wired where cards actually enter the
queue (the duplicate it guards is real — the fallback picks from a fixed set of three or four, and
two rounds of one fill can name the same card, colliding on the React key *and* the `data-slot`
the observer commits by); `trimToCapacity` wired into the fill effect so invariant 7 is a property
rather than a hope; `isCandidate` deleted; ads given a stable id so a shifting queue stops
remounting them (harmless for the house placeholder, a repeat impression request in `adsense`
mode); the terminus's "Go wider" button removed, because it called the same function as "Drift
freely" and every widening ladder is already climbed inside refill before an ending is placed.

**Three things were checked and found sound**, recorded so nobody re-derives them: the guided tour
runs clean end to end on the scroller, every forced step advancing; the ad interstitial's spacing
is correct, and the browser's snap re-targeting keeps the reader on the right card when an item
above them is removed; and nothing uncommitted ever reaches the `seen` store.

**Gates.** Build clean, lint clean with zero warnings, 1,416 unit tests, `audit:contrast` PASS
against a flag-off build (3,905 nodes, 32 views x 2 themes), the two ending cards measured
separately at 4.53:1 light and 5.99:1 dark, and `verify:feed` at both viewports — 67 checks each,
up from 53, with two new sections (`A SOURCE THAT WILL NOT ANSWER`, `KEYBOARD FOCUS ORDER`). Cost
per card unchanged: 1.40 `/related`, 1.40 `/doorway`, 0.60 discover.

⚠️ **The first full both-viewport run came back 132/134, and both failures were The Met.** It was
sharing the machine with `audit:contrast`, which also opens Gallery views; the server log said
`circuit OPEN after 5 consecutive throttles`, and `crossRealm` was right to decline to land on
nothing. The check now retries once and names the cause. Do not run the two suites together.

**What this did not cover, said plainly.** No iOS device, so the WebKit flick is still unverified.
`day-done` still needs an account and a backend to exercise end to end. And every failure probe
used Wikipedia routes: the new retry ladder is strictly gentler than what shipped (it only runs
when a source did not answer at all, and it doubles to a 60 s cap), but it has not been measured
against a throttling Met. That belongs with Phase 7's load rehearsal.

### Phase 7 — one feed, and four surfaces that describe it (2026-08-29)

The last phase, and almost none of it was feature work. It was the cost of the old feed still being
in the building: a shell that had to keep passing every gate, two published pages promising things
the app no longer did, and two harnesses that would have measured the wrong app while reporting
success.

**The browser load bots were not "drifted" — they were dead, and they failed as a false accusation.**
This is the finding worth carrying. `bot-browser.mjs` proved a move had landed by reading `main h1`
and taking `.first()`. In a scroller that is the first stop of the session, forever. Measured
against the real feed:

```
before:            Volcano
after ArrowDown 1: Volcano
after ArrowDown 2: Volcano
after ArrowDown 3: Volcano       ← the reader was on "Glacier"
```

So every browser bot would press three times, record `card did not advance` and end
`stopped advancing` on its first move. A completely healthy app, scored as broken, by the driver
that exists precisely to **calibrate** the volume bots — and the volume bots would have gone on
producing confident numbers with nothing checking them. It reads the active slot now, by the
scroller's own `scrollTop / clientHeight` geometry, which is the same expression `verify-feed.mjs`
uses so there is one way to ask the question rather than two that can disagree. Chip counting was
doubled too (8 for four chips: the card renders its threads twice, one copy always `md:hidden`).

**`bot-http.mjs` had to grow a queue.** Not cosmetic: without the queue, the one-ahead lookahead and
the void-on-thread-pull, it would model 1.00 `/related` per card where the app measures 1.36, and
0.5 discover where the app measures 0.27. Wrong in both directions at once, and confidently.
`QUEUE_AHEAD` joined the pinned constants, and `loadbot.test.ts` pins it by **importing**
`src/lib/feedqueue.ts` rather than scraping a regex out of a file — a direct comparison cannot
silently match nothing, which is the failure mode the three scraped constants have to guard against
by hand.

**The promise surfaces got two different treatments, and the split was deliberate.** Published pages
(`/principles` §2, `/how-it-works`) simply lost the promises we cannot keep — "no card sliding
partway into view", "No queue of preloaded cards (it shows you at most one ahead)" — with nothing
added about queues or scrolling. That was the owner's call and it is the right one: a reader wants a
page that is true, not a page about itself. Two more stale claims went with them, found on the way:
"press the drift button" (there is no button) and "pulling one moves you sideways" (there is no
sideways). The internal documents got the opposite: `CLAUDE.md §2.2` and §6, and `drift-spec.md`
§2.2/§7, keep the superseded wording visible under a ⚠️ and say what replaced it — because a session
that reads "Prefetch at most 1 card ahead" will "fix" the queue out of existence, which is exactly
what `CLAUDE.md §1` keeps stale text visible to prevent.

**The engine was stripped, not just orphaned.** Nine exports went with the shell that consumed them
(`advance`, `goBack`, `isBusy`, `showAd`, `dir`, `ways`, `current`, `threads`, `threadsLoading`,
`dayIsSpent`), plus `doDrift`, which only `advance` called. The audit's own lesson made this
non-optional: an exported, unit-tested, uncalled function is worse than no defence, because its
presence stops the next person looking. ⚠️ **`threads` and `current` are still computed** — the
degraded fallback in `nextDriftCard` reads `threads` from render scope, which is audit finding 11 —
only their exports are gone. `doDrift`'s absence is now a comment explaining that it *was*
`nextDriftCard` plus `pushStep` in one breath, which is exactly the fusion a queue has to split.

**Two pre-existing `main` bugs were fixed because this work uncovered them, and one was required.**
Adding a focus route to the contrast audit turns the banner's 4.42:1 "Drift freely" into a red gate,
so the fix shipped with the route: the release button's `bg-accent/10` was stacking on the pill's
`bg-accent/12`. Re-measured after: **5.69:1**. The other was `StorageNotice` (`z-40`) sitting over
the exit screen's "Save trail" (`z-20`), so a first-time reader could not save their first trail.
Hit-tested before and after: the element at the centre of the button was the notice, and is now the
button. It hides while the exit screen is open, exactly as it already did for the guided tour, and
comes back when the screen closes — so the disclosure is deferred by a moment, never skipped.

**What was verified, and how.** Build clean, lint clean with zero warnings, 1,394 tests,
`verify:feed` **130/130** at both viewports (65 each, down from 67 with `THE FLAG` gone),
`audit:contrast` **PASS** at 5,014 nodes over 33 views x 2 themes — this time against a
**continuous** build, because there is no other kind. Cost per card re-measured identical before and
after the engine strip. The focus banner and the storage notice were each measured directly rather
than inferred from the suite passing.

**What was not.** The load rehearsal. The harness is correct now, but the 25-reader run has not
happened, so `docs/beta-readiness.md`'s ≈2.4 Wikimedia calls per card still describes the old feed
and the retry ladder is still unmeasured against a throttling museum. It is stated as open rather
than quietly rounded off, because a number in that file is one somebody will quote.
