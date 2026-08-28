# The continuous feed — research, architecture and the decisions it forces

**Branch:** `continuous-feed` (forked from `main` at `4d21047`, 28 August 2026)
**Status:** Phases 0, 1 and 2 shipped. Phases 3 to 7 designed, not built.
**Companion files:** `plan-continuous-feed.md` (the phase tracker) and
`docs/continuous-feed-prompt.md` (paste that into a fresh session to bring it fully up to speed).

This file is the reference for the project. Read it before touching any feed code on this
branch, and before writing a plan of your own. It records what was measured, what was
decided and — more importantly — *why*, so nobody has to rediscover it.

`plan.md` and `CLAUDE.md` are deliberately **not** modified on this branch yet. They are the
main line's source of truth and editing them here would guarantee a merge conflict. The
changes they will eventually need are listed in §3 and tracked in `plan-continuous-feed.md`.

---

## 1. What was actually asked for

> "Currently we have card by card swiping. I would like to make this seamless, just like most
> social media platforms. So you can just swipe to the next card(s) and it does not have to
> load each time."

The proposed mechanism was "load them in per 5, and load the next 5 at the fourth card".

**The mechanism is already there and it is not where the friction is.** That is the single
most important finding in this document, so it goes first.

---

## 2. Where the friction actually comes from (MEASURED, not reasoned)

Drift already buffers ahead. `src/app/(app)/drift/page.tsx` holds `randomBufferRef`, refilled by
`fetchDiscoverBatch` at `REFILL_TOPICS (3) × DISCOVER_LIMIT (4)` = **up to 12 cards of card
metadata at a time**; a bucket seed pulls `SEED_LIMIT` = 12 and `/api/wiki/random` returns ~20. On
a normal drift `takeBufferedRandom()` returns instantly and no network call happens at all.

So the drift *card* is usually already local. To find what actually costs the time, a 12-drift
session was driven in each realm with Playwright against a local production build
(`docs/continuous-feed-prompt.md` step 2 has the recipe). **Median, from keypress:**

| | Encyclopedia | Gallery |
|---|---|---|
| new card's title on screen | **530 ms** | **530 ms** |
| its picture decoded | 532 ms | 531 ms |
| its thread chips ready | **3,347 ms** | **1,847 ms** |
| upstream cost | 48 Wikimedia + 24 Met / 13 cards | 72 Met + 11 Met-image + 23 Wikimedia / 13 cards |

⚠️ **THIS TABLE CORRECTED TWO THINGS THIS DOCUMENT ORIGINALLY ASSERTED, and the corrections are
kept visible because assuming either one again would send the next session at the wrong problem.**

1. **It said the threads fetch happens "after landing". It does not.** The effect keys on
   `displayedId`, which changes in the same render that starts the transition, so it has always
   run *concurrently with* the animation. The chips are still the biggest wait by a wide margin,
   but a prefetch buys the part that outlasts the animation, not the whole fetch.
2. **It predicted the image would be the dominant serial cost. It is not.** `imgMs` and `cardMs`
   are within 2 ms of each other in both realms: the picture is ready as soon as the transition
   settles. The Met's hotlinked `previewUrl` and Wikipedia's thumbnails were already doing their
   job. Phase 0 was reordered because of this.

And a third thing the numbers made obvious: **530 ms of every stop is animation, not loading.** It
is identical in both realms, unchanged by a warm buffer, and unaffected by the network. That is
the single largest per-card delay, and it is cause #1 for the feed feeling like a step rather than
a scroll — no amount of prefetching touches it.

⚠️ **Local has no CDN and production does.** `related`, `doorway`, `discover` and `summary` all
carry `s-maxage=86400`, so in production most of the chip latency above is a CDN hit. These
numbers are the worst case, which is the right thing to optimise against, but do not quote them as
production figures.

### 2.1 What Phase 0 did about it, and what it measured afterwards

Same rig, same method, at a realistic reading pace (a 4-second dwell, still far faster than the
15 s `DOOR_DWELL_MS` treats as engagement):

| median, from keypress | before | after |
|---|---|---|
| title on screen | 530 ms | **146 ms** |
| picture decoded | 531 ms | **147 ms** |
| chips ready (Encyclopedia) | 3,347 ms | **147 ms** |
| chips ready (Gallery) | 1,847 ms | **148 ms** |
| `/api/realm/*/related` per card | 1.0 | **1.0** |
| `/api/doorway` per card | 1.0 | **1.0** |
| visible busy-lock stalls | 1 per 24 drifts | **0** |

Everything now lands together in about 150 ms, and it costs no extra upstream requests.

