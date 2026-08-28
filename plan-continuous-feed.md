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

> ## Current status: 2026-08-28
>
> ✅ **Phases 0, 1 and 2 are COMPLETE.**
>
> - **Phase 0** made the existing feed fast: a whole stop lands in ~150 ms instead of 530 to
>   3,350 ms, at no extra upstream cost.
> - **Phase 1** split the 2,850-line feed into `useDriftSession` (the engine, 2,362 lines),
>   `page.tsx` (the card-at-a-time shell, 549) and `EndOverlay.tsx` (281). Behaviour-neutral,
>   verified 30/30 across every entry point in a real browser, and performance-neutral
>   (145-148 ms, 1.00 `/related` and 1.00 `/doorway` per card, unchanged from Phase 0).
> - **Phase 2** built `src/lib/feedqueue.ts`, the pure two-phase queue the scroller will run on:
>   31 tests, wired to nothing yet.
>
> **Gates:** 1,403 unit tests green (83 files), `npm run build` clean, `npm run lint` clean with
> zero warnings, `npm run audit:contrast` PASS (3,909 nodes, 32 views x 2 themes).
>
> ### ✅ The blocking owner decision has been taken
>
> The scroller **goes ahead**, and `CLAUDE.md §2.2`, `drift-spec.md §2.2`/§7, `/principles` §2 and
> `/how-it-works` **will be rewritten** to say what the app really does, rather than the feature
> being bent to fit words written before it existed. That rewrite ships **with** the feed in
> Phase 7, never after it. See `docs/continuous-feed.md` §3.
>
> The separate one-word inaccuracy is already fixed: both published pages said Drift "fetches at
> most one card ahead", which was untrue the day it was written (the buffer holds up to 12). They
> now say "shows you". That was **not** the four-surface rewrite; that is still to come.
>
> ### 🟡 One pre-existing bug found while verifying, NOT fixed (out of scope)
>
> **`StorageNotice` covers the "Save trail" button on the exit screen.** The notice is
> `fixed bottom-safe z-40`; the end overlay is `absolute inset-0 z-20`. On a 1280x900 viewport the
> notice sits over the Save button and swallows the click, so a first-time reader who has not
> dismissed it cannot save their first trail. Confirmed pre-existing: both files are byte-identical
> to `main`. Found because Playwright reports an intercepted click where a human would just think
> the button was broken. Worth a one-line z-index fix on `main`.
>
> ### What these phases taught the rest of the project
>
> 1. **Measure first.** Phase 0 was planned images-first on reasoning; the numbers said chips-first.
> 2. **Preparing a card ahead is only free if a reader arriving mid-flight ADOPTS the request
>    already running.** Anything that prefetches must go through `threadsFor`.
> 3. **A separate "pending" set is unnecessary and was going to be the project's worst bug.**
>    `feedqueue.pendingIds` DERIVES the spoken-for ids from the queue itself, so dropping an item
>    releases its id in the same statement. This is a deliberate improvement on the plan, which
>    had `invalidateQueue` returning a list of ids to release by hand.
> 4. **Discarded queued cards are handed back, not thrown away.** They cost real upstream requests,
>    so `invalidateQueue` returns them for the caller to return to the discover buffer.
>
> ### ▶ Next
>
> **Phase 3** — the scroller itself, behind `NEXT_PUBLIC_FEED_CONTINUOUS`, drift-only. The first
> thing that can actually be scrolled. It has real unknowns (nested scroll handoff, snap on a
> phone, the commit settle window) that want tuning with the owner rather than deciding alone.

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
- [x] `isCandidate` builds on `lookahead.isServable` instead of repeating it, so the discrete
      feed's buffer and the continuous feed's queue cannot disagree about what a servable card is.
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

## Phase 3 — The scroller, minimum viable, behind `NEXT_PUBLIC_FEED_CONTINUOUS`

Drift-only. No thread pulls, no realm crossing, no focus, no branches, no limits. The point is
to prove the substrate before anything is built on it.

- [ ] `ContinuousFeed` shell: a `h-full` scroller inside the existing `h-dvh overflow-hidden`
      root, `scroll-snap-type: y mandatory`, items at `scroll-snap-align: start` and
      `scroll-snap-stop: always`, each exactly one shell-height.
- [ ] `content-visibility: auto` + `contain-intrinsic-size` on each item. No unmounting-based
      virtualization (`docs/continuous-feed.md` §4.2).
- [ ] The commit observer (`threshold: [0, 0.75]`) driving `commitDecision`, wired to the
      existing `pushStep` half: trail step, `seenRef`, `persistSeen`, `recordStop`, tour signal,
      `doorsLeavingHere`.
- [ ] Refill at the low-water mark, `QUEUE_AHEAD = 3`, from the existing buffer path.
- [ ] Threads + doorway for the current card and **at most one ahead**, on a dwell timer.
      This is the rule that protects the Met (`docs/continuous-feed.md` §7.2).
