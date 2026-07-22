# Drift — Implementation Plan & Progress Tracker

This is the **living source of truth for progress**. Every session: read this, work the
current phase in order, and tick boxes (`- [ ]` → `- [x]`) as steps are completed and
**tested with success**. Keep the "Current status" line accurate. Full product detail is in
`drift-spec.md`; working rules are in `CLAUDE.md`.

> ## Current status — 2026-07-22
>
> **Drift is live** at <https://www.usedrift.org> (Vercel + Supabase) as an installable PWA,
> in a small friends-and-colleagues beta. Two realms ship: **Encyclopedia** (Wikipedia) and
> **Gallery** (Art Institute of Chicago, CC0).
>
> **Shipped:** Phases 1, 2, 4, 5, 6, 8, 9, 10, 13, 14, 15, 18, 19, 20, 22, 23 — the core drift loop,
> directional threads, trails + the trail-map reward, the Atlas, the interest model, accounts
> and cloud sync, friends and sharing, cross-realm doorways, focused drift (field + orbit + in the news),
> branded email, the guided tour, and the contact form.
>
> **Behind a flag:** Phase 17 **Papers** (arXiv) — set `NEXT_PUBLIC_REALM_PAPERS=1`. Phase 21
> **ads** — built, kill switch `NEXT_PUBLIC_ADS_ENABLED` OFF; awaiting AdSense approval.
>
> **Deferred by choice:** Phase 3 (local Ollama AI), 7 (constellations), 11 (calm social feed),
> 12 (native app), 16 (memory & reflection), M12 (Library/Today realms), M-Ad3 (ad-free tier).
>
> **Baseline:** 412 unit tests green, `npm run build` + `npm run lint` clean.
>
> **Latest (2026-07-22):** two changes to how an Encyclopedia drift starts. **M-FD3** dropped the home
> page from four ways to begin to three: "Or drift within a field" is now a grid of 28 field cards
> (glyph, name, blurb, tint) listed alphabetically, open by default on desktop and folded on mobile,
> and "Or start somewhere" belongs to Gallery/Papers alone. **Phase 23** then added the third directed
> drift, **"Or drift what's in the news"**: ten subject cards that drift the Wikipedia articles behind
> this month's stories, sourced from Wikipedia's own `Portal:Current events` (so no news is ever
> displayed and no new licensing exposure is taken on).
>
> **▶ Next:** open. Phase 16 (Memory & Reflection) is the last of the three brainstorm
> directions and the most natural continuation; ads work resumes only if AdSense approves.
> Phase 22 needs two owner dashboard steps (a Cloudflare route for `contact@`, and a Turnstile
> widget) before it is fully armed in production.
>
> _Full per-phase history is in the log below. Update BOTH when progress changes._

---