⚠️ **THE COST NEUTRALITY IS NOT AUTOMATIC — IT TOOK A SECOND FIX, AND THAT FIX IS THE ONE TO
REMEMBER.** Preparing one card ahead gives its chips a head start, but a reader who moved on
*before* the preparation landed used to arrive and start a second identical request. Measured over
13 cards that was 14 `/related` and 15 `/doorway` where 12 and 12 were needed. `threadsFor` now
keeps at most one request in flight per card id, so arriving mid-flight **adopts** the running
request. Any future prefetching must go through that same map or it will silently double the cost.

The same measurement retired the old abort-on-cleanup: our API routes do not forward
`request.signal`, so aborting never cancelled anything upstream. It only threw away an answer we
had already paid for, and the in-flight map covers the StrictMode double-invoke it also guarded.

## 3. ⚠️ The principle collision. Read this before anything else.

This is not a technicality and it is not a wording quibble. **A continuous scroll-snap feed
directly contradicts a principle Drift publishes on two live pages, in words that name the
exact mechanism being proposed.**

`src/app/(app)/principles/page.tsx`, section "2. Agency over autoplay":

> Nothing advances on its own. No autoplay, no timers, **no card sliding partway into view**.
>
> **What this rules out: a deep queue.** Drift fetches at most one card ahead. That is a
> deliberate limit rather than a technical one: a large buffer is what makes a feed feel like
> there is always more waiting, and once twenty cards are ready, stopping starts to feel
> wasteful.

`src/app/(app)/how-it-works/page.tsx`, twice:

> Nothing on a card moves on its own. No autoplay, no countdown, **no next card sliding partway in.**

> **No queue of preloaded cards** (it fetches at most one ahead).

And `CLAUDE.md §2.2` / `drift-spec.md §2.2`:

> **Agency over autoplay** — nothing advances automatically. No autoplay, no infinite
> preloading that teases "just one more." Prefetch **at most 1 card ahead**.

A scroll-snap feed shows the next card sliding partway into view. That is what 1:1 scroll
tracking *is*. It cannot be built without doing the thing those pages say Drift does not do.

### 3.1 This is a decision for the owner, not a blocker

The repository has reversed "never" lines before — accounts, a database, deployment, social
features and payments were all once ruled out in writing, and `plan.md` records each reversal
as a decision. `CLAUDE.md §1` even keeps the stale text visible rather than deleting it,
precisely because a quietly-edited promise is the dangerous kind. So this can change. But it
has to change **first, explicitly, and everywhere**, in the same way `CLAUDE.md §2.5` insists
the four source documents are updated *before* the Papers flag is flipped:

Four surfaces name the promise, and all four must move together:

1. `CLAUDE.md §2.2` (the working rule)
2. `drift-spec.md §2.2` and §7 ("Prefetch at most 1 card ahead")
3. `src/app/(app)/principles/page.tsx` §2 (published, reader-facing)
4. `src/app/(app)/how-it-works/page.tsx` ("A card" and "What Drift does not do") (published)

Shipping the feed without those is shipping two pages that lie to readers about the app they
are reading them in. Under §2 of this project that is a bug, not a documentation debt.

### 3.2 A pre-existing inaccuracy found on the way

`/principles` says Drift "**fetches** at most one card ahead". That is **already not true**
and has not been since the discover buffer landed: a refill fetches up to 12 cards' metadata,
and `/api/wiki/random` returns ~20 at a time.