- [ ] Nested scrolling: `touch-action: pan-y`, `overscroll-behavior-y: contain` on the reading
      region, the desktop wheel handler at the region's bottom edge (§8.11).
- [ ] Overlays hoisted out of the scroller (§8.13).
- [ ] Keyboard: Arrow/Space/PageDown scroll one snap point; `prefers-reduced-motion` respected.
- [ ] **Verify on a real phone**, not only a desktop browser. Snap jitter, momentum and the
      inner/outer scroll handoff are all device-dependent.
- [ ] Measured: upstream requests per committed card, against the Phase 0 baseline.

---

## Phase 4 — Steering: threads, realm crossing, focus, the like-insert

- [ ] Thread pull from the tip: discard the queue, release pending ids, push the step, refill.
- [ ] Realm crossing (horizontal swipe and the top-bar control): same discard, refill in the
      destination realm; the realm invariant replaces `takeBufferedRandom`'s filter.
- [ ] Focus changes (enter a field, anchor an orbit, release, widen an artist ring) discard and
      refill. Verify the banner and the queue can never disagree.
- [ ] The like-insert (`docs/continuous-feed.md` §6.3), including its three edge cases: liking a
      card already scrolled past, liking with an empty queue, liking under a focus (still
      suppressed, deliberately).
- [ ] Pool-served focuses (`current`, `orbit`) refill through `nextFocusedCard` as today,
      including their widening ladders before any terminus is placed.

---

## Phase 5 — Revisiting, branches and re-entry

- [ ] Scrolling up walks `pathTo(tip)`; `pos` follows the observer. Back-nav semantics must
      match `parentOf` exactly, since `path` is built from it.
- [ ] Pulling a thread while revisiting forks; the scroller re-renders as
      `pathTo(tipOf(history, new))`, whose prefix is stable, so `scrollTop` survives
      (`docs/continuous-feed.md` §5.3). Then scroll down exactly one item.
- [ ] The Phase 30 "ways" switch changes the line below the fork without moving the reader.
- [ ] Re-entry: `?continue=`, `?door=<stop>.<door>`, `?from=<stop>` land on the right item with
      no animation, then build the queue below the tip (§8.8).
- [ ] Doors, `dwellMs` and `engagedWith` all fed from the commit observer (§8.4, §8.5).

---

## Phase 6 — Endings: limits, terminus cards, ads, the nudge, the tour

- [ ] `queueCapacity` clamped by `stopsRemaining`; the queue shrinks to zero as the day closes
      and the last card is followed by the trail map, instead of `endSession("limit")` yanking
      the reader out (`docs/continuous-feed.md` §6.2).
- [ ] Terminus items for `pool-dry` and `caught-up`, replacing the transient `showHint` toasts.
- [ ] The ad interstitial as a queue item (§8.2). Off by default; must not be forgotten.
- [ ] The ~25 stop nudge kept as an overlay for now (§8.3). The "pause card" idea is recorded
      there but is deliberately **not** in this phase: it changes the felt product.
- [ ] The tour: `holdNav` freezes the scroller; every `tourSignal` still fires; `data-tour`
      targets stay reachable and are not skipped by `content-visibility`.
- [ ] Accessibility pass (§8.6): `inert` on non-current items, focus order, 2.4.7 at every tab
      stop, and `npm run audit:contrast` PASS on a production build.

---

## Phase 7 — Prove it, then tell the truth about it

- [ ] Update `scripts/bots/` and the `src/lib/loadbot*.test.ts` fidelity gates for the new feed.
      **Until this is done the load rehearsal measures an app nobody is running** (§8.9).
- [ ] Full rehearsal: 25 readers, both realms, against the local production rig. Compare Met
      requests, 403s and breaker trips against the 96-requests / zero-403s Gallery baseline.
- [ ] Re-measure Wikimedia calls per card; update `docs/beta-readiness.md` (currently ≈2.4).
- [ ] Rewrite the four promise surfaces (`CLAUDE.md §2.2`, `drift-spec.md §2.2` and §7,
      `/principles` §2, `/how-it-works`) to say what the app actually does. Not before the
      feed is real, and not after it ships: in the same change.
- [ ] Fold this branch's status into `plan.md` and add a progress-log entry there.
- [ ] Decide the flag's fate: default on, default off, or a per-reader setting.

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

## Open questions for the owner

1. **The peek.** Native 1:1 scrolling means the next card is partly visible mid-drag. There is
   no version of this that does not. Acceptable, or is a peek-free variant (transition only on
   release) wanted, which costs most of the "seamless" feel?
2. **Where should the day's end live?** The queue model can let the reader scroll into the trail
   map. Better than today's abrupt close, but it does put the ending inside the feed.
3. **Ship both feeds, or replace?** The plan assumes both, behind a flag, with the discrete feed
   as the fallback. Keeping both forever is a real maintenance cost.

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