## Progress log (chronological, oldest first)


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
> lightbox + M-G3 directional art threads + M-G4 richer discovery (M-G5 personalization optionally deferred).
> New dep `react-zoom-pan-pinch`.
>
> 🌉 **Phase 15 (Cross-Realm Doorways) — ✅ COMPLETE & verified (2026-07-18).** **M-CR1** doorway threads
> (factual, gated, no-AI; realm follows the card) + **M-CR2** horizontal swipe between realms + trails that
> span both (axis-locked smart-cross, per-node trail-map tints + bridge edges, "Encyclopedia + Gallery" badges)
> + **M-CR3** a living, vibrant, cross-realm Atlas (per-node realm tints, glow/nebula halos, tap-a-star detail
> card with Revisit / Drift-from-here, titled PNG export, legend). **217 unit tests, build+lint clean**;
> per-milestone 390px browser passes, zero code-level errors (only external AIC-CORS thumbnail warnings, handled
> with a letter fallback). §2 held throughout. No new dependency. Plan file:
> `~/.claude/plans/lexical-beaming-clarke.md`. **▶ NEXT (when the user is ready): Phase 16 (Memory &
> Reflection)** — the last of the three brainstorm directions. _(Deferred: in-app friend-share of the Atlas;
> a real-iOS momentum pass on the swipe.)_
>
> 🐞 **Two bug fixes (2026-07-18).** Both from real use; both verified (build + lint clean, **215 unit
> tests**, mobile-390px Playwright **16/16**, 0 page errors). **(1) Drift clustering (Encyclopedia).**
> Plain drifting used to follow one of the current card's `morelike:` threads ~50% of the time (up to 3 in
> a row via `MAX_THEME_RUN`), and a neighbour-of-a-neighbour stays in one tight cluster — so scrolling gave
> 3–4 near-identical pages (same subject, different year). **Fix:** every drift is now an INDEPENDENT random
> jump by default; the one exception is an explicit signal — ♥-like a card and the NEXT drift follows one of
> its related threads ("stay in this stream", honest **"More like {title}"** mode chip). Relatedness is tied
> to a transparent user choice, not a blind coin flip (§2.1). `drift.ts` (`likedCurrent` replaces the
> `consecutiveThemeDrifts` run-cap; `DRIFT_THREAD_BIAS`/`MAX_THEME_RUN`/`themeRunRef` removed), `page.tsx`
> `advance()`, `ArrivedVia` drift `+fromLiked`, `CardView` ModeChip, `drift.test.ts`. Verified: Octopus♥ →
> "Octopus tetricus" [MORE LIKE OCTOPUS]; unliked Jupiter drift → Kindergarten→Gettysburg→Dune→UC Press→
> Purple Heart (all distinct, unrelated). **(2) Gallery zoom close jumped to a new card (mobile).** The
> deep-zoom lightbox is portaled to `<body>`, but **React synthetic events still bubble through the COMPONENT
> tree** (a portal's events reach its React parent), so a pinch/pan/tap-✕ in the zoom bubbled to the feed's
> `onTouchStart/End`/`onWheel` on `/drift` and was read as an advance (new Gallery card) or a realm-cross
> (new Encyclopedia card). The old code comment wrongly claimed the portal isolated events. **Fix:**
> `ArtZoom` now `stopPropagation()`s touch + wheel at the dialog root (above the zoom lib's own inner
> handlers, so pinch/pan still work); comment corrected.
>
> 🧪 **Phase 17 — Papers realm (arXiv), M-P0 + M-P1 SHIPPED behind a flag (2026-07-18).** An experimental
> third realm: open research read as text-forward, field-themed cards (no images — a generated hue+motif cover
> per discipline). 100% copyright-clean (arXiv CC0 metadata only; PDF linked, never rehosted). Off by default;
> set `NEXT_PUBLIC_REALM_PAPERS=1` in `.env.local` to try it. 247 tests, build+lint clean, browser-verified
> (see Phase 17 below). OpenAlex enrichment + cross-realm doorways (M-P2) and AI simplification (M-P3) are
> deferred until the user has tried the feel. Detail: Phase 17 section + `~/.claude/plans/synchronous-leaping-wren.md`.
>
> 🎯 **Phase 18 — Focused Drift COMPLETE & verified (M-FD1 + M-FD2, 2026-07-18).** An optional session
> *focus* that confines the passive drift gesture (threads stay free), pure Wikipedia metadata, no AI,
> §2-strengthening (more transparent + more agency). **M-FD1 (Field Focus):** pin drift to one broad ORES
> field via a homepage "Or drift within a field" picker → a calm "Within {Field}" banner. **M-FD2 (Page
> Orbit):** a homepage search bar ("Drift around a page…") + a "Drift around this" card action start a
> drift *anchored* to a seed page that spirals outward ring by ring (BFS `orbit.ts` engine over `morelike`;
> banner "Orbiting {seed} · nearby → further out"). Both: one-tap "Drift freely" release; personalization +
> cross-realm suspended while focused; threads stay free (the way out). New: `focus.ts`, `orbit.ts`,
> `FocusBanner.tsx`, `OrbitSearch.tsx`, `/api/wiki/search`; wiring in `drift/page.tsx`, `page.tsx`,
> `CardView.tsx`. **270 tests, build+lint clean**, real-browser verified (field 12/12; orbit search →
> widening → re-anchor → threads-free → release, zero errors). Plan: `~/.claude/plans/humming-munching-spark.md`.
>
> 🚀 **Beta-readiness pass — IN PROGRESS (2026-07-19).** Prepping for a 20–50 friend/colleague beta.
> Full research in `docs/beta-readiness.md` (4 questions: email, free tiers, rate limits, launch gaps).
> **Shipped this session** (build+lint clean, **284 tests**): **(1) Rate-limit scaling** — the deployed app
> shares ONE Wikimedia budget (all users egress one Vercel IP), so: a compliant `WIKI_USER_AGENT` (real
> URL+email ⇒ ~200 req/min vs ~10 unidentified, now marked REQUIRED in deploy docs) + **CDN caching** of the
> deterministic content proxy routes (`src/lib/cache-headers.ts`; `s-maxage`+SWR on summary/related/discover/
> search/topics/doorway success paths, `no-store` on every error/empty/random path so a throttle-blip is never
> cached). **(2) Complete account deletion** — server route `/api/account/delete` (verifies the caller's own
> JWT, service-role delete cascades every table), calm type-to-confirm UI on `/account`, `deleteAccount()` in
> AuthProvider; needs `SUPABASE_SECRET_KEY` server-only in Vercel. **(3) `/privacy`** "what Drift stores" note
> (allowlisted public in AuthGate; linked from account + landing footer). **(4) Error boundaries** `app/error.tsx`
> + `app/global-error.tsx` (calm, logged). **(5) First-run coach** — one-time gentle "you are the algorithm"
> intro on `/drift` (`FirstRunCoach.tsx`, per-device localStorage). **Deferred to Phase 19** (blocked on a
> domain + Resend): custom SMTP + Confirm-email + branded templates + full auth E2E, a feedback channel, and the
> custom domain. Then the user adds `SUPABASE_SECRET_KEY` to Vercel + works Phase 19 when email is ready.
>
> 📧 **Phase 19 (Email) — CODE COMPLETE (2026-07-19).** Domain **www.usedrift.org** live; Resend + SMTP wired by
> the user. Shipped: shared branded email renderer (`src/lib/email/*`), generated Supabase **Confirm + Reset**
> templates (`supabase/email-templates/`), and app-sent **Welcome** (idempotent `/api/email/welcome`) + **Goodbye**
> (in `/api/account/delete`) emails via Resend, all graceful. UA defaults moved to usedrift.org. **292 tests**,
> build+lint clean; live sample of all four sent to the owner's inbox. **Remaining = user dashboard steps** (paste
> templates, Supabase Site URL, Vercel env vars, security toggles, live signup E2E) — see the Phase 19 section.
>
> 🧭 **Phase 20 (Guided Tour) — COMPLETE & verified (M-T1 + M-T2 + M-T3, 2026-07-20).** An optional, calm,
> interactive first-run onboarding tour that walks a real "mini drift" end to end. Engine =
> `src/lib/tour/steps.ts` (pure 16-step script +tests), `TourProvider` (cross-route controller, forced-event
> `signal()`, once-per-account welcome gate via synced `settings.tourStatus` + sync-settle), `TourOverlay`
> (four-panel spotlight leaving the real control tappable + coach card as a mobile bottom/top sheet,
> reduced-motion, progress bar, always-skippable, graceful stall/target-miss). Flow: welcome → home (realms,
> **drift-around-a-page**, **drift-within-a-field**, seeds, forced tap into `/drift`) → drift (card, **forced
> thumbs up/down**, **forced thread pull**, **forced vertical swipe**, **forced horizontal cross into Gallery**,
> **forced End**) → **forced Save** → **forced View in My Trails** → escorted Atlas + Interests finish ("you are
> the algorithm"). **Take a tour** replay on Home + Account. Old `FirstRunCoach` retired. Also fixed stale
> heart/cross wording to **thumbs up/down** across tour copy + code comments. **312 tests** (+16), build+lint
> clean; Playwright drove all 16 steps via real actions on mobile (light+dark spot-checked), persistence + replay
> confirmed, zero tour-caused console errors. Plan file: `~/.claude/plans/tranquil-petting-salamander.md`.
>
> 💰 **Phase 21 (Ads exploration) — M-Ad1 + M-Ad2 BUILT & verified (2026-07-20), flag OFF.** An optional, calm,
> killable in-feed ad: one "Sponsored" full card every N drift-scrolls (`src/lib/ads.ts` +tests,
> `src/components/AdCard.tsx`), an ephemeral interstitial in `/drift` that is **never saved to a trail**, has no
> autoplay, and is suppressed during the tour. Kill switch `NEXT_PUBLIC_ADS_ENABLED` (OFF by default ⇒ no script,
> no cookies, byte-for-byte the ad-free app). `placeholder` mode (house card) testable now with no AdSense;
> `adsense` mode loads `adsbygoogle.js` only when ids are set, adds `public/ads.txt`, and flips `/privacy` +
> StorageNotice to honest ad/cookie copy. **Owner action items** (create + get the AdSense account approved,
> Search Console, crawler login, consent message, ids) are in the Phase 21 section. **320 tests**, build + lint
> clean; Playwright verified on + off. Real ads await the owner's approved account.
>

> 🧹 **Codebase & content cleanup pass — COMPLETE & verified (2026-07-21).** A whole-repo tidy: no new
> features, no behaviour changes the user asked for. **Bugs fixed:** (1) `card.ts`'s `SOURCES` allowlist
> omitted `"arxiv"`, so every Papers cardId was rewritten to `wikipedia:arxiv:…` on read, breaking that
> realm's seen-set + reactions after a reload; both the type and the runtime list now derive from one
> `SOURCE_IDS` tuple in `realms/types.ts`, with a round-trip test over every source. (2) A JSX whitespace
> bug rendered "Encyclopediacards" on `/interests`. (3) The home page read "1 stops mapped". (4) My Trails
> said "No liked trails yet" when a *realm* filter emptied the list. (5) The sync status reported "idle"
> whenever the last of 12 sub-steps succeeded, masking earlier failures; it is now cycle-scoped. (6) The
> `seen` cross-device union was O(n·m) and promoted every remote entry to newest, so FIFO decay evicted the
> wrong titles; now a single pass (`unionSeen` in `seen.ts`, +6 tests). (7) `topicsCache` cached the
> degraded empty result (indistinguishable from a real miss), freezing a page's topics forever, and grew
> unbounded; now skipped + capped, and empty cached values self-heal. (8) The five `applyRemote*` blob
> writers emitted their store event before the write settled. (9) A missing 404 page (`not-found.tsx`) meant
> a bad URL showed Next's unstyled default. **Copy:** the landing claimed "at most one card is ever loaded
> ahead", which the 12-card discover buffer contradicts (reworded to the true promise: nothing advances on
> its own); `/privacy` said "everything" is stored locally when friends/shares are cloud-only; the tour's
> one first-person line, a non-existent "Art" field, and hardcoded "Two realms" were fixed; Supabase's raw
> "Invalid login credentials" and four other common auth errors now read in Drift's voice. **A11y:** named
> the share dialog, made the thread-loading region a live region, matched the advance button's accessible
> name to its visible label, fixed two `aria-label`s on unrole'd spans, bounded the focus banner. **Bounds:**
> `maxLength` on trail-name + display-name inputs, clamps on friend-supplied names and long emails.
> **Dead code:** `clearAllPending`, `BadRequestError`, `topicById`, `InstallShot` (+ its stale README),
> `.m5b-test.mjs`, and three unnecessary exports; `fetchJson`/`fetchText` collapsed onto one retry core;
> `focusToParams` is now actually used by the homepage (it and `/drift`'s parser had duplicate encodings).
> **Stale comments** swept across 10 files. `plan.md`'s 210-line status block was split into a short
> Current status + this log. **331 tests** (+9), build + lint clean (the old InstallShot lint warning is
> gone); Playwright: core loop 27/28, features 15/20 and focus 12/12 with every remaining ✗ confirmed a
> test-harness artifact, zero console errors on any route in light + dark, desktop + mobile.
>

> ✉️ **Phase 22 — Contact & feedback — COMPLETE & verified (2026-07-21).** A public `/contact`
> page (allowlisted in `AuthGate`, since someone who cannot sign in is exactly who needs to
> reach us). One submission sends **two** emails via Resend: a Drift-styled **receipt** echoing
> the sender's own message back, and a **notification** to `CONTACT_INBOX` (default
> `noreply@usedrift.org`) whose **`reply_to` is the sender**, so the copy Cloudflare Email
> Routing forwards to the owner's personal inbox can be answered with plain Reply. New:
> `src/lib/contact.ts` (pure validation, +26 tests), `src/lib/turnstile.ts` (siteverify, +6),
> `src/app/api/contact/route.ts`, `src/app/contact/page.tsx`, `src/components/ContactForm.tsx`;
> `renderEmail` gained an escaped, newline-preserving `quote` block (its only untrusted-input
> surface, so +5 injection tests) and `sendViaResend` gained `replyTo` + `text`.
> **Anti-spam is layered and all of it is invisible:** honeypot, a fill-time floor, a
> best-effort per-IP throttle (5/hr), and optional **Cloudflare Turnstile** in Invisible mode.
> Turnstile is **fail-closed once both keys are set** and absent otherwise, matching the
> Supabase/Ollama contract. A bot-trapped submission gets the SAME success response a human
> does, so a script learns nothing. Note the client does NOT run the bot traps: it waits out
> the fill-time floor instead of erroring, so a fast or autofilled visitor is never silently
> dropped. **367 tests** (+36), build + lint clean. Verified against a stub Resend: browser flow
> 9/9 in light + dark, desktop + mobile, zero console errors; both emails captured and visually
> checked; honeypot and instant-submit silently dropped (200, zero mail sent); throttle returns
> 429; Turnstile verified against the REAL siteverify with Cloudflare's always-fails key
> (refused, zero mail) and always-passes key (full flow green). **Owner steps remain:** route
> `contact@usedrift.org` in Cloudflare + set `CONTACT_INBOX`, and create the Turnstile widget.
>


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