`CLAUDE.md §2.2` is careful about exactly this distinction ("that rule is about what is
RENDERED, not about how many upstream calls a request makes") but the published page is not:
it says *fetches* where the true claim is *shows*. `/how-it-works` repeats it.

✅ **FIXED in Phase 0.** Both pages now say "shows you at most one card ahead", which is true of
the app as it stands. This was **not** the four-surface rewrite in §3.1 — that is a different,
larger change, it belongs with the scroller, and it is still outstanding.

### 3.3 What can be kept, honestly

A continuous feed does not have to become a slot machine. Three properties survive intact and
one gets *stronger*:

- **Nothing advances automatically.** No autoplay, no timers. Every card still arrives because
  a thumb moved. This is the load-bearing half of principle 2 and it is untouched.
- **Transparency.** Every card still carries its `arrivedVia` chip saying why it is there.
- **Sessions have shape.** The trail map is still at the exit.
- **Stronger:** the queue becomes a **hard, visible floor**. Today nothing stops a reader
  drifting forever; the feed simply fetches more. In the queue model the scroller physically
  ends after N cards and cannot be scrolled past until one commits. "At most N ahead" stops
  being a promise in prose and becomes a property of the geometry, which is the kind of
  guarantee this codebase prefers (compare `searchIds` enforcing Met parameter order centrally
  so no caller can get it wrong).

The honest new wording is something like: *"Nothing advances on its own, and the feed never
holds more than three cards beyond the one you are reading. You can always see where it ends."*

---

## 4. External research, and what we take from each finding

### 4.1 CSS scroll snap is the right substrate, and `scroll-snap-stop: always` is the key property

`scroll-snap-type: y mandatory` on the scroller plus `scroll-snap-align: start` on each item is
the standard way TikTok-style feeds are built on the web. The property that matters most for
*this* app is `scroll-snap-stop: always`, which forces the browser to stop at every snap point
even during a fast fling, so no card can be skipped. Baseline across browsers since July 2022.

**Why it matters here beyond ergonomics:** it is a principled control. A fling that blurs past
six cards is the doomscroll failure mode, and `scroll-snap-stop: always` makes it impossible at
the platform level rather than by JS heuristics. It also keeps the commit accounting honest —
every card is genuinely on screen before it counts as a stop.

The known trap is that **JS virtualization (react-window and friends) fights scroll snap**:
inserting and removing items creates and destroys snap positions under the scroller, which is
what makes those implementations jump. §4.2 is how we avoid ever hitting that.

### 4.2 `content-visibility: auto` gives virtualization without unmounting

`content-visibility: auto` skips layout, paint and compositing for off-screen elements while
keeping their boxes in the layout, and `contain-intrinsic-size` supplies the placeholder size.
Baseline since September 2024 (Chrome 85+, Firefox 125+, Safari 18.1+); ~90%+ global support in
early 2026, and where it is unsupported the page simply renders everything, which is slower but
correct. That degradation profile is exactly what `CLAUDE.md §4` asks of an optional dependency.

**This is the recommendation: do not virtualize by unmounting.** Because every feed item is
*exactly* one viewport tall, off-screen items can be skipped by the browser with no effect on
snap points or scroll offsets. That removes the single hardest problem in the whole project.

If memory pressure ever demands real windowing (a very long session with many Met originals),
uniform item height makes it safe: swap a far-away item's contents for a same-height
placeholder. `scrollTop` cannot shift because nothing changes size.

### 4.3 Prefetch distance: the literature says "one screen ahead", not "five"

The consistent guidance for infinite scroll is to prefetch the *next* thing about a screen
before it is needed (`rootMargin: "100px"`–`"200px"` on an IntersectionObserver sentinel), and
to size the batch from observed behaviour rather than a guessed constant. Nothing in the
research supports a deep queue for content this heavy; deep queues exist for cheap thumbnails.

**We take:** queue depth **3** (see §7 for the arithmetic), not 5, and refill on a low-water
mark rather than at a fixed index.

### 4.4 IntersectionObserver at threshold 0.75 is the right commit signal

The owner's instinct here is correct and matches how impression counting is done generally
(the IAB's viewability rule is the well-known instance of the pattern). `threshold: 0.75` fires
when three quarters of the item is inside the scroller, which for a full-viewport snapped item
means "this card is the one being read".

**We take:** commit at `intersectionRatio >= 0.75`, once per item, plus a small dwell floor so
a fling that is nonetheless stopped by `scroll-snap-stop` at each card does not record six
stops in a second. See §6.2.

### 4.5 Rate limiting: shape the burst, do not just cap the total

Standard guidance (tailor per endpoint, leave headroom, measure and re-tune) is already how
this codebase works — `makeGate(50, { burst: 30, windowMs: 15_000, maxWaitMs: 5_000 })` for the
Met is a textbook rolling-window budget. The relevant lesson for this project is that a bucket
cares about *burst shape*, not totals, which turns out to be the good news in §7.

**Sources**
- [MDN: `scroll-snap-stop`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop) and [MDN: CSS scroll snap](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap)
- [Tailwind: `snap-always`](https://tailwindcss.com/docs/scroll-snap-stop) (this project styles with Tailwind v4)
- [MDN: `content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility), [MDN: `contain-intrinsic-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/contain-intrinsic-size), [web.dev: content-visibility](https://web.dev/articles/content-visibility)
- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Smashing Magazine: Designing better infinite scroll](https://www.smashingmagazine.com/2022/03/designing-better-infinite-scroll/), [Addy Osmani: Infinite scroll without layout shifts](https://addyosmani.com/blog/infinite-scroll-without-layout-shifts/)
- [react-vertical-feed](https://github.com/reinaldosimoes/react-vertical-feed) and [react-tiktok-style-video-scroller](https://github.com/neomavkda3/react-tiktok-style-video-scroller) as reference implementations of the snap + IntersectionObserver pattern
- [Zuplo: API rate limiting best practices](https://zuplo.com/learning-center/10-best-practices-for-api-rate-limiting-in-2026)

---

## 5. The architecture: a two-phase feed

Everything below follows from one idea, and every one of the owner's six questions is answered
by it. **Learn this section and the rest is bookkeeping.**

### 5.1 The idea

Today `pushStep()` does five things in one indivisible moment: append to the trail, mark the
card seen, record a metered stop, signal the tour, and put the card on screen. That fusion is
only possible because exactly one card exists at a time.

A continuous feed must put a card **in the DOM before the reader has seen it**. So the moment
splits in two:

```
  MATERIALISE                                   COMMIT
  ───────────                                   ──────
  a card is chosen and rendered                 the reader actually arrives on it
  into the queue below the tip                  (>=75% visible, briefly held)

  costs: upstream fetch, a DOM node             costs: a trail step, a `seen` entry,
  costs NOT: a trail step, a stop,              a metered stop, a tour signal,
  a `seen` entry, anything persisted            a `doorsLeft` record on the card left
```

**An uncommitted card is not part of the session.** It has not happened. It can be discarded,
reordered or replaced with no trace, because nothing about it was ever written down.

### 5.2 The shape

```
  scroller (scroll-snap-type: y mandatory, one item = 100% of the shell)
  ┌──────────────────────────────────────────────────┐
  │  history[path[0]]   ── committed ── scroll up to revisit
  │  history[path[1]]   ── committed
  │  history[path[2]]   ── committed  ← pos (>=75% visible)
  │  history[path[3]]   ── committed  = tip
  ├───────────────────── the commit boundary ────────┤
  │  queue[0]           ── materialised, NOT in the trail
  │  queue[1]           ── materialised, NOT in the trail
  │  queue[2]           ── materialised, NOT in the trail
  └──────────────── the scroller ENDS here ──────────┘
```

Above the boundary is `pathTo(tip)` — the existing branch model, unchanged. Below it is the
queue. The scroller stops at the last queued item: there is nothing to scroll into, which is
the structural version of "at most N ahead".

### 5.3 Two properties that make this safe, and they are not accidents

**Uniform item height.** Every item is exactly one shell-height. Therefore any change *below*
the current item cannot move it, and swapping an item's contents for a same-size placeholder
cannot move anything. Almost every scroll-jump bug in feeds of this kind comes from variable
heights; we do not have them.

**A stable path prefix.** `pathTo(tipOf(history, c))` for any child `c` of step `p` shares its
entire prefix with `pathTo(oldTip)` up to `p` (see `parentOf` in `src/lib/branch.ts`: a parent
index is always strictly smaller, and the array is append-only). So forking, switching branches
and pulling a thread while revisiting all rewrite only the part of the list *below* where the
reader is standing. **`scrollTop` stays valid through every one of them.**

Those two together are why the hard cases in §6 are one-liners instead of research projects.

### 5.4 Where the code goes

`src/lib/feedqueue.ts`, pure, unit-tested, no React and no DOM, per `CLAUDE.md §8.4`:

- the queue item union and its invariants
- `commitDecision(...)` — should this visible item commit?
- `queueCapacity(...)` — depth, clamped by the day's remaining stops (§6.2)
- `invalidateQueue(reason)` — what survives a thread pull, a cross, a focus change
- `insertAfterLike(...)` — the like-follow (§6.3)
- `terminusFor(...)` — which end-card to place when a pool runs dry (§6.5)
- the spoken-for ids (§8.7) — **derived from the queue, not tracked separately; see below**

The feed component owns only the DOM: the scroller, the observer, and calling into the above.

✅ **BUILT in Phase 2**, with one deliberate improvement on this list. `invalidateQueue` also hands
back the cards it dropped, so the caller can return them to the discover buffer instead of throwing
away the upstream requests they cost. And `pendingIds` **derives** the spoken-for ids from the queue
rather than maintaining a set beside it, which is what makes §8.7's hazard structurally impossible
instead of merely documented.

---

## 6. The owner's six questions, answered

### 6.1 "What happens when I pull a thread? Cards loaded after it must not appear in my trail."

**Solved by construction.** Queued cards are not in the trail; only committed ones are. Pulling
a thread discards the queue and nothing needs to be undone.

Two cases:

- **Pulling from the tip** (the ordinary case). Discard the whole queue, release its pending
  ids, push the thread card as a real step, refill the queue below it.
- **Pulling while scrolled up** (`pos !== tip`, revisiting). This forks, exactly as it does
  today. The new step is a child of `pos`; the scroller re-renders as `pathTo(tipOf(new))`,
  which shares its prefix up to `pos` (§5.3), so the committed steps that were below stay in
  the trail tree and simply stop being on the line you are reading. They remain reachable
  through the "ways" switch (Phase 30) and the trail map. Then smooth-scroll down exactly one
  item onto the new card.

Nothing is deleted from `history` in either case, which keeps `branch.ts`'s append-only
invariant intact. That invariant is load-bearing: parent indices stay valid forever only
because nothing is ever removed.

### 6.2 "How do we enforce limits? Register the card at ~75% and block the rest when needed."

The owner's proposal is adopted, with two additions that matter.

**Commit at 75%.** An `IntersectionObserver` on the scroller with `threshold: [0, 0.75]` fires
when an item is three quarters visible. That commit calls the existing `recordStop()`,
`seenRef.add`, `persistSeen`, the tour signal and `doorsLeavingHere` on the card being left.

**Addition 1 — a dwell floor.** `scroll-snap-stop: always` means a fling *stops* at every card,
so pure visibility could record six stops in a second from one gesture. Require the item to
hold ≥75% for a short settle (~250-400 ms, to be tuned by measurement) before committing. This
is also more honest: a card genuinely glimpsed for 200 ms was not a stop.

**Addition 2 — the queue is capped by what is left.** This is the part that is easy to miss.
`queueCapacity = min(QUEUE_AHEAD, stopsRemaining(meter, FREE_DAILY_STOPS) ?? ∞)`.

Without it the feed would fetch cards the reader is not allowed to reach — spending Wikimedia
and Met budget on nothing, and teasing content behind a limit, which is the exact dynamic §2
exists to prevent. With it, the queue shrinks naturally to zero as the day closes, and the last
card is followed by a terminus item that *is* the trail map. The reader scrolls into the end of
the day instead of being yanked out of the feed by `endSession("limit")`. That is a real
improvement on today's behaviour and it falls out of the model for free.

The same cap applies to the `dayIsSpent()` checks that currently guard `doDrift`, `crossRealm`,
`onThread` and `openDoor`: they move to "may this item be materialised?" and stay fail-open
(`meter === null` means unmetered — `CLAUDE.md §4`, and `lib/limits.ts` is explicit about it).

### 6.3 "When I like a card, the next card is currently on the same theme. That can't work if the next card is already loaded."

The owner's own suggestion ("put it behind the first next card, or give it priority") is right
and the queue makes it clean.

Today `pickDriftNext(threads, { likedCurrent })` decides at drift time using the liked card's
threads. In the queue model, on a like:

1. **Insert, do not replace.** Build the thread-follow card and splice it in at the *first
   uncommitted slot the reader has not begun to reveal* (nothing ≥25% visible is ever mutated —
   swapping a card out from under a reader's eye is exactly the dishonesty §2.1 forbids).
   Everything below shifts down one. Since queued cards cost nothing, shifting is free.
2. Its `arrivedVia` carries `fromLiked` as it does today, so the ModeChip still says
   "Because you liked X" and the transparency principle holds.
3. The interest-model half is unchanged: `applyFeedback` still reweights future refills, which
   is the slow, durable half of the behaviour.

Edge cases to handle: a like on a card the reader has already scrolled off (apply to the next
free slot, not retroactively), a like while the queue is empty (nothing to insert into — the
next refill picks it up), and a like under a focus (suppressed today by design, because
following a thread would carry the reader out of the field the banner promises — keep that).

### 6.4 "What happens when I switch realms?"

Same as 6.1's tip case: crossing is a deliberate steering action, so the queue is discarded and
rebuilt in the destination realm. `takeBufferedRandom`'s existing realm filter (it drops
buffered cards whose source is not the current realm) becomes an invariant of the queue instead
of a filter at the point of use, which is stricter and easier to test.

The gesture needs care: the scroller must carry `touch-action: pan-y` so the browser claims
vertical panning only and horizontal drags still reach `resolveHorizontalSwipe`. That is
already the pattern used on the card's reading region and the reason for it is recorded in
`CardView` — without it the browser claims the drag, fires `touchcancel`, and the cross-realm
swipe silently vanishes.

### 6.5 "How do directed drifts work, and where does 'you have seen everything' appear?"

**All queued cards come from the current focus, always.** Refill asks `focusIn(realmRef.current)`
exactly as `fetchDiscoverBatch` does today, and any focus change (entering a field, anchoring an
orbit, releasing a focus, widening an artist ring) invalidates the queue. There is no path by
which a card chosen under one promise can be shown under another. The banner and the queue
therefore cannot disagree, which is the §2.1 requirement.

**The "you're caught up" message gets strictly better.** Today it is a transient toast from
`showHint()` fired when a pool returns nothing, and it appears wherever the reader happens to
be. In the queue model, a dry pool appends a **terminus item** — a real, full-screen card at the
end of the scroll:

- `pool-dry` (a field or artist ring exhausted): "you have read this field dry", offering to
  widen or drift freely.
- `caught-up` (the Phase 23 news case): the existing wording, but placed exactly where the
  section's stories end, so it answers "why did it stop here?" in the place the question is
  asked.
- `day-done`: the trail map (see 6.2).

The reader scrolls *into* the ending. That is principle §2.3 ("sessions have shape") rendered
as geometry rather than announced in a toast, and it is the single nicest thing this
architecture buys.

The widening ladders (orbit rings via `refillOrbit`, artist rings via `nextArtistRing`, the news
`deep` offset retry) all stay where they are: they run inside refill, before a terminus is
placed. A terminus is only ever appended when refill has exhausted every widening it has.

### 6.6 "How do we avoid instantly maxing out our rate limiters?"

This is the question with the most surprising answer, so it gets its own section.

---

## 7. The rate-limit budget, worked through

### 7.1 The three facts that constrain everything

1. **All readers share one budget.** On Vercel every request egresses from a shared IP, so the
   whole user base draws down one Wikimedia budget (`docs/beta-readiness.md` Q3). Measured cost
   today: **≈2.4 Wikimedia calls per card** (threads 1.0, discover ~0.5, Read more ~0.6).
2. **The Met is the tight one and is throttled by bucket, not by rate.** ~80 requests per ~30
   seconds, `403` with no `Retry-After`, and repeated tripping shrinks the budget for a **day**
   (`CLAUDE.md §4`). A cold Gallery room is 21 requests, one card's threads is **8**, a discover
   batch of 4 is 5.
3. **The biggest consumer of the Met is the Encyclopedia.** `/api/doorway` fires on every card
   in *both* realms; in the 25-reader rehearsal it was **92.6% of all Met traffic**. Any
   per-card multiplier applies to the museum even when nobody is in the Gallery.

### 7.2 The rule that must not be broken

> **Materialising a card costs a discover slot. It must NOT cost a threads fetch or a doorway
> fetch.** Threads and the doorway are fetched for the card being read and **at most one
> ahead**, and the one-ahead fires on a short dwell timer.

If all N rendered cards fetched threads and a doorway, Gallery cost per screenful would go from
~9 Met requests to ~45. The bucket is ~80 per 30 s. **The breaker would open within seconds**,
and per `CLAUDE.md §4` a cold instance with an open breaker serves a Gallery room *zero* cards.
This is the one way to genuinely break the app with this feature.

### 7.3 The good news: total volume barely moves

Work it through per committed card, in steady state:

| | today | continuous feed |
|---|---|---|
| discover slots | 1 per card (12-card refills, bursty) | 1 per card (small refills at a low-water mark, smooth) |
| threads + doorway | 1 per card, on landing | 1 per card, one card earlier |
| **total per card** | **the same** | **the same** |

Threads are cached per card id (`threadCache`), so prefetching one ahead does not add a fetch —
**it moves the same fetch earlier in time.** The only genuinely new spend is threads fetched for
cards that are then discarded (a thread pull or realm cross invalidating the queue), which is a
small fraction of moves, and the dwell timer means a fast scroller never triggers the +1 at all.

And the burst *shape* improves. Today a refill is a 12-card burst every twelfth drift: three
parallel discover calls, and in the Gallery ~15 Met requests at once. A low-water queue refills
1-2 cards at a time, far more often. **A bucket-shaped limiter strictly prefers the smooth
version**, which is the whole reason `makeGate` grew a rolling budget in Phase 33C.

### 7.4 The bounded queue is the rate limiter

The real new risk is not steady state, it is a fling. Today each swipe is one discrete advance
behind `busyRef`. In a scroller a fling could cross many snap points in a second.

Three things bound it, and they compose:

1. `scroll-snap-stop: always` — the browser stops at every card. A fling cannot skip.
2. **The scroller ends at the last queued card.** A reader physically cannot consume more than
   `QUEUE_AHEAD` cards before the feed has to refill. The maximum burst is bounded by geometry.
3. The commit dwell floor (§6.2) means blowing through does not even record stops.

**Recommendation: `QUEUE_AHEAD = 3`.** Rationale, not taste: three is one full screen of
lookahead plus two, it keeps a Gallery worst case (queue discarded and rebuilt) at ~15 Met
requests which is inside the 30-per-15s burst allowance, and it is small enough that the floor
of the feed stays psychologically visible — which is the §2 argument. Five, the number in the
original idea, roughly doubles the discard cost on every thread pull for no felt gain, since a
reader is never more than one card ahead of their own thumb.

Make it a constant, measure it with the bot swarm (§8.9), and tune it with evidence.

---

## 8. Everything the owner did not list (and one thing that will bite)

The owner correctly guessed they were forgetting things. Here they are.

### 8.1 The guided tour (Phase 20)
`TourProvider` exposes `holdNav`, which freezes navigation while the reader "looks around". A
native scroller ignores a boolean; freezing means `overflow: hidden` on the scroller (and
restoring `scrollTop`). The tour's forced steps advance on `tourSignal("drifted" | "threaded" |
"crossed" | "ended" | "saved")`, which all move to the commit handler and keep working. The
tour also spotlights elements by `data-tour` attributes, which must remain reachable and must
not be inside an item the browser has skipped via `content-visibility`.

### 8.2 The ad interstitial (Phase 21)
`showAd` currently replaces the card and `driftsSinceAdRef` counts drift-scrolls. This becomes
a queue item of kind `"ad"`, inserted during refill when `shouldShowAd(...)` says so. Cleaner
than today, and it is off by default so it can be done last — but it must not be forgotten,
because `advance()` has an ad branch that will simply disappear in the rewrite.

### 8.3 The ~25 stop nudge
Today an absolutely-positioned dismissible overlay. It works unchanged in a scroller and should
stay an overlay for the first version. **Worth considering later:** at `NUDGE_AT` the queue
inserts a `"pause"` item the reader must deliberately scroll past. That is *more* friction than
today, in the §2.4 direction rather than against it, and it is the kind of thing this
architecture makes cheap. Not in the first version; it changes the felt product.

### 8.4 Dwell time, and the doors that depend on it
`dwellRef` currently accrues on `pos` change. In a scroller, dwell should come from the same
observer that drives commits (visible-time, not landed-time), which is strictly more accurate.
That matters beyond stats: `engagedWith()` uses `DOOR_DWELL_MS = 15_000` to decide whether a
stop earns the right to leave doors behind (Phase 28). Better dwell means more honest doors.
Watch for double counting when an item becomes visible, is scrolled off and comes back.

### 8.5 `doorsLeavingHere` moves to the commit handler
Doors are recorded on the card you *leave*, at the moment you leave it, and only if you engaged
with it. In the queue model, "you left card A" is precisely "card B committed". Same rule, new
trigger. The `opts.parent` case (rejoining an earlier stop records no doors, because nothing is
being declined) must be preserved.

### 8.6 Keyboard and accessibility
- `ArrowDown` / `Space` / `PageDown` currently call `advance()`. They must scroll the scroller
  to the next snap point instead. Native scrolling already does much of this if the scroller is
  focusable, but the existing handler intercepts and `preventDefault()`s, so it needs rewriting
  rather than leaving alone.
- Keys `1`/`2`/`3` pull threads on the *current* card; "current" is now observer-derived.
- WCAG 2.2 AA is a standing gate here (`CLAUDE.md §10`). Several cards in the DOM at once
  raises real questions: focus order across off-screen items, whether non-current items should
  be `inert`, and a visible focus indicator at every tab stop (2.4.7). Decide deliberately;
  `inert` on non-current items is probably right and is one attribute.
- `prefers-reduced-motion`: no smooth-scroll programmatic jumps.

### 8.7 ⚠️ The `seen` set is a trap, and it is the likeliest bug in the whole project
`seenRef` / `persistSeen` must fire on **commit**, never on materialisation. If a queued card is
marked seen and then discarded (thread pull, realm cross, focus release), the reader has been
permanently denied a card they never saw — and `persistSeen` writes it to IndexedDB with a
FIFO cap of ~500, so it is durable.

But the queue also must not serve the same card twice, or refill a slot with something already
sitting in the queue.

✅ **SOLVED in Phase 2, by removing the hazard rather than managing it.** The original plan here
was a second set, added to on materialise and released on discard — two sets with two lifetimes,
and a release you can forget. `feedqueue.pendingIds` instead **derives** the spoken-for ids from
the queue itself: dropping an item IS releasing its id, in the same statement, and there is no
second piece of bookkeeping that can fall out of step. `isCandidate` then layers that over
`lookahead.isServable` so the buffer and the queue cannot disagree about what a servable card is.

The distinction the hazard was really about still stands and must be kept: **`seen` means "the
reader read this" and is written only on COMMIT**; spoken-for means "this is in the queue right
now". Never write a materialised card to `seen`.

### 8.8 Session re-entry (`?continue=`, `?door=`, `?from=`)
Opening a saved trail lands at a given stop. The scroller must jump to that index *without*
animation on mount and then build the queue below the tip. With `scroll-snap-type: mandatory`
an initial `scrollTop` assignment can be fought by the snap engine; set it before paint (or use
`scrollIntoView({ behavior: "instant" })` after layout) and verify on a real device.

### 8.9 The load-rehearsal harness will silently measure the old app
`scripts/bots/` copies the app's URL builders, buckets and discover constants, and
`src/lib/loadbot*.test.ts` pin the copies against the originals. A continuous feed changes
requests-per-card and the fidelity gate compares HTTP bots against real browser bots (2.57 vs
2.67 today). **The bots must be updated in the same phase as the feed, or the rehearsal reports
confident numbers about a feed nobody is running.** This is exactly the failure `CLAUDE.md §7`
warns about with the stale `.next` directory: a measurement that disagrees with reality and is
believed anyway.

### 8.10 Documents that go stale
`docs/beta-readiness.md` ("≈2.4 Wikimedia calls per card"), and the four promise surfaces in
§3.1. Re-measure, do not re-guess.

### 8.11 Nested scrolling: reading versus drifting
The card has an inner scroll region (`[data-drift-scroll]`) whose edges `lib/gesture.ts` reads
to tell "scroll to read" from "overscroll to advance". With a native outer scroller this
becomes real nested scrolling and it is the most delicate part of the build.

The recommended posture:
- Keep `overscroll-behavior-y: contain` on the reading region. Reaching the end of an expanded
  article must **not** chain you into the next card: falling out of an article you were reading
  is the worst possible accidental advance.
- Make the *collapsed* card fit the viewport, so most cards have no scrollable region at all
  (`edgesOf` already reports `atTop && atBottom` for these) and the outer snap scroll works from
  anywhere on the card.
- Keep a small wheel handler for desktop: at the region's bottom edge, accumulated overscroll
  programmatically scrolls the outer scroller by one snap point. This reuses
  `isWheelReadingScroll` rather than replacing it.

### 8.12 Mobile viewport stability
Snap feeds jitter when the URL bar collapses and `dvh` changes mid-scroll. **Drift is already
immune**: the feed root is `h-dvh overflow-hidden` and the document itself never scrolls, so
mobile browsers keep their chrome shown and the shell height is stable. Keep it that way — the
scroller must be `h-full` *inside* that shell, never the document scroller.

### 8.13 Overlays must live outside the scroller
`ShareSheet`, the end overlay, `FocusBanner`, hints and the nudge must be siblings of the
scroller, not children of a snapped item, or they will scroll away and create stray snap
positions.

---

## 9. Invariants. If you change this code, these must still hold.

1. An **uncommitted card is never** in `history`, in `seenRef`, in `persistSeen`, or counted by
   `recordStop()`.
2. A card is **committed exactly once**, at ≥75% visibility held for the settle window.
3. **Every queued card belongs to the current realm and the current focus.** Any change to
   either discards the queue.
4. `history` stays **append-only**; nothing is ever removed or renumbered (`branch.ts` depends
   on it absolutely).
5. **Every item is exactly one shell-height.** Uniform height is what makes forking,
   branch-switching and windowing scroll-safe.
6. **Threads and the doorway are fetched for the current card and at most one ahead.** Never
   for the whole queue.
7. The queue length never exceeds `stopsRemaining`, and the meter still **fails open**
   (`meter === null` means unmetered).
8. Discarding a queued card **releases its pending id** so it can be served again later.
9. Nothing advances without a gesture. No timers, ever.
10. The scroller ends at the last queued item. There is always a visible floor.

---

## 10. Where this stands

**Phases 0, 1 and 2 are done.** Phase 0 (see §2.1) cost no architecture and no principle: everything a stop needs
now lands in about 150 ms instead of 530 to 3,350 ms, at the same upstream cost, and it is
shippable to `main` on its own. It also settled the question it was there to answer — how much of
the complaint was latency rather than gesture.

**The answer is: a large share of it, but not the part the owner actually asked about.** What is
left is the discrete gesture itself: a swipe, a release, and then an animation, never 1:1 with the
finger. That is cause #1 in §2 and no amount of preparation touches it. Only Phases 1 to 7 do,
building the scroller behind `NEXT_PUBLIC_FEED_CONTINUOUS` with the discrete feed left intact as
the fallback.

**Phase 1** then split the feed into `useDriftSession` (the engine) and two shells, verified
behaviour-neutral across every entry point, and **Phase 2** built `src/lib/feedqueue.ts`. So the
scroller now has an engine to consume and a queue to run on; Phase 3 is the first phase with
anything to look at.

The owner has **decided to go ahead**, and to rewrite the four promise surfaces in §3.1 rather
than work around them. That rewrite ships *with* the feed, in the same change — not after it.

The project is **doable**. It is not small, and the risk is concentrated in three places: the
principle rewrite (§3.1), the Met budget (§7.2), and the `seen`-set lifetime (§8.7). Everything
else is ordinary work.