- [x] **Doorway threads (M-CR1) — DONE & verified (2026-07-17).** One quiet cross-realm chip, factual + no AI:
      Gallery→Encyclopedia resolves the artwork's artist (then movement) onto Wikipedia (`wikiSummary`, redirect-
      normalized: Great Wave → **Hokusai**); Encyclopedia→Gallery searches AIC on the title, **gated** by
      `passesReverseGate` (Octopus → "Octopus and Shell", **abstract topics stay silent**). New `/api/doorway`
      route + pure `src/lib/crossrealm.ts` (gate + `realmOfSource` + `forwardEntities`, 8 tests) +
      `realms/server/doorway.ts`. Distinct **dashed doorway chip** with a portal glyph, **tinted by the
      destination realm** (added explicit `[data-realm="encyclopedia"]` CSS). Pulling it crosses realms: the
      **realm now follows the displayed card** (`realm = realmOfSource(current.card.source)`), so chrome/threads/
      reactions + back-nav are all correct; ModeChip reads "Crossed to {realm} · {label}". **Also fixed a Phase
      14 gap:** rich art fields (zoom / museum label / blur / alt) now ride through `RelatedCandidate` →
      `candidateToCard`, so a pulled facet/doorway thread lands on a **full** art card. **Verified:** build+lint
      clean, **211 tests** (+8), doorway API both ways + gate, real-browser 390px (forward→Hokusai with ♥,
      reverse→zoomable art with label, abstract→none, honest "why"), zero console errors, graceful ({}⇒no
      doorway).
- [x] **User idea 1 — horizontal swipe + trails that span both (M-CR2) — DONE & verified (2026-07-18).** A
      **horizontal swipe** (or a quiet **top-bar "Cross to {realm}" control** for desktop) does a **smart cross**:
      land on the current card's doorway if one exists, else a fresh discover card in the other realm.
      **Axis-locked** via pure `resolveHorizontalSwipe` (`gesture.ts`) so it never competes with the vertical
      read/advance; a distinct sideways `cardVariants` "cross" transition; zoom stays its own portal mode.
      **Reverses "one trail = one realm":** realm now follows the displayed card, a single trail weaves both;
      `TrailMap` tints **per node by `card.source`** + draws a **dashed doorway "bridge" edge** at a crossing
      (`trailmap.ts` `crossRealm`); My Trails + trail detail show **all realms a trail spans** (`trailRealms` in
      `crossrealm.ts`, +1 test). Also a graceful `onError` letter fallback for the rare AIC thumbnail that lacks
      CORS headers. **Verified:** build+lint clean, **216 tests** (+5: axis-lock, crossRealm, trailRealms),
      real-browser 390px **swipe crosses / vertical does NOT cross / top-bar control crosses / mixed trail saves
      with per-node tints + crossing edge + "Encyclopedia + Gallery" badge**; only external AIC-CORS thumbnail
      warnings (handled visually), zero code-level errors. _(Real-iOS momentum pass still recommended.)_
- [x] **User idea 2 — a living, vibrant, cross-realm Atlas (M-CR3) — DONE & verified (2026-07-18).** Stars are
      now **tinted per-node by their own realm** (sage Encyclopedia / terracotta Gallery), with **soft glow +
      nebula halos** and **dashed "bridge" edges** at realm-crossings (calm; motion only on interaction, §2.2).
      **Tapping a star opens a calm detail card** (bottom-sheet on phones, centred card on desktop): thumbnail,
      realm, "in N trails", **Revisit trail** + **Drift from here** (→ `/drift?realm=…&title=…`) + Source; it
      replaced the straight-to-trail click. A **titled + dated PNG export** (bakes "Your Atlas · {date}" into
      the image), plus a **legend** (realm tints, thread / drift / crossing). `atlas.ts` carries per-node
      `source` + `imageUrl` (+1 test). _(In-app friend-share of the Atlas stays a follow-up, per the phase
      decision.)_ **Verified:** build+lint clean, **217 tests**, real-browser 390px **7/7** (both realm tints,
      legend, tap→detail card, Drift-from-here routes, export present), zero code-level errors.
- [x] **Test Phase 15 — PASSED.** Doorways land somewhere genuinely related and say why; a trail weaves realms
      and its map + Atlas render the crossing (per-node tints + bridge edges); horizontal swipe crosses without
      fighting read/advance/zoom (axis-locked); tapping an Atlas star opens its detail; export produces a titled
      image. §2 intact throughout (transparent "why", a door you choose, calm Atlas).

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

## Phase 17 — The Papers realm: vetted research, read like a card  *(idea — researched 2026-07-18, NOT yet committed)*

**Goal:** a third realm that turns Drift into a reader of **open research**, the same way Gallery made it a
reader of open art. A full-screen card = one paper (title, authors, the abstract as the "hook", key facts),
with pull-threads that wander the citation/topic graph, cross-realm doorways into the Encyclopedia, and (a
*later* step) an AI plain-language simplification. This reopens the arXiv note parked in Phase 5's realm
research — the "no images" objection there is real and is addressed head-on by making this a deliberately
**text-forward / theme-styled** realm (no scraped figures), not by pretending it's image-forward.

**The two concerns, answered by research (2026-07-18):**
1. **Access.** The full text is often paywalled, but a Drift card only needs title + abstract + metadata, and
   those are open via free scholarly APIs (the same ones an AI uses to "find a paper"): **arXiv** (~2.4M STEM
   preprints, one free query endpoint, etiquette 1 req / 3 s), **OpenAlex** (~250M works, free REST API,
   **CC0 data** — the citation/topic graph), **Semantic Scholar** (free, AI "TLDR" summaries, but license
   caveats). Access is *not* the blocker.
2. **Copyright — the sharp one, and the reason to build on arXiv.** Three separable pieces:
   - **Titles + hard facts** (authors, venue, year, DOI, citations, categories): facts, not copyrightable;
     OpenAlex/Crossref release them **CC0**. Always free to show.
   - **Abstracts in general**: original prose, therefore *copyrightable*. Showing a random paywalled paper's
     abstract leans on fair use (what Scholar/PubMed do) — legally murky, **not** something to ship publicly.
   - **The escape hatch:** **arXiv dedicates ALL its metadata, including the abstract, to CC0 1.0 Public
     Domain** (verified on info.arxiv.org/help/license — *"A Creative Commons CC0 1.0 Universal Public Domain
     Dedication will apply to all metadata"*, separate from the e-print's own license). So **arXiv abstracts
     are 100% free to display, remix, and feed to an AI.** That makes arXiv the **publish-safe** academic
     source, exactly analogous to Encyclopedia (CC BY-SA) and Gallery (CC0). ⚠️ **Nuance:** OpenAlex stores
     abstracts as an *inverted index* precisely to avoid redistributing copyrighted abstract text — so use
     OpenAlex for the *graph/facts only*, and only ever display abstract *prose* for **arXiv** papers.
     Semantic Scholar data is often CC BY-**NC** + its API license restricts commercial use — fine for a
     hobby project, a flag if Drift ever monetizes; lean on arXiv (CC0) + OpenAlex (CC0), treat S2 as optional.
   - **Decision (user, 2026-07-18):** *rather a smaller 100%-clean selection than a large uncertain one.*
     ⇒ **display only arXiv (CC0) content**; use OpenAlex (CC0) purely for the relationship/topic graph and
     the Wikidata cross-realm links. Nothing shown relies on fair use.

**What it maps onto (all already built):**
- The **source abstraction** (M10): `source: "arxiv"`, a `papers` realm in the registry, generic
  `/api/realm/[realm]/{discover,related,summary}` routes — same shape as `gallery`.
- **The card:** big serif title, authors, an eyebrow like "arXiv · {category} · {year}", the CC0 abstract as
  the extract, "Read the full paper ↗" to the PDF. Reuse the **Phase 14 museum-label** for facts (categories,
  citation count, "Published in {venue}" when OpenAlex shows a published version exists).
- **Threads (directions):** "More in {category}" / "More by {author}" straight from arXiv; richer *References /
  Cited by / Related* from OpenAlex's `referenced_works`/`related_works`, **filtered to candidates that are
  also on arXiv** so the card you land on keeps a CC0 abstract.
- **Cross-realm doorways to Encyclopedia:** the nicest fit of all — every OpenAlex **concept carries a Wikidata
  ID**, so a paper's topic maps *directly* to a Wikipedia article (cleaner than Phase 15's AIC string-match).
- **Interest model:** arXiv categories (or OpenAlex topics) feed a transparent topic-weight model like the
  Encyclopedia's ORES topics.
- **AI simplification (explicitly a LATER step):** batch-precompute plain-language summaries **from the CC0
  arXiv abstract** into a stored DB (not on-the-fly). Legally clean (CC0 input); must obey §2.5 (reshape,
  never invent) — technical-paper hallucination is real, so careful prompting + honest "AI summary, original
  linked" labeling. Depends on the Phase 3 Ollama layer (still deferred).

**Honest blockers / tensions (name them, don't paper over):**
- **No images.** The real one (why arXiv was parked before). Drift is image-forward; a paper is text. This
  realm goes **text-forward / theme-styled** on purpose (the "quiet reading room" suits it): a generated,
  **category-tinted** card (no scraped figures — a figure is part of the e-print, not the CC0 metadata). A
  design spike comes first.
- **Preprints ≠ peer-reviewed**, brushing §2.5's "vetted". Label honestly; optionally surface "Published in
  {venue}" via OpenAlex, or bias toward arXiv papers that have a published version.
- **Density** of abstracts is exactly what the (later) AI simplification is for — and the hardest to do faithfully.
- **Scope:** arXiv is STEM only (physics/math/CS/quant-bio/stats/econ). Biomed has its own clean OA path
  (Europe PMC / PMC open-access subset, CC-licensed) if we ever extend; humanities are scattered.
- **Reversibility (user ask):** build it so the realm can be **dropped/hidden with one flag** and *locally
  tested first* — e.g. do **not** add it to the logged-out landing page yet, keep it behind a realm-enable
  gate, no schema/homepage commitments that are hard to undo.

**Status:** 🎨 **M-P0 (design spike) + M-P1 (arXiv MVP) — ✅ COMPLETE & verified (2026-07-18).** Behind the
`NEXT_PUBLIC_REALM_PAPERS` flag (off by default). Shipped:
- Pure logic: `src/lib/realms/arxiv.categories.ts` (12 buckets + 9 field groups w/ hue+motif + `categoryGroupOf`
  + injection-guard `arxivBucketById`), `src/lib/realms/arxiv.ts` (regex `parseArxivAtom`, `arxivToCard`/
  `arxivToCandidate`, `paperCover`, `arxivFacts`, `isUsableEntry`, **`detexLite`** — strips inline LaTeX
  `$…$`/`\textit{}`/`\ldots` from titles+abstracts so the prose reads cleanly, §2.5-safe).
- Server adapter `src/lib/realms/server/arxiv.ts` (own 3s gate, `Api-User-Agent`, `fetchText` added to
  `upstream.ts`; discover = category + random start, related = "More in {field}" / "More by {author}",
  summary, extended). Registered in client + server registries.
- `src/components/PaperCover.tsx` — the generated, field-themed, image-less cover (hue gradient + seeded SVG
  motif: graph/orbits/grid/cells/curve/trend/wave/bars). Wired into `CardView` (`source==="arxiv"` branch),
  `[data-realm="papers"]` dusty-blue accent in `globals.css`. Papers kept OUT of cross-realm (guard in
  `drift/page.tsx`; doorway route already no-ops). Types: `SourceId+="arxiv"`, `RealmId+="papers"`,
  `Card.cover?`; `SOURCE_TO_REALM`/`DOORWAY_EYEBROW` extended; `candidateToCard` carries `cover`.
- **Reversible:** flag off ⇒ no Papers tab (verified: only Encyclopedia+Gallery), realm still resolves for
  saved trails; landing page untouched (never enumerates realms). Drop entirely = remove the additive files.
- **Verified:** 247 unit tests (+32), build+lint clean; browser (flag on, ungated) 12/12 — themed covers
  render across fields (light+dark+mobile screenshots), abstract/facts/"Read the full paper ↗"/preprint label,
  facet threads pull, drift works, no cross-realm control, 0 console errors; detex 5/5 abstracts clean;
  flag-off hides the tab. **To use locally: set `NEXT_PUBLIC_REALM_PAPERS=1` in `.env.local`.**

**▶ NEXT (when the user is ready): M-P2 (OpenAlex enrichment — references/cited-by threads + Wikidata
cross-realm doorways to the Encyclopedia + "published in" facts) then M-P3 (AI simplification, needs Ollama).**
Plan file: `~/.claude/plans/synchronous-leaping-wren.md`. Sources: arXiv metadata CC0 (info.arxiv.org/help/
license), arXiv API TOU (apps may display metadata; don't rehost PDFs), OpenAlex API + concepts/Wikidata (CC0),
Semantic Scholar API license, Harvard OGC copyright/fair-use.

---

## Phase 18 — Focused Drift (Directed Drift)  *(feedback direction — 2026-07-18)*

> Born from real use: drift (passive scroll) wanders the *whole* encyclopedia even when your
> interest is one field, while threads are the opposite (tight `morelike:` neighbours). There's
> nothing in between. **Focused Drift** adds an optional session *focus* that confines the drift
> gesture to a chosen area (threads stay free). Two kinds: **field** (stay within one broad ORES
> topic) and **orbit** (spiral outward from one seed page). Pure Wikipedia metadata, **no AI**;
> §2-strengthening (more transparent + more agency). Full detail: `~/.claude/plans/humming-munching-spark.md`.
> Confirmed choices: field first then orbit; all three entry points (search bar, field picker,
> "drift around this"); orbit anchored+widening; threads steer freely (the way *out* of a focus).

### M-FD1 — Field Focus ✅ *(idea 1; ships standalone; DONE & verified 2026-07-18)*
- [x] `src/lib/focus.ts` (pure, 8 unit tests): `Focus` type + `focusToParams`/`focusFromParams`
      (URL encode/decode; validates the field bucket against `topicByKeyword` → junk/injection safe)
      + `describeFocus`. `focus.test.ts`.
- [x] `src/lib/types.ts`: extended `ArrivedVia.drift.reason` with `"field"|"orbit"` + optional
      `orbit:{seedLabel,ring}` (both optional ⇒ back-compatible, no migration).
- [x] `src/components/FocusBanner.tsx` (new): calm sage pill under the top bar — names the focus
      ("Within Mathematics") with a one-tap **"Drift freely"** release; orbit variant + proximity ready.
- [x] `src/app/drift/page.tsx`: `focus`/`focusRef` parsed from params on load; field seed reuses the
      existing `bucketParam` batch path (friendly label + `reason:"field"`); `fetchDiscoverBatch` **pins
      every refill pick to the field** (each at a fresh `randomOffset`, personalization suspended);
      `clearFocus()` drops the focus + buffer + strips URL params; the **cross-realm control is hidden
      while focused** (top bar + horizontal swipe both gated on `crossEnabled = canCross && !focus`).
- [x] `src/app/page.tsx`: Encyclopedia-only **field picker** — a calm "Or drift within a field"
      disclosure listing the 28 `TOPICS`; routes to `/drift?...&focus=field&bucket=<keyword>&seed=<label>`
      (honors the keep-trail/endless toggle).
- [x] **Test M-FD1:** build + lint clean; **255 unit tests** (+8 focus). Real-browser (390px, ungated
      local instance) **12/12**: field picker → `/drift` with focus, banner "Within Mathematics", first
      card on-field, **12/15 distinct** drift cards all "DRIFTING · MATHEMATICS" (no crawl), cross control
      hidden, focus survives reload, threads still steer freely (Square root → Square root of 5), "Drift
      freely" removes banner + strips URL, post-release drift wanders again ("DRIFTING · COMPUTING"),
      **zero console/page errors**. _(Verified against a shell-env-ungated dev instance since the app is
      login-gated when cloud is configured; the focus feature is orthogonal to the gate.)_

### M-FD2 — Page Orbit ✅ *(idea 2; DONE & verified 2026-07-18)*
- [x] `src/lib/orbit.ts` (pure, 11 unit tests): the anchored breadth-first "orbit" engine —
      `initOrbit`/`nextToExpand`/`ingestMorelike`/`takeFromPool`/`proximityWord`. Serves the seed's
      neighbours first, then theirs, spiraling outward (ring-ordered pool + BFS frontier + dedup +
      seen-filter; skips each parent's rank-0 near-duplicate; `MAX_PER_PARENT = 6` so widening is
      perceptible after a handful of drifts). `orbit.test.ts`.
- [x] `src/lib/wiki.ts`: pure `normalizeSearchResults` + `isListLikeTitle` (+ `wiki.search.test.ts`)
      for the search bar (suggestions have no extract, so isJunk can't be reused directly).
- [x] `src/app/api/wiki/search/route.ts` (new): `generator=prefixsearch` autocomplete (title +
      description + thumbnail in one call, disambiguation/list pages filtered, graceful → []).
- [x] `src/app/drift/page.tsx`: `orbitRef` + orbit branch in `advance()` (serves the orbit engine,
      refill-on-empty by expanding ≤2 frontier titles via `morelike`); orbit `arrivedVia`
      (`reason:"orbit"` + `orbit:{seedLabel,ring}`); `startOrbitHere` (re-anchor); dead-end → gentle
      hint. **Robustness:** a frontier title whose fetch *fails* (429/timeout) is NOT marked expanded,
      so one unlucky refill can't strand the orbit (a genuine dead-end still is).
- [x] Homepage **search bar** (`src/components/OrbitSearch.tsx`: debounced, calm dropdown, keyboard
      nav) + **"Drift around this"** card action (`OrbitButton` in `CardView.tsx` → `startOrbitHere`,
      Encyclopedia only, re-anchors mid-session without navigating).
- [x] `ModeChip` (`CardView.tsx`) + `FocusBanner`: render "Orbiting {seed} · {proximityWord(ring)}".
- [x] **Test M-FD2:** build + lint clean; **270 unit tests** (+22 orbit/search). Real-browser (390px,
      ungated local): search "Bauhaus" → orbit; banner "Orbiting Bauhaus · the center"; ring-1 cards
      on-theme; **widening confirmed** — Impressionism orbit went NEARBY (Julie Manet, Berthe Morisot,
      Renoir…) → FURTHER OUT (Paule Gobillard, Eugène Manet…); "Drift around this" on "Jazz drumming"
      re-anchored (banner + URL + next chip "ORBITING JAZZ DRUMMING · NEARBY"); threads still steer
      (Arieh Sharon → Yachin House); cross hidden while orbiting; "Drift freely" releases; zero console
      errors. _(Caveat: repeated in-session test runs self-throttle our Wikimedia IP — the documented
      burst limit — which can stall a refill mid-test; confirmed clean at human pace after a cooldown.)_

### M-FD3 — Field cards: fold "Or start somewhere" into "Or drift within a field" ✅ *(user feedback; DONE & verified 2026-07-22)*

> The Encyclopedia home page had grown to **four** ways to begin, and the two weakest sat side by
> side: the field picker was a drab row of text pills, while the pretty seed cards only dropped you
> on a single page instead of shaping the session. Four collapse into three. The **fields** inherit
> the seed cards' look, so tapping one starts a real focused drift; losing the one-page starts is
> fine because the focus banner's "Drift freely" releases any field mid-session.

- [x] `src/lib/topics.ts`: `Topic` gained its homepage face — `glyph` / `blurb` / `tint` for all 28
      topics, next to the taxonomy rather than in a parallel table (the way `realms/artic.buckets.ts`
      and `arxiv.categories.ts` already carry theirs). Glyphs are typographic marks (✦ ∿ π ◈ ◭ § † ☰
      ⇗ ⁂ ⇄ ✎ ⌂ ♪ ◎ ❝ ◫ ∴ ⚑ ▽ ¶ …), never emoji. **The array's order is the grid's order**, so two
      layout rules live in the data (both test-enforced): it is **alphabetical by label** (28 cards
      stay scannable with no headings), and tints **cycle through six far-apart hue families** (sand,
      green, blue, rose, teal, violet). Six is the smallest cycle that keeps every neighbour in a 2-,
      3- OR 4-column grid a different family, diagonals included: same-family cards land 6 apart,
      which no layout puts side by side.
- [x] `src/lib/topics.test.ts` (new, 10 tests): ids/keywords/labels/ORES keys, glyphs and tints
      unique; every topic has a glyph, blurb and `#rrggbb` tint; **each glyph is one BMP code point
      with no variation selector that doesn't match `\p{Emoji_Presentation}`** (the exact "symbol,
      not emoji" rule — it admits ⚙, which is emoji-capable but text by default); no em/en dash in
      any blurb; labels sorted alphabetically; and **no card resembles a neighbour** — CIE L\*a\*b\*
      ΔE > 4 for every pair within 5 index positions, measured on the tint *blended 45% over paper*
      the way `TileGrid` renders it, in both light and dark. (Comparing raw tints would miss that the
      blend washes most of the difference out: the pre-2026-07-22 palette's closest neighbours were
      **ΔE 0.6**, i.e. indistinguishable — the user-reported bug. The palette now clears ~5.)
- [x] `src/components/TileGrid.tsx` (new): the start-card grid extracted from `app/page.tsx` verbatim,
      so the field cards and the Gallery/Papers seed cards can never visually drift apart.
- [x] `src/app/page.tsx`: the "Or drift within a field" `<details>` now holds a `TileGrid` of the 28
      fields (Encyclopedia); it is **controlled** and **opens by default on desktop only** (`sm`
      breakpoint read once at mount via `queueMicrotask`, so 28 cards aren't a long scroll on a
      phone, and the first paint matches the server's). "Or start somewhere" now renders **only for
      Gallery/Papers**; `src/data/seeds.json` and `realm.seeds` are untouched, just unrendered for
      Encyclopedia.
- [x] `src/lib/tour/steps.ts`: 17 steps → **16**. The `start-options` step folded into `field-focus`,
      whose copy now describes the cards. `data-tour="field-focus"` moved onto the `<summary>` so the
      spotlight hugs the label instead of a 28-card grid; `TourOverlay` now opens the `closest("details")`
      of any target, so the cards reveal behind the scrim.
- [x] **Test M-FD3:** build + lint clean; **383 unit tests** (+16). Real browser (1280px + 390px,
      light + dark, zero console/page errors): desktop grid open with 28 cards and every glyph rendering
      as a symbol; 390px folded to one line and opening on tap; Mathematics card →
      `?realm=encyclopedia&focus=field&bucket=mathematics&seed=Mathematics` with the "Within Mathematics"
      banner; Gallery still shows its 10 "Or start somewhere" tiles and no field section; the tour's home
      steps run "Realms to wander" → "Drift around a page" → "Or stay within a field" with the disclosure
      auto-opening on both widths. _(Two things were fixed by looking at the rendered page rather than the
      data. Books ❧ rendered as a smudge at tile size, so it became ◫, an open book. And the first palette
      was tuned to a ΔE ≥ 8 target, which came out reading like pastel sticky notes: a side-by-side render
      of four saturation levels picked the muted one, keeping the hue separation that fixes the problem
      while staying a quiet reading room.)_

**▶ Phase 18 COMPLETE.** Both directed-drift modes shipped: stay within a field, or orbit a page and
spiral outward — and the field picker is now the home page's card grid. Possible follow-ups (not
committed): field/orbit focus for Gallery/Papers (the engine is realm-generic); persist a focus as a
first-class trail attribute; an atlas tint for orbit drifts.

---

## Cross-cutting smaller polish (grab-bag — do anytime, not a phase)

- [x] **Sitemap + robots.txt (2026-07-22).** `src/app/sitemap.ts` → `/sitemap.xml` and
      `src/app/robots.ts` → `/robots.txt` (Next file conventions), both reading one source of truth,
      `src/lib/site.ts`: `siteUrl()` (`NEXT_PUBLIC_SITE_URL` with the live-site fallback, trailing
      slash stripped — `email/render.ts` now shares it instead of keeping its own copy) plus the
      explicit `INDEXABLE_ROUTES` / `PRIVATE_ROUTES` split. **Only `/`, `/privacy`, `/install`,
      `/contact` are submitted**: everything else is login-gated, so a crawler gets the same sign-in
      screen at each and indexing them would burn crawl budget on duplicates and risk soft-404 flags.
      Those are `Disallow`ed along with `/api/`. 7 unit tests, build + lint clean, both files verified
      by fetching them. **Submit `https://www.usedrift.org/sitemap.xml` in Google Search Console.**
- [x] **Homepage server-rendering, for that sitemap to be worth anything (2026-07-22).** `/` used to
      server-render only the loading placeholder (AuthGate resolves the session client-side), so
      Googlebot's first pass saw an empty shell: **~0 → 3,205 characters** of real landing copy in the
      HTML now. `AuthGate`'s `loading` branch renders `<Landing/>` on `/` instead of a spinner, and a
      second pre-paint script in `layout.tsx` (the same idiom as the theme one) sets
      `<html data-session="1">` when it finds a stored session, which three rules in `globals.css`
      use to swap in the quiet placeholder so a **signed-in visitor never glimpses the landing**.
      It has to be CSS, not a branch: the session lives in localStorage so the server cannot know, and
      React must hydrate the tree it server-rendered. **Not cloaking** — every visitor, crawler
      included, receives identical HTML; only which element occupies the layout differs, exactly like
      the theme. The storage key is now exported as `AUTH_STORAGE_KEY` from `lib/supabase/client.ts`
      so the script and the client can't diverge. Other gated routes keep the plain placeholder
      (they're `Disallow`ed, so there's no indexing to gain and their payload is untouched).
      **Verified** against a real gated production build (`next start`, Supabase env present): first
      paint with no stored session ⇒ landing `display:block` / placeholder `none`; with a stored
      session ⇒ landing `none` / placeholder `flex`; **zero hydration warnings or console errors**;
      `/drift` + `/trails` still plain, `/privacy` unchanged.

- [x] **Install guide (`/install`, 2026-07-19).** A calm, public (AuthGate-allowlisted) page with iOS (Safari)
      + Android (Chrome) "add to home screen" steps. iOS has 3 screenshot slots that gracefully fall back to
      labelled placeholders until the images are added (`public/install/ios-{1-share,2-add,3-confirm}.png`;
      see `public/install/README.md`); `InstallGuide.tsx` also has an "already installed" (standalone) note +
      a platform hint. Linked quietly from the homepage footer + `/account`. Build+lint clean, 296 tests,
      390px browser-verified (both sections, placeholders, no overflow, links).

- [x] **LaTeX/math rendering in Encyclopedia cards (2026-07-18).** Wikipedia's `explaintext` extracts render
      `<math>` as flattened-MathML "garble" (each symbol on its own indented line) followed by the TeX
      annotation `{\displaystyle …}`, which read as unreadable noise on math pages *and* corrupted read-more
      paragraph splitting. New pure `src/lib/mathtext.ts` (`preprocessMath` strips the garble + keeps the
      LaTeX in invisible markers, balanced-brace aware, indentation-based garble detection so prose
      connectors like ", and" survive; `splitMath`/`hasMath`/`stripMathMarkers`; 10 unit tests) runs
      server-side in `actionPageToCard` + `relatedToCandidates` + `wikiExtended` (before `topParagraphs`).
      Client `src/components/MathText.tsx` renders the markers with **KaTeX** (new dep `katex@0.18`,
      `throwOnError:false` so it never breaks a card; CSS in `layout.tsx`; `.drift-math` overflow guard in
      globals). Wired into `CardView` extract + read-more; inbox preview strips markers. **Verified:** Euler's
      identity + Quadratic formula render cleanly (7/9 KaTeX spans, no raw markup), read-more too, non-math
      pages unchanged, zero console errors. **280 tests, build+lint clean.**
- [x] **Interests copy: thumbs, not heart/cross (2026-07-18).** `/interests` still described reactions as
      "♥ / ✕"; updated to "A thumbs up or down" to match the current thumbs-up/down reaction buttons.
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

## Phase 19 — Email, Domain & Feedback: opening the door to real users  *(CODE COMPLETE 2026-07-19; a few user dashboard steps remain)*

> **Status: CODE SHIPPED (2026-07-19).** The user completed all prerequisites (domain **www.usedrift.org**
> on Vercel, Resend account + verified DNS, Resend SMTP configured in Supabase, Confirm-email ON, From =
> `noreply@usedrift.org`). Built this session (build+lint clean, **292 tests**): a shared branded email
> renderer (`src/lib/email/render.ts` + `messages.ts`, email-safe tables/inline styles, cream/ink/sage,
> the `drift-logo.png` at an absolute URL, no dashes); a graceful Resend send helper (`src/lib/email/send.ts`);
> **generated Confirm + Reset HTML** in `supabase/email-templates/` (share the look, `{{ .ConfirmationURL }}`);
> a **Welcome** email (idempotent `/api/email/welcome`, stamped once via `app_metadata.welcomed`, fired from
> AuthProvider on a confirmed sign-in) and a **Goodbye** email (sent from `/api/account/delete` before the
> user is removed, best-effort). UA defaults + docs moved to `www.usedrift.org`.
>
> **▶ Remaining (user dashboard, no code):** (1) paste `supabase/email-templates/{confirm-signup,reset-password}.html`
> into Supabase → Auth → Emails → Templates (subjects in that folder's README); (2) set Supabase Auth **Site URL** to
> `https://www.usedrift.org` + redirect URLs; (3) add `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
> `NEXT_PUBLIC_SITE_URL` to **Vercel** (server-only where noted) and redeploy; (4) the M-E1 security toggles
> (leaked-password, min length, secure password change) + a full live signup/confirm/reset E2E with a fresh
> address; (5) M-E3 feedback channel + M-E4 domain wiring double-check are still open (see below).
>
> Born from the
> beta-readiness research (`docs/beta-readiness.md`, Q1 + the deferred parts of Q4). The rest of that research
> (Wikimedia User-Agent, proxy caching, account deletion, "what we store" note, error boundaries, first-run
> coach) already shipped this session; everything that *depends on being able to send email* lives here. When
> the user has a domain + a Resend account wired up, an AI session can pick this up and work straight through
> it. All of it binds §2 (no notification bait, no engagement email — a digest at most, opt-in).

**▶ What you (the user) must do yourself BEFORE this phase can start** *(the AI can't do these — they need a
credit card / DNS / dashboard access):*
1. **Buy a domain** (e.g. `drift.example`) and, ideally, point the Vercel deployment at it (Vercel → Project →
   Settings → Domains). Decide the final From address (e.g. `hello@yourdomain` / `no-reply@yourdomain`).
2. **Create a free [Resend](https://resend.com) account**, add your domain, and add the DNS records Resend
   shows you (SPF, DKIM, DMARC) at your registrar. Wait for Resend to verify the domain (green check).
3. In Resend, create an **SMTP credential** (host `smtp.resend.com`, port, username `resend`, a password/API
   key). Have these ready.
4. In **Supabase → Authentication → Emails → SMTP Settings**, paste the Resend SMTP host/port/user/password +
   your From address, and **enable custom SMTP**. (You can do this, or hand the AI the values to guide you.)
5. Tell the AI: the production domain, the From address, and confirm SMTP is verified/sending. Then the AI
   works the milestones below.

*(Separately, note the already-shipped account-deletion feature needs `SUPABASE_SECRET_KEY` set as a
server-only env var in Vercel — that's independent of this phase; do it whenever convenient.)*

### M-E1 — Turn on real email (confirm + reset), verified end to end
- [ ] **Supabase → Auth → Providers → Email → "Confirm email" ON.** Sign-up then returns no session; the app
      already shows the "check your email" panel + resend (built in the auth overhaul). Verify redirect URLs
      (Site URL + Redirect URLs incl. `/account/reset`, the production domain, `localhost`) per `docs/deploy.md`
      Step 4.
- [ ] **Full auth E2E with a fresh, real address** (the flows are built but were flagged not-recently-live-tested):
      sign up → receive confirm email → click → sign in; forgot password → reset email → `/account/reset` sets
      new password → sign in; change password while signed in; sign out → local wipe → sign back in → trails pull.
- [ ] **Security toggles** (all free, in Supabase Auth settings): leaked-password protection (HaveIBeenPwned),
      a sensible minimum password length, and "Secure password change" (re-auth). Re-run `npm run verify:supabase`
      + `npm run verify:social` (RLS isolation) before opening signups.
- [ ] Decide **open signup vs invite/allowed-domain** gating (open + confirm is reasonable for known friends).

### M-E2 — Branded email templates (Drift's voice) ✅ *(code done 2026-07-19)*
- [x] Branded HTML for **Confirm signup** and **Reset password**, generated into `supabase/email-templates/`
      from the shared renderer so they match the welcome/goodbye look: cream paper, ink text, sage accent,
      serif heading, the logo, calm copy, no dashes. **User step:** paste into Supabase → Auth → Email
      Templates (subjects in the folder README). (Closes the standing hand-over item from memory `auth-and-email-status`.)

### M-E5 — Welcome + goodbye emails (app-sent) ✅ *(added per user; done 2026-07-19)*
- [x] **Welcome** after email verification: idempotent `POST /api/email/welcome` (verifies the caller's own JWT,
      checks `email_confirmed_at` + `app_metadata.welcomed`, sends once via Resend, then stamps `welcomed` so it
      never repeats). Fired best-effort from `AuthProvider` on a confirmed sign-in.
- [x] **Goodbye** on deletion: `/api/account/delete` sends the "sorry to see you go" email via Resend right
      before removing the user (best-effort, never blocks the deletion).
- [x] Shared `src/lib/email/*` (render + messages + send). Graceful: no `RESEND_API_KEY` ⇒ these skip silently.
- [x] **Verified:** build+lint clean, 292 tests; live sample send of both to the owner's inbox (see status).

### M-E3 — A calm feedback channel *(depends on the From address existing)*
- [ ] A quiet "Send feedback" link (the whole point of the beta is learning whether people reach for Drift, §9).
      Simplest: a `mailto:` to your address from a small footer/account link. Optional upgrade: a tiny form that
      posts to a server route which emails you via Resend's API. Calm, no widget, no nagging.

### M-E4 — Custom domain wiring *(depends on the domain)*
- [ ] Point Vercel at the custom domain; update **Supabase Site URL / Redirect URLs** and the email links/From to
      match (aligning the app domain with the sending domain also improves deliverability). Update
      `WIKI_USER_AGENT` / `ARTIC_USER_AGENT` to the new domain. Re-run the deploy smoke test.

**Phase 19 exit:** real users can sign up, confirm, and reset via branded email on your own domain; there's a
calm way for them to send feedback; the app lives on a proper URL. Combined with this session's shipped work,
Drift is production-ready for a 20–50 person beta.

---

## Phase 20 — The Guided Tour: first-run onboarding  *(started 2026-07-20)*

An optional, inviting, interactive walkthrough that (if accepted) walks a real "mini drift" end to end and
teaches every core feature in context. Calm + professional, mobile-first, always skippable; honors §2 (agency)
and §4 (works with the cloud off). Steps are pure typed data in `src/lib/tour/steps.ts` (no DB table, same
rationale as the static landing `EXAMPLE_TRAILS`). Full design: `~/.claude/plans/tranquil-petting-salamander.md`.
**User decisions:** full forced loop; Interests shown near the end (after a real reaction); Friends/Inbox left
out; welcome offered once per account (synced settings).

### M-T1 — Tour engine + welcome + home steps ✅ *(DONE & verified 2026-07-20)*
- [x] Pure `src/lib/tour/steps.ts` (the 16-step script + helpers) + `steps.test.ts` (order integrity, route
      follow-through, "no em/en dashes in copy" guard). **+16 tests → 312 total.**
- [x] `TourProvider` (layout-mounted inside AuthGate): context, forced-event `signal()`, route orchestration
      (advance on forced nav; escort to a concrete route; pause on prefix mismatch), once-per-account welcome
      gate with a sync-settle check, resume-across-reload via sessionStorage.
- [x] `TourOverlay`: four dim panels leaving the real control tappable in the gap + a highlight ring; coach card
      as a top/bottom sheet placed clear of the target and the swipe zone; reduced-motion; slim progress bar;
      always "Skip tour"; graceful "Skip this step" on a stall/target-miss.
- [x] `WelcomeModal` (first login): what Drift is + "Take the quick tour" / "Maybe later" (dismiss ⇒ done).
- [x] `data-tour` anchors on Home (realm-tabs, drift-cta, start-options); **Take a tour** replay on Home + Account.
- [x] `tourStatus` added to `Settings` (`storage.ts`), synced via the Phase 9 path.
- [x] Retired `FirstRunCoach` (deleted; intro folded into the welcome + drift steps).
- [x] **Verified:** build + lint clean, 316 tests; Playwright light+dark, mobile+desktop — welcome gate,
      spotlight, click-through the gap → `/drift`, route advance, persistence (no re-offer), replay; 0 console errors.

### M-T2 — Drift-page steps + forced interactions ✅ *(DONE & verified 2026-07-20)*
- [x] `data-tour` on the card/threads/chrome (`card-readmore`, `card-reactions`, `card-threads`, `advance`,
      `cross-realm`, `end-trail`).
- [x] Guarded `signal()` calls in `drift/page.tsx` (via `pushStep` by direction + `handleReact`/`endSession`):
      `reacted`, `threaded`, `drifted`, `crossed`, `ended`.
- [x] Steps: card anatomy, **forced thumbs up/down**, **forced thread pull**, **forced vertical swipe**,
      **forced horizontal cross**, **forced End**. (Per user: both swipe directions + a thread are forced.)

### M-T3 — Summary → trails → atlas → interests finish ✅ *(DONE & verified 2026-07-20)*
- [x] EndOverlay `data-tour` (`save-trail`, `view-trail`) + `saved` signal; forced Save + forced View in My Trails.
- [x] Anchors on `/trails/:id` (`trail-view`), `/atlas` (`atlas-canvas`), `/interests` (`interests-list`).
- [x] Steps: the trail, gently escorted Atlas + Interests finish ("you are the algorithm"); completion persists.

### Follow-ups folded in (user feedback, 2026-07-20)
- [x] Home tour now spotlights the two more-hidden directed-drift features: **drift around a page** (orbit search)
      and **drift within a field** (auto-opens the collapsed disclosure).
- [x] Reactions are **thumbs up/down**, not heart/cross: fixed tour copy + stale code comments
      (`CardView`, `drift/page.tsx`, `storage.ts`, `api/wiki/topics`). (Spec's heart = trail *like*, left as is.)
- [x] Verified the forced swipes/End now advance the tour (the earlier "nothing happened" was M-T1's missing
      anchors/signals, as expected): full Playwright drive green, all forced actions real.
- [x] **"This is a card" step** no longer pins a box to a shifting element (Read-more moves as the article/image
      load): it's now a stable centered card with the whole post visible behind, less forced. Only the forced-swipe
      steps pass gestures through; other non-spotlight steps keep a calm blocking scrim.
- [x] **Final outro slide** ("That's the tour"): escorts back home and points at Surprise me + the replay button.
      (Tour is now 17 steps.)
- [x] **"Look around" peek mode**: on content-heavy steps (`card`, `threads`, End, view-trail) a quiet "Look
      around" button hides the coach + scrim so the user can scroll / Read more / study the card or trail freely,
      while the drift page **holds navigation** (`useTour().holdNav` freezes swipe / thread / End / cross) so they
      can't drift off what they're studying; a floating "Continue tour" pill brings the coach back. Playwright
      verified: reading + Read more work, thread taps are inert, card unchanged, resume + advance clean, 0 errors.

**Phase 20 exit:** ✅ a new user is offered a calm optional tour once; if accepted it walks the whole loop with
real forced actions (thumbs, thread, both swipes, End, Save, view trail) and ends on Interests; declining is one
tap; it never nags and works fully with the cloud off.

---

## Phase 21 — Ads (exploration): a calm, killable in-feed ad  *(M-Ad1 + M-Ad2 BUILT & verified 2026-07-20, flag OFF)*

> ⚠️ **This deliberately tensions the core ethos.** Drift is the "anti-slot-machine" (§2) with a "no ads, no
> tracking" promise (StorageNotice, `/privacy`). This phase explores monetization at the owner's request: a
> single, calm, clearly-labeled ad every ~5 stops, **default OFF behind a kill switch**, with an **ad-free
> subscription** planned as the mitigation. Kept as gentle as possible: labeled, no autoplay, you scroll past it,
> it is **never part of a trail**. Build only when the owner asks; ship with the flag OFF.

**Feasibility (researched): YES, with caveats.**
- **Login gate is not a blocker.** AdSense serves on login-protected pages via a **crawler login** (Account →
  Access and authorization → Crawler access) once the account is active + the site is verified in Search Console.
- **Format fits.** An **in-feed / responsive display** unit rendered inside our own card chrome works as an
  interstitial "stop." Next.js integration is well-trodden (`next/script` + a client `<ins class="adsbygoogle">`
  + a re-key + one retry for SPA timing).
- **GDPR:** serving *personalized* ads in the EEA/UK/CH needs a **certified CMP** — use Google's built-in
  "Privacy & messaging" consent message (no third-party CMP needed). An `ads.txt` at the domain root is required.
- **Main risk: approval is uncertain.** AdSense wants original, high-value content; Drift shows mostly
  third-party Wikipedia (CC BY-SA) + AIC (CC0) content. Our curation/threads/trail add real value, but a reviewer
  may see reproduced content and reject. We can build + feel the whole UX with a **placeholder ad** (no AdSense,
  no cookies) regardless; real revenue depends on approval.

**Kill switch:** `NEXT_PUBLIC_ADS_ENABLED` (unset/`0` = OFF: no script, no ad cards, no cookies. byte-for-byte
the current app). Matches the existing flag pattern (`NEXT_PUBLIC_REALM_PAPERS`, `NEXT_PUBLIC_OAUTH_PROVIDERS`).
A second flag `NEXT_PUBLIC_ADS_MODE` = `placeholder` (calm house card, local testing) | `adsense` (real ads).
(Optional later: a Supabase config row for an instant, no-redeploy toggle.)

### Owner action items (do these before real ads can serve)
1. Create an **AdSense account** (adsense.google.com) with your Google account; add site **www.usedrift.org**.
2. Verify the site in **Google Search Console** (prereq for the crawler login on gated pages).
3. Add **`public/ads.txt`**: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` (your publisher ID).
4. Set up **Crawler access** for the login-gated feed: AdSense → Account → Access and authorization → Crawler
   access → a dedicated test login + the gated URL.
5. Submit for review and **wait for approval** (days to weeks; may be rejected for third-party content, be ready
   to add original value or appeal).
6. Turn on the **consent message**: AdSense → Privacy & messaging → European regulations → create + publish.
7. Create an **In-feed (or responsive display) ad unit** → note `data-ad-client` (ca-pub-…), `data-ad-slot`
   (+ in-feed layout key if in-feed).
8. Add env vars (Vercel + `.env.local`): `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_ADS_MODE`,
   `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT` (+ layout key).

### Milestones
- **M-Ad1 — Kill switch + placeholder ad card. ✅ DONE & verified 2026-07-20.** Pure `src/lib/ads.ts`
  (`parseAdsConfig`/`shouldShowAd`/`adsenseReady`, +8 tests) + a calm `src/components/AdCard.tsx` styled like a
  knowledge card ("Sponsored", muted), shown as an ephemeral interstitial every N drift-*scrolls* in `/drift`
  (thread pulls / crosses don't count), **never added to `history`/trail**, no autoplay (leave it by drifting on),
  suppressed during the tour. Wired in `drift/page.tsx` (`driftsSinceAdRef`, `showAd`, `advance`→`doDrift` split,
  `goBack` dismiss, render). `.env.local.example` documents the flags.
- **M-Ad2 — Real AdSense (dormant). ✅ DONE & verified 2026-07-20.** AdSense `<ins>` branch in `AdCard`
  (SPA-safe push + one retry, gated on `adsenseReady`); the **loader script** `adsbygoogle.js` loads via
  `next/script` in `layout.tsx` on `adsenseScriptEnabled` = **just the publisher id set** (decoupled from the
  kill switch, so the site can be *under review* with the script live but no visible ads); `public/ads.txt`
  carries the real `pub-3106905427372661` line; `/privacy` + StorageNotice flip to honest "uses Google AdSense /
  may set cookies" copy whenever the script is loaded, the "no ads / no tracking" copy intact otherwise.
  **Verified review state:** with only `NEXT_PUBLIC_ADSENSE_CLIENT` set, the loader script + `/ads.txt` are live,
  the disclosure copy shows, and no visible ad renders (kill switch off).
  **Ownership verification = the meta tag** `<meta name="google-adsense-account" content="ca-pub-...">`, rendered
  server-side via `metadata.other` in `layout.tsx` so it's in the STATIC HTML on every page (incl. the logged-out
  landing). This is required because `next/script` (afterInteractive) only emits a `<link rel=preload>` in the SSR
  HTML and injects the real loader after hydration, which AdSense's static-HTML verifier can't see. Confirmed via
  `curl` (no JS) that the meta tag is literally present.
- **M-Ad3 — Ad-free subscription (PARKED).** A paid tier that turns the ads flag off per account (Stripe or
  similar).

**Verified (Playwright, placeholder mode, every=3):** 3 drifts (stops 2→3→4, no ad) → 4th advance shows a calm
"Sponsored" card with the **stop count unchanged (ad not counted)** → dismiss resumes a real card; with the flag
OFF, **no ad over 6 drifts and no `adsbygoogle` script injected**. 320 tests, build + lint clean, zero console
errors.

**Phase 21 exit:** ✅ the owner can flip ads on (locally / in production), see a calm labeled ad every ~N stops
that fits the reading-room look and never pollutes a trail, and flip it fully off (no script, no cookies) at will.
Real revenue awaits the owner's AdSense account + approval (see the owner action items above).

---

## Phase 23 — "In the news": drift the articles behind current stories ✅ *(DONE & verified 2026-07-22)*

> Born from real use: a *field* drift is how Drift actually gets used, but a field is timeless. You read a
> great fact and it is not something anyone is talking about. This adds a third directed drift where the
> articles are the ones behind **what is going on right now**, labelled by subject, so during a World Cup
> "Sports" hands you 2026 FIFA World Cup, association football, Argentina national football team.

**The licensing question, answered — this does NOT reopen the parked news realm.** That was parked for good
reasons (all-rights-reserved outlets, EU Copyright Directive Art. 15 on snippets, Wikinews shut down; see
`memory/content-licensing-realms.md`). Drift still never displays news. News is only a **signal** for which
Wikipedia articles are current, and the signal comes from Wikipedia itself: **`Portal:Current events`**, a
daily page where volunteers summarise world news, already grouped into ten subject sections with every
notable entity wikilinked. Same CC BY-SA corpus the Encyclopedia realm already ships ⇒ **no new licensing
exposure**, no scraping, no publisher images. We read only the link targets; prose and external refs are
discarded.

**What the research measured (live, 2026-07-22).** 30 day-pages fetch in ONE Action API call (the 50-title
limit); pages are `Portal:Current events/2026 July 22` (no zero padding). Unique articles over 30 days:
Armed conflicts 803, Law and crime 416, Politics 374, Disasters 297, Sports 222, International relations 198,
Health and environment 180, Business 135, Science and technology 72, Arts and culture 59 — all ten viable,
where a 7-day window starves the quiet ones (Science drops to 20).

**Owner decisions:** all ten sections offered but ordered **lighter first** (a calm app should not open with
war, and hiding sections would be curation you can't see); label "Or drift what's in the news"; once a
section's pool is spent the drift **widens into related articles and says so**.

- [x] `src/lib/current.ts` (new, pure): `CURRENT_SECTIONS` (the ten sections with glyph/blurb/tint, so they
      render through the same `TileGrid` as the field cards), `sectionById` (the URL guard), `dayPageTitles`,
      `parseCurrentEvents`, `rankCurrent`, `freshnessWord`. **The ranking is the whole trick:** a bullet that
      is only a link is the story's *subject*; links inside prose are incidental. `3×header + prose + days,`
      decayed by recency, puts 2026 FIFA World Cup and association football on top of Sports and pushes
      "Sergeant" and "New York (state)" down.
- [x] `src/app/api/wiki/current/route.ts` (new): `?section=&offset=&limit=` → `{ card, daysAgo }[]`, ranked
      order preserved (deliberately NOT reshuffled imaged-first like `selectCardBatch`, since the ranking is
      the point). Reuses `wikiQuery` + `CARD_PROPS` + `isJunkPage` + `actionPageToCard`. `exlimit=max` (without
      it only the first page gets an extract), follows normalization/redirects, 15-min in-process memo of the
      parsed pool so ten sections don't each refetch, one 60-day retry if a section is unusually quiet,
      `CACHE_MEDIUM` on a real batch and `NO_STORE` on empty/error. Graceful: failures return `[]`, never a 500.
- [x] `src/lib/focus.ts` + `types.ts`: a **third `Focus` kind** (`current`) rather than a new realm, so it
      inherits all of Phase 18's machinery. `ArrivedVia.drift` gained `reason: "current"` + optional `current`
      detail; both optional ⇒ every saved trail still opens (only `ModeChip` reads `reason`).
- [x] `src/lib/orbit.ts`: `initOrbit` now accepts **several seeds**. The widening half of a news drift orbits
      every article the section served, so it stays near the actual stories instead of falling back to a field.
- [x] `src/app/drift/page.tsx`: a `current` branch that pages the pool, then flips to the multi-seed orbit when
      it is dry. `clearFocus` / `startOrbitHere` reset the pool refs and strip `section` from the URL.
- [x] `src/components/TileDisclosure.tsx` (new): the foldable card band (open on desktop, folded on mobile),
      now shared by both Encyclopedia sections instead of being inlined once.
- [x] `ModeChip` reads `In the news · today` / `· 3 days ago` / `· wandering wider`; `FocusBanner` gained a
      broadcast icon; the tour gained one step (17 steps).
- [x] **Test Phase 23:** build + lint clean; **412 unit tests** (+29: `current.test.ts` 22, focus 4, orbit 3).
      One test caught a real gap during development (headings written with `&` did not match `and`), fixed in
      the parser. Real browser, zero console/page errors: the news band opens on desktop and folds at 390px;
      Sports → `?focus=current&section=sports&seed=Sports`, banner "In the news: Sports", cards 2026 FIFA World
      Cup / Wimbledon / Argentina national football team with an `IN THE NEWS · 3 DAYS AGO` chip; **widening
      verified by stubbing the pool to 3 articles** → cards 4+ flipped to `IN THE NEWS · WANDERING WIDER` and
      stayed related (Belgium/Switzerland/Mexico at the FIFA World Cup); the tour reaches "Or read around the
      news" and opens the disclosure; with the route aborted the feed shows its calm "Couldn't load a card just
      now" retry instead of breaking (§4).

**Phase 23 exit:** ✅ you can pick a subject and read the Wikipedia articles behind this month's stories in it,
with the card always saying how current it is, and an honest hand-off to related reading when the news runs out.

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
