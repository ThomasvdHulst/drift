# Drift — Implementation Plan & Progress Tracker

This is the **living source of truth for progress**. Every session: read this, work the
current phase in order, and tick boxes (`- [ ]` → `- [x]`) as steps are completed and
**tested with success**. Keep the "Current status" line accurate. Full product detail is in
`drift-spec.md`; working rules are in `CLAUDE.md`.

> ## Current status: 2026-08-01
>
> **Drift is live** at <https://www.usedrift.org> (Vercel + Supabase) as an installable PWA, in a
> small friends-and-family beta. Two realms ship: **Encyclopedia** (Wikipedia) and **Gallery** (Art
> Institute of Chicago, CC0).
>
> **Gates:** 869 unit tests green, `npm run build` and `npm run lint` clean, `npm run audit:contrast`
> PASS (4,930 text nodes, 28 views x 2 themes). Backend: `npm run verify:supabase`,
> `verify:social`, `verify:share`. Update these numbers when they change.
>
> ### The compliance audit is fully implemented and closed out
>
> `docs/drift-compliance-audit.md` is the report (31 July 2026). `docs/owner-actions.md` is what is
> left for a human, rewritten 1 August into a short prioritised list. Six milestones, all verified,
> with full entries at the bottom of this file:
>
> | | |
> |---|---|
> | **M0** | The one live breach. The AdSense loader ran on every public page with no consent mechanism, setting a cookie, while earning nothing. One switch now governs everything Google. |
> | **M1** | Attribution that travels: per-image creator and licence, two fail-closed rules, the modification indication, an `attribution` block on every persisted card, images dropped from the PNG export. |
> | **M2** | The documents: `/terms` (DSA Art 14) plus `/terms.md`, the Art 16 notice route, the Art 11/12 contact points, `/privacy` rewritten to the Art 13 checklist on a **contract** basis, data export, and `docs/processing-record.md` (Art 30). Closing pass added **`/legal`**, the Art 3:15d BW imprint. |
> | **M3** | The Gallery is filtered for the **EU** term (life plus 70), not the museum's US determination. |
> | **M4** | The consent gate (nothing from Google before a choice, Accept and Reject at measured-equal weight) and the never-pre-ticked 16+ declaration. |
> | **M5** | Hygiene: a structural shared-cache guard, gzip to Wikimedia, `Retry-After` honoured, deletion cascades proved against the real migrations. |
>
> **Ads stay OFF, and the recommendation is that they stay off.** The gate is built and works, but
> Vercel Hobby is non-commercial only, so a rendered advert costs ~$240/yr against a few euros of
> revenue at this scale, on an AdSense account that is still refused. Reasoning in
> `docs/owner-actions.md` §2. Everything Google needs `NEXT_PUBLIC_ADS_ENABLED=1`, which is the one
> thing that must not be set before that file's §5 checklist is worked through.
>
> ### Where things stand
>
> **Shipped:** Phases 1, 2, 4, 5, 6, 8, 9, 10, 13, 14, 15, 18, 19, 20, 22, 23, 24, 25, 26. The core
> drift loop, directional threads, trails and the trail-map reward, the Atlas, the interest model,
> accounts and cloud sync, friends and sharing, cross-realm doorways, focused drift (field, orbit, in
> the news), branded email, the guided tour, the contact form, WCAG 2.2 AA colour contrast, and
> article tables.
>
> **Behind a flag:** Phase 17 **Papers** (arXiv), `NEXT_PUBLIC_REALM_PAPERS=1`. ⚠️ Do not enable in
> production before the two compliance items noted at the flag in `src/lib/realms/index.ts` (audit
> M-12). Phase 21 **ads**, `NEXT_PUBLIC_ADS_ENABLED` OFF, see above.
>
> **Hidden by owner decision (2026-07-27):** friends and sharing, behind `NEXT_PUBLIC_SOCIAL=1`.
> Nothing was deleted; set that var to bring the whole layer back.
>
> **Deferred by choice:** Phase 3 (local Ollama AI), 7 (constellations), 11 (calm social feed),
> 12 (native app), 16 (memory and reflection), M12 (Library/Today realms), M-Ad3 (ad-free tier).
>
> ### 🔴 Open owner items outside the audit
>
> - **Email templates may still need re-pasting.** A bug where confirmation and password-reset links
>   only worked in the browser you signed up in was fixed in code, but the fix lives in the templates
>   in `supabase/email-templates/` and they must be pasted into Supabase (Auth, Emails, Templates).
>   Unverified either way from here. See the 2026-07-27 bug-fix entry below.
> - **Turnstile is optional and not configured.** The contact form's other anti-spam layers work
>   without it. Setting both keys makes it fail-closed, and it would add Cloudflare as a processor.
>
> ### ▶ Next
>
> Open. **Phase 27 (sharing a card or trail outward) is complete and verified.** Ads were ruled out,
> so growth is now "a reader shows someone a thing": `/s/<token>` is a public page anyone can open
> from a chat, with three cards to try before an account is needed. ⚠️ Public links reclassify Drift
> as a DSA **online platform**; Article 19 (micro enterprise) keeps the obligation delta near zero,
> `/terms` now says so accurately, and **that exemption depends on staying one person**.
>
> Candidates: Phase 16 (Memory and Reflection) is the last of the three brainstorm directions. A
> **second art source** (Cleveland Museum of Art: CC0, no API key, 41,476 open-access works) is the
> obvious follow-up if artist drifts feel thin, and would want the same EU-term filter M3 built for
> the Art Institute.
>
> _Full per-phase history is in the log below, oldest first. Keep this block SHORT: it is status, not
> history. When something ships, add a log entry at the bottom and update the summary here rather
> than stacking another "Latest" paragraph._

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

- [x] **AdSense-review readiness: About page + shared nav + SEO (2026-07-23).** Prep for the Google
      AdSense site review (which values transparency pages, clear navigation, and basic SEO). No app/feed
      change. **New `/about` page** (`src/app/about/page.tsx`): a calm, plain-language "what Drift is / why
      it exists / where content comes from / who makes it" (an independent, non-commercial project), public
      (added to `AuthGate` `PUBLIC_ROUTES` + `site.ts` `INDEXABLE_ROUTES`, so it is in the sitemap and
      crawlable). **New `PublicFooter` component** used by the landing AND every support page (about, contact,
      privacy, install), giving all of them the SAME clear link menu (Home · About · Contact · Install ·
      Privacy) + the licensing note + a copyright line — so **Contact is reachable from every public page**,
      not just the landing footer. The landing header gained an **About** link beside Sign in. **SEO:** root
      `metadata` now sets `metadataBase`, per-page `alternates.canonical`, and OpenGraph/Twitter (title +
      description auto-propagate per page; `icon-512.png` as the card image). Below-the-fold landing images
      got `loading="lazy"`. **Verified** on a real gated production build (`next start`): every public page is
      statically prerendered (fast CDN delivery), `/about` HTML carries a unique title/description + correct
      canonical + OG tags, `/sitemap.xml` lists `/about`, robots unchanged, header/footer nav links work
      (Playwright), no mobile h-overflow, zero console errors. 419 unit tests, build + lint clean. **Owner
      TODO after approval:** flip `NEXT_PUBLIC_ADS_ENABLED` on (Phase 21) once AdSense approves.
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

- [x] **Fix (2026-07-23) — "caught up" instead of a false load error.** Re-entering an "in the news" section
      you'd already drifted deep into showed *"Couldn't load a card just now"* because the initial load fetched
      only page 1 of the ranked pool and filtered out already-seen cards. Now the open **pages past the seen
      prefix** (up to `CURRENT_MAX_PAGES`) to find an unseen article, and if the *whole* section is read it opens
      on the best story you've already seen with a one-time **"you're all caught up on this section"** notice + a
      persistent **"· caught up"** banner marker (§2.1). A caught-up drift keeps serving new "wandering wider"
      neighbourhood cards, then gently recycles seen stories ("In the news · seen before") — never a dead-end or
      error. The live-drift pool loop also pages properly now (only a genuinely empty page marks the pool dry;
      transient errors retry). Verified with build + lint + 419 unit tests, and a Playwright run reproducing the
      exact bug (drift 8+, reopen → loads a deeper unseen card, no error) + the fully-seen caught-up path.

---

## Phase 24 — A Richer Gallery: drift a form, a period, or an artist ✅ *(DONE & verified 2026-07-25)*

**Why.** The Encyclopedia had three ways to begin a directed drift (a field, a page orbit, "in the news");
the Gallery had one, and its ten themed buckets only pick a *starting point* rather than confining the
session. Beta feedback asked for parity: "only paintings, from year X to Y", and "search Van Gogh, then
wander his work".

**What the research found** (verified live against `api.artic.edu`, 2026-07-25):

- `/artworks/search` is an Elasticsearch passthrough that accepts **range queries on `date_start`** and
  **`match_phrase` on `artwork_type_title`**, so a form + period slice is one exact query. It also serves
  **aggregations**, which is how the counts below were measured.
- **AIC is a works-on-paper collection**, not a greatest-hits-of-painting museum: 24,509 public-domain
  prints and 7,552 drawings against 2,093 paintings. Van Gogh has **18** works, Monet 46, Hokusai 447.
  A session is ~25 cards, so thin artists must **widen** rather than dead-end (M-G3).
- **Artists outside the public-domain collection resolve to garbage** ("Picasso" surfaces Ancient Greek
  pottery), so M-G3 needs a real confidence gate, not a nicety — §2.1 requires it.
- **Decided:** AIC only for now. Cleveland Museum of Art is a viable follow-up second source (CC0, no API
  key, 41,476 open-access works with images, **3,956 public-domain paintings**, rich single-call records).
  The Met was **rejected**: its filters are unreliable (`artistOrCulture=true` returns 0 for Monet,
  Hokusai *and* Rembrandt) and search returns bare IDs needing one fetch per artwork, which is exactly the
  shared-IP N+1 trap in `docs/beta-readiness.md`. Wikidata/Commons would solve depth but is uncurated.

### M-G2 — Drift a form and a period ✅ *(DONE & verified 2026-07-25)*

- [x] **`src/lib/realms/artic.forms.ts`** — pure registry, mirroring `artic.buckets.ts`. Ten forms
      (alphabetical, six-family tint cycle) × a seven-step era ladder, plus the measured counts. Labels read
      "1850 to 1899", never with an en dash (standing copy preference).
- [x] **`scripts/probe-artic-forms.mjs`** — hand-run one-shot that measures the form × era matrix via
      aggregations and prints a paste-ready literal. Baked rather than fetched so the homepage never offers
      a slice that turns out to be empty, and so rendering tiles costs no upstream call.
- [x] **`erasForForm`** hides periods a form lacks: photographs offer no century before 1800, coins offer
      only "Before 1500". `MIN_ERA_WORKS = 60`.
- [x] **The bucket seam carried it.** A slice rides the existing opaque `bucket` string as
      `form:<form>:<era>`, so `/api/realm/[realm]/discover`, `discoverUrl` and the refill loop needed **no
      change**; `parseFormBucket` doubles as `validateBucket`'s injection guard.
- [x] **`pdForm` + `formDiscover`** in `realms/server/artic.ts`, clause-for-clause identical to the probe
      (including the `exists: image_id` gate) so the baked counts describe exactly what discover draws from.
      `FORM_SPREAD = 60` samples deeper than the themed buckets, since these slices are far bigger.
- [x] **A fourth `Focus` kind** (`form`) in `lib/focus.ts`, validated by round-tripping through the
      registry, plus `focusBucket()` so the feed never spells a slice itself. The field-focus pin in
      `drift/page.tsx` generalized to "any bucket-pinned focus" (field in Encyclopedia, form in Gallery).
- [x] **`src/components/FormEraPicker.tsx`** — two-step picker on the Gallery home: pick a form (which
      reveals its real periods with counts), then a period, or "All periods". Folded on mobile, open on
      desktop, same rule as `TileDisclosure`.
- [x] **Caught a real UI bug:** "Textiles" appeared in *both* Gallery grids with the same glyph and a
      near-identical blurb, so two tiles looked like duplicates while behaving differently (start here vs
      stay here). The form tile now carries its own glyph + blurb, and a test asserts no form tile can ever
      collide with a themed bucket tile again.
- [x] **Test M-G2:** build + lint clean; **449 unit tests** (+30). Real browser (isolated ungated instance,
      Playwright, real UA): era chips render with live counts (Paintings 7, Photographs 3, Coins 1);
      **12 consecutive drifts in "Paintings, 1850 to 1899" gave 12 unique in-period paintings** (Courbet,
      Whistler, Fantin-Latour, Cézanne, Sargent, Inness) with the banner pinned and zero console errors;
      all five injection attempts (`form:photograph:1600s`, `form:sonnets:all`, `form:painting:1750s`,
      `form:painting`, a quoted `OR 1=1`) return **400**; light + dark + 390px, no horizontal overflow.
      *Note: `curl`/headless-UA requests to `artic.edu/iiif` get a Cloudflare "Just a moment" 403; a real
      browser UA returns 200. That is a test artifact, not a product bug.*

### M-G3 — Drift an artist ✅ *(DONE & verified 2026-07-25)*

- [x] **`src/lib/realms/artic.artist.ts`** — `rankArtists` tallies `artist_id` over the top public-domain
      hits, then **gates each candidate on a diacritic-folded name match** (every meaningful query token
      must appear in the name). This is what makes "van gogh" keep Vincent and drop Rembrandt van Rijn,
      lets "durer" match "Albrecht Dürer", and makes "Picasso" return **nothing** instead of pottery.
- [x] **The widening ladder**, as testable data: ring 0 the oeuvre → ring 1 their movement → ring 2 their
      period and medium. Two data traps found by probing and handled:
      - **`isMovement`** rejects period labels. AIC files "19th century" in the same `style_title` field as
        real movements, and for Dürer a century label is the *only* value present, so his ring 1 is
        correctly skipped entirely.
      - **`movementHolds`** rejects a movement attested on almost nothing: Rembrandt is filed "Renaissance"
        on 1 of his 235 works, so he too widens straight to his period.
- [x] **`articArtistProfile`** measures an artist by aggregation. The era comes from a **range aggregation
      over our own era ladder, not `min`/`max` on `date_start`**, because outliers wreck min/max (Hokusai's
      minimum is the year 19; Dürer's maximum is an 1864 later impression of a 1500s plate). Bucketing gives
      Hokusai 1800-1849 and Dürer the 1500s. Cached in-process for 30 minutes.
- [x] **Widening is just a bucket swap** (`artist:<id>:<ring>`), so it needed no pool of its own the way an
      orbit does; `refillRandomBuffer` steps the ring when a refill comes back empty.
- [x] **`/api/realm/gallery/artists`** serves both `?q=` (resolve + true counts + thumbnail) and `?id=`
      (the profile). `validateBucket` accepts `artist:<digits>:<ring>`.
- [x] **`src/components/ArtistSearch.tsx`**, modelled on `OrbitSearch.tsx`, showing each artist's real count
      ("Katsushika Hokusai · 447 works here") so depth is known *before* committing, and a plain sentence
      when nothing matches rather than leaving stale results up.
- [x] **Caught two real bugs in verification:**
      - **The seed path used `randomOffset()` (0..400) for a finite oeuvre**, so opening any artist drift
        landed past the end of their work and showed *"Couldn't load a card just now"* on nearly every open.
        An artist now seeds from offset 0 and refills continue sequentially from there.
      - **Widened cards kept crediting the artist.** A Gauguin served from ring 1 still read "drifting ·
        Vincent van Gogh". `artistRingLabel` now relabels provenance per ring
        ("Post-Impressionism, around Vincent van Gogh"), which is the §2.1 requirement.
- [x] **Test M-G3:** build + lint clean; **476 unit tests** (+27). Live API: the gate returns 0 results for
      Picasso, Kahlo, Banksy and Warhol, and true counts for Van Gogh 18 / Hokusai 447 / Dürer 253 /
      Cassatt 53; ring 0 pages through **exactly 18 unique Van Gogh works then empties at offset 20**; all
      six malformed artist buckets return **400**. Real browser, 26 consecutive drifts, **26/26 unique, zero
      console errors**: stops 1 to 18 are Van Gogh, stop 19 widens with the banner reading *"Vincent van
      Gogh · wandering wider · Post-Impressionism"* and the provenance line changing to match (Gauguin,
      Munch, Toulouse-Lautrec, Vuillard follow). Dürer's ring 1 is empty and his ring 2 serves 1500s prints,
      confirming the no-movement path.

### Period picker: the choice appears where you tapped (2026-07-25)

- [x] **Problem (user report):** picking a form on a phone rendered its periods *below the whole grid*.
      Ten tiles in two columns is five rows tall, so choosing "Coins" opened its periods somewhere below
      the fold: nothing visibly happened, and a first-time user had no reason to scroll looking for it.
- [x] **Fix, chosen over auto-scrolling:** `TileGrid` gained optional `selectedId` + `panel` props, and
      slots the panel into the grid as a full-width row **at the end of the row holding the selected
      tile**. The periods now open directly under what you just tapped, on every breakpoint, so no
      scrolling is needed at all and the grid never jumps under you. The chosen tile also takes an accent
      ring, so the two-step pick shows its state. Column count is read from the resolved
      `grid-template-columns` (via `ResizeObserver`) rather than duplicating the Tailwind breakpoints in
      JS, so the two cannot disagree.
- [x] **Safety net:** a `scrollIntoView({ block: "nearest" })` for the one remaining edge case, a tile
      sitting at the very bottom of the viewport. `nearest` scrolls the minimum needed and does nothing
      when the panel is already visible, so it never yanks the page.
- [x] **Verified:** build + lint clean, 476 tests green. Measured on a 390x844 phone AND a 1280x1000
      desktop: for all of Ceramics / Coins / Paintings / Textiles / Vessels the panel is **fully inside
      the viewport**, 12 to 14px under the selected tile's row, with the right tile marked. Light + dark,
      no overflow, zero console errors. The Encyclopedia's field grid (28 tiles) and news grid pass no
      `panel`/`selectedId` and were confirmed unchanged (no panel node, no `aria-pressed`, a field tile
      still starts a focused drift).

### Gallery home cleanup (2026-07-25)

- [x] **Retired "Or start somewhere" from the Gallery** (owner request: the two new directed entries cover
      it and the page looked crowded). The Gallery now mirrors the Encyclopedia's shape exactly: a
      "Surprise me" button, a search ("Or drift an artist"), and a tile grid ("Or drift a form and a
      period"). The ten themed buckets are **not** deleted: they still power "Surprise me in Gallery" via
      `pickDiscover`, and still resolve for any saved trail. Papers keeps its "Or start somewhere" grid.
      Verified: "Surprise me in Gallery" still loads a card, and the tour never targeted the removed
      section, so it is unaffected.

**Phase 24 exit:** ✅ the Gallery is as steerable as the Encyclopedia. You can confine a session to an art
form and period, or to an artist, with every card saying honestly where it came from and the drift widening
out loud rather than dead-ending or quietly changing the subject.

---

## Card layout on phones: threads follow the read ✅ *(DONE & verified 2026-07-25)*

**Why.** Beta feedback: on a phone the reading area felt cramped, and the pinned "Pull a thread" bar was
eating it. Measured on a 390x844 phone, and the numbers were worse than expected:

| | scroll viewport | pinned threads bar | prose visible at first paint |
|---|---|---|---|
| Gallery, before | 533px | 172px | **26px** |
| Encyclopedia, before | 473px | **232px** | **28px** |
| **After** | **704px** | 0 (inline) | **~210px** |

The Encyclopedia was the worse of the two, because its directional chips are two-line and wrap to three
rows. Either way a reader saw roughly ONE line of text before having to scroll. As the user put it: while
scrolling you want the image, the title and the text; the threads only matter once you have read enough to
want to go deeper.

**What changed.** `ThreadsSection` in `src/components/CardView.tsx` now renders in one of two places:

- **Desktop keeps the pinned bar**, unchanged. There is height to spare, and permanently visible
  directions are the clearest expression of "you are the algorithm".
- **Phones inline the threads at the END of the reading flow**, after "Read more"/the source link, so the
  order reads: read it, go deeper, or drift on. The scroll region gains the whole bar back.

**Keeping the threads discoverable** (§2.2 — they are the core mechanic, so pushing them below the fold
needed an answer): while they are off screen, a small sticky pill floats above the fold saying exactly
what is down there, e.g. "3 threads below", and one tap scrolls to them. It clears itself the moment the
chips are actually in view, so it is a cue and never a nag. It costs ~30px instead of the bar's 172-232px.

Two details that matter and are easy to get wrong:
- The pill uses `-mt-14` against its own `h-14` so it contributes **no scroll height**. The feed's
  overscroll-to-advance reads this container's `scrollHeight`, and a floating hint must not move where the
  bottom edge is.
- It stays **inside** `[data-drift-scroll]` rather than overlaying from outside, so a swipe that starts on
  it is still read as "scrolling to read" and not as an instant advance (`insideRegion` in `lib/gesture`).

- [x] **Tour fix:** `TourOverlay` resolved its target with `querySelector`, which would have picked the
      hidden copy of a duplicated `data-tour`. It now prefers the match that actually has a box. Verified
      it resolves to the pinned copy on desktop (554x111) and the inline copy on mobile (310x156).
- [x] **Verified:** build + lint clean, **476 unit tests** still green (no pure logic changed). Real
      phone viewport (390x844, iOS UA), both realms: prose visible at first paint went from ~27px to
      ~210px. **The gesture model is intact** — a synthetic touch swipe mid-text does NOT advance, a swipe
      at the bottom advances (Bioluminescence → Chemiluminescence), a swipe down at the top goes back.
      The hint appears on a long card, disappears after tapping it, and the bottom edge is still reachable.
      Desktop confirmed byte-identical in behaviour (inline copy hidden, pinned copy 111px). Light + dark,
      no horizontal overflow, zero console errors.

---

## Bug fix: confirmation links only worked in the browser you signed up in ✅ *(2026-07-27)*

**The report.** A friend created an account, clicked "verify" in the email, and landed on the
homepage **signed out**, with `?code=<uuid>` in the URL. Signing in then said their credentials did
not match. The owner reproduced it: clicking the link on a phone after signing up on a laptop
failed, but pasting that same URL into the laptop's browser signed them in instantly, and doing the
whole flow inside one non-private tab worked fine.

**Root cause (confirmed against the live project).** Drift used Supabase's **PKCE** flow. `signUp`
stores a `code_verifier` in the localStorage of the browser that starts the sign-up, and the emailed
link returns to the app with `?code=`; redeeming that code REQUIRES the verifier. So the link only
ever worked in that one browser profile. A diagnostic against the real project made it explicit:
after `signUp`, browser storage held exactly one key, `drift-auth-code-verifier`, and exchanging the
code in a second client without it failed. **Anyone who signs up on a laptop and opens the mail on a
phone, uses a private tab, or taps the link inside a mail app's in-app browser hits this** — and it
failed *silently*, which is why it looked random. **Password-reset links had the same flaw.**

The "credentials didn't match" half is a separate, honest message: Supabase returns
`invalid_credentials` (a genuinely wrong password) and `email_not_confirmed` as *different* errors,
and clicking the link **does** confirm the address server-side even when the exchange then fails.
So the account was live and the password simply did not match. Nothing in the code produces that
message for a correct password on a confirmed account, verified directly against the API.

**The fix.** Email links now carry `{{ .TokenHash }}` and land on a new **`/auth/confirm`** page,
which redeems them with `verifyOtp`. That call needs nothing from local storage, so it works in
whichever browser actually opened the email.

- [x] `src/lib/auth.ts` — `parseAuthLink` (pure, unit-tested) classifies every shape a link can
      arrive in: `token_hash`, legacy `?code=`, implicit `#access_token=`, a Supabase error, or
      nothing. Plus `describeLinkError` and `destinationFor`.
- [x] `src/app/auth/confirm/page.tsx` — redeems a token_hash; watches for the session on the older
      shapes; and when a legacy `?code=` link cannot be exchanged it **says so plainly** ("opened in
      a different browser… your email is confirmed, so you can sign in with your password") instead
      of dropping the reader on a signed-out homepage. Added to `AuthGate`'s `PUBLIC_ROUTES`, since
      the person opening a confirmation link is by definition not signed in yet.
- [x] `AuthProvider` — new `verifyEmailToken`; sign-up, resend and password-reset all now point at
      `/auth/confirm`.
- [x] **Email templates** (`supabase/email-templates/*.html`, generated from
      `src/lib/email/messages.ts`) rewritten to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=…`.
      `templates.test.ts` now asserts the committed HTML matches the renderer AND still uses the
      token_hash link, so this cannot silently regress. An old test that *asserted the buggy
      `{{ .ConfirmationURL }}`* was updated.
- [x] **Verified against the real Supabase project**, every case in a BRAND NEW browser context with
      no storage and no verifier (i.e. exactly the situation that used to fail):
      signup token_hash → signed in, lands on `/`, email confirmed; recovery token_hash → signed in,
      lands on `/account/reset`; a reused token, an invalid token and an expired-link redirect each
      fail with clear copy instead of hanging; a legacy `?code=` link explains itself; the page
      renders while signed out. Then the **actual committed templates** were substituted the way
      Supabase substitutes them and the extracted `href` was clicked in a fresh browser: both work.
      Ordinary sign-in, the gate, and the wrong-password message were regression-tested through the
      real UI. 498 unit tests, build + lint clean. Test users were created and deleted via the admin
      API, so no inboxes were spammed.

> **⚠️ One owner step, or the fix stays inert.** Supabase → Auth → **Emails → Templates** → re-paste
> **Confirm signup** and **Reset password** from `supabase/email-templates/`. The templates are where
> the link lives, so until they are re-pasted the old `?code=` links keep going out (they now fail
> with a helpful message rather than in silence, but they still fail cross-browser). Also confirm
> **Site URL** is `https://www.usedrift.org`, since the links are built from `{{ .SiteURL }}`.

---

## Friends + sharing hidden behind one switch ✅ *(2026-07-27)*

**Why.** Owner decision: the social surface was pulling attention away from the core reading loop,
and the priority is to perfect the main content first. Explicitly **hidden, not deleted** so it can
come back.

- [x] **`src/lib/social/enabled.ts`** — one opt-IN flag, `NEXT_PUBLIC_SOCIAL=1`. Only the literal
      `"1"` enables it, so an unset or malformed env var can never switch it on by accident (pure +
      unit-tested, mirroring `adsConfig()`).
- [x] **Hidden while off:** the Friends and Inbox buttons on the home page; the "send this card"
      control on a drift card; "Send to a friend" on a trail; the handle picker and "find & add
      friends" link on the account screen. `/friends` and `/inbox` quietly send you home instead of
      sitting there as orphan URLs (a guard *wrapper*, so the pages' own hooks still run
      unconditionally when they are mounted).
- [x] **Copy that promised it was corrected:** the guided tour no longer says a trail can be sent to
      a friend, and /about no longer offers to "share with a friend".
- [x] **Nothing removed:** the pages, `src/lib/social/*`, the `profiles` / `friend_requests` /
      `shares` tables and their RLS are all untouched.
- [x] **Verified both ways** in a real signed-in browser. Off: 8/8 surfaces gone and both URLs
      redirect home. On (`NEXT_PUBLIC_SOCIAL=1`): the Friends and Inbox buttons, the /friends page
      and the handle picker all return, no console errors. Turning it back on is a one-line env change.

> **Note:** there was never any *atlas* sharing to hide. Share kinds are only `trail` and `card`
> (`ShareKind` in `src/lib/social/client.ts`); the Atlas page's only button is a local
> "Export image" PNG download, which is unaffected.

## Bug fix: the 404 page showed the landing page to signed-out visitors ✅ *(2026-07-27)*

**The report.** Typing a random URL showed the home page. The browser tab said "Page not found", but
the page itself did not change.

**Root cause.** `AuthGate` lived in the ROOT layout, so it wrapped `app/not-found.tsx` too. For a
signed-out visitor any route outside its small public allowlist renders `<Landing />` — including
the 404. Reproduced exactly: **signed out**, `/definitely-not-a-real-page` gave title "Page not
found" with the landing page in the body; **signed in**, the same URL rendered the real 404. So the
custom 404 had been invisible to precisely the visitors most likely to hit it.

**The fix.** Every real page moved into an `(app)` route group whose layout now holds the gate, so
`not-found.tsx` and the error boundaries are siblings of the group rather than children of the gate.
A route group's name is in parentheses, so **no URL changed** (verified against the build's route
list). `AccountButton` and `TourProvider` moved down with the gate; `ThemeToggle` and
`StorageNotice` stay at the root so they also render on the 404.

- [x] **Verified 18 route/auth combinations in a browser.** Signed out: bogus URLs (one and three
      segments deep) render the real 404; `/` still shows the landing; **`/drift`, `/trails`,
      `/atlas`, `/interests`, `/friends`, `/inbox` and `/account` all still show the landing and
      never the app** (the gate is intact, which was the thing to get wrong here); the five public
      routes still render their own content. Signed in: bogus URLs render the 404, and `/`, `/drift`
      and `/trails` render the app. Light and dark checked.

---

## The guided tour, made usable on a phone ✅ *(2026-07-27)*

**Why.** After the card relayout the reading area scrolls further, so "swipe up to drift on" needed a
much longer scroll first, and the tour became hard to follow on a phone. The storage notice piling on
top made it worse. Walking the whole tour at 390x844 and measuring turned up four real defects, two
of which were outright broken behaviour rather than polish.

- [x] **The storage notice sat on top of the thing being taught.** It is ~150px (18% of a phone
      screen), bottom-anchored, and stayed up for **every step of the tour**. During "Pull a thread to
      steer" it literally covered the thread chips the step points at (screenshotted). It now steps
      aside for the length of the welcome + tour via `<html data-tour-active>` + one CSS rule, and is
      **hidden, never dismissed**, so the disclosure is still made afterwards. CSS rather than state
      because the notice is mounted in the root layout, outside the tour provider (it must also show
      on the signed-out landing).
- [x] **"Swipe up to drift on" was untrue when you read it.** Drifting onward is deliberately an
      *overscroll* at the END of a card, and this step is normally reached by tapping a thread, which
      loads a fresh card scrolled to the top. So the instruction appeared while swiping up correctly
      did nothing. The step now scrolls the card to its end first. That needed a retry loop, not a
      one-shot: the new card mounts *after* the step does and resets the scroll, which the first
      attempt at this fix did not survive.
- [x] **Skipping a step could silently end the tour.** "Skip this step" called plain `advance()`.
      The steps after "open your trail" are anchored to a route only reachable by doing what was just
      skipped (`match: "prefix"`), and the route orchestrator pauses rather than navigating to those,
      so the overlay just stopped rendering: **skipping "Keep it close" swallowed the trail, Atlas,
      Interests and outro steps.** A verified walk ended at step 13 of 17. `skipStep` now walks
      forward to the next step it can actually show, and also steps over steps whose target is not on
      screen, so skipping "End when you like" no longer leaves two steps describing a trail map the
      user never opened (it goes to the Atlas instead).
- [x] **A stuck user waited 7s** for the escape hatch to appear. Now 4s: long enough never to
      pre-empt someone mid-gesture, short enough that being stuck doesn't read as "this is broken".
- [x] **New step: "Circle one idea"** explains the orbit control, the one unlabelled icon on a card
      (it reads as an eye and invites a tap without saying what it does). Placed right after the
      reactions it sits beside, and deliberately **not** forced: tapping it re-anchors the whole
      session to that page, which is more than a walkthrough should demand. `data-tour="card-orbit"`
      added to the button.

- [x] **Verified by driving the real tour, both paths, both breakpoints.** *Happy path* (a user who
      actually does each step, iPhone viewport, real touch events): **11/11 steps advance, including
      swipe-up on the first try** — the thing that was broken. *Skip path*: all 17 steps now reached
      (was 13). *Adversarial*: 8/8 — the notice hides for the welcome modal, returns when the tour is
      declined or quit, stays dismissed if it was already dismissed, and skipping "End when you like"
      jumps to the Atlas and still reaches the ending. Desktop walks all 15 non-forced steps with the
      eye correctly spotlighted. Zero page errors throughout. 505 unit tests, build + lint clean.

---

## Bug fix: the cross-realm swipe could vanish, and the orbit control looked inert ✅ *(2026-07-27)*

**1. "In the tour the side swipe does not always work; outside it works perfectly."**

Root cause, and it was never really about the tour. The card's reading region is vertically
scrollable with the default `touch-action: auto`, so a sideways drag over the prose is a gesture the
BROWSER may decide to claim for scrolling. When it does, it fires **`touchcancel`** and stops sending
`touchmove`/`touchend`. The feed only listened for `touchend`, so a claimed swipe was **silently
dropped** and the gesture felt like it "got stuck in the text". It showed up in the tour because the
coach card occupies the top of the screen and pushes your thumb down into the middle of the prose,
where outside the tour you often swipe over the image (not scrollable, never claimed).

- [x] **`touch-pan-y` on the reading region** — the primary fix. The browser now only claims vertical
      pans, so a horizontal drag is never stolen. Reading scroll stays native and fast; nothing scrolls
      sideways, so nothing is lost. Applied as the Tailwind utility on the element: the same rule
      written as plain CSS in `globals.css` lost to Tailwind's layers and computed `auto`, which the
      test caught.
- [x] **`touchcancel` is handled** as a fallback for a genuinely diagonal drag, resolving from the last
      `touchmove` position. A cancelled gesture can only ever CROSS, never advance: the browser
      cancelled it because it was scrolling the text, so treating it as an overscroll would advance the
      card while someone was reading.

**2. "The fixating button should light up when you click it, like the like/dislike."**

- [x] The orbit control is now a **toggle that shows its state**: sage and filled while the session is
      orbiting, plain otherwise, exactly matching the reaction buttons (`aria-pressed` too). Tapping it
      again releases the focus, so the control that lit it can un-light it. Lit only when orbiting
      **this card's** page, so once the orbit carries you outward the neighbour's control is unlit and
      tapping it re-anchors there. Previously the sole feedback was the focus banner, so the button
      read as doing nothing.

- [x] **Verified** on an iPhone viewport: `touch-action` really resolves to `pan-y`; a
      browser-cancelled horizontal drag still crosses realms; a cancelled vertical drag correctly does
      NOT advance; the orbit button starts unlit, lights on tap (banner agrees), and unlights on a
      second tap with the banner gone. Then the whole tour happy path again, **11/11 including a
      deliberately CANCELLED sideways swipe** at the step that was failing. 505 unit tests, build +
      lint clean, zero page errors.

---

## Tour follow-ups: the eye hands off to the banner, and the cross swipe works ✅ *(2026-07-27)*

**1. "After you click the eye in the tour, could the focus shift to the banner?"**

- [x] "Circle one idea" now asks the reader to actually tap the eye (`advance: "orbited"`, a new
      `TourEvent` the feed signals when the toggle turns an orbit ON), and a new step
      **"You are circling it"** spotlights the focus banner it just switched on, naming what a focus
      is and both ways to let go. Tapping an icon and being left to notice a small pill appear
      elsewhere taught nothing.
- [x] A reader who skips the tap never sees the banner step: no banner exists in the DOM, and
      `TourProvider.skipStep` already steps over targets that are not on screen. No extra machinery.

**2. "The horizontal swipe still seems to block in the tour sometimes."**

Two separate causes, both found by driving the tour rather than reading the code. A run that tapped
the eye and a run that did not failed at *different* points, which is what made it look random.

- [x] **Tapping the eye disabled the cross swipe outright.** `crossEnabled = canCross && !focus`,
      because crossing is a deliberately single-realm intent. So the step that had just invited the
      reader to start an orbit was followed by a step asking for a gesture that orbit had disabled:
      the swipe was ignored, silently, every time. Verified directly (tapped the eye ⇒ BLOCKED; did
      not tap ⇒ reached the step). The feed now **releases any focus as the cross step opens**, so
      the instruction is honest, and the banner step immediately before has already explained
      letting go. A unit test pins the step order this depends on.
- [x] **The swipe-up pre-scroll was itself flaky**, which stranded the tour one step earlier. It
      scrolled and then checked the result *in the same tick*, but a smooth scroll has not moved yet
      at that moment, so "have we arrived" was never true. It now measures **before** scrolling,
      glides once then corrects instantly, and keeps watching for the whole ~5s window instead of
      stopping once it looks settled: this step is normally reached by tapping a thread, so the card
      is still loading and a late image lifts it off its end again.
      *An intermediate version of this fix stopped early on "settled" and made it worse (12/20 to
      16/20 on the walk); the tests caught it.*

- [x] **Verified**: three full tour runs on an iPhone viewport, 20/20 — tapping the eye moves the
      spotlight to the banner and the banner is really on screen; skipping the tap skips the banner
      step; swipe-up advances in every run; the focus is released before the cross step; and the
      sideways swipe crosses realms, including with a **deliberately cancelled** drag. 507 unit
      tests, build + lint clean, zero page errors.

---

## Auth messages audit + a password reveal ✅ *(2026-07-28)*

**The report.** Creating an account with an address that already has one said "we sent you a
confirmation link". It had sent nothing; it should say the address is taken.

**Root cause.** Supabase's **email-enumeration protection** answers a sign-up for an existing
CONFIRMED account with a *fake success*: no error, a throwaway user object, and the only tell being
an **empty `identities` array**. The app took that at face value. Captured live, along with every
other case, before changing anything:

| what the reader did | Supabase's answer |
|---|---|
| sign up, new address | no error, `identities:[1]` |
| **sign up, existing CONFIRMED** | **no error, `identities:[0]`** (the fake) |
| sign up, existing UNCONFIRMED | no error, `identities:[1]`, link genuinely resent |
| sign in, unconfirmed | `email_not_confirmed` |
| sign in, wrong password / no such account | `invalid_credentials` (identical, by design) |
| reset for a non-existent address | no error (by design) |
| weak password | `weak_password`, message spelling out entire alphabets |

- [x] **`isAlreadyRegistered`** (pure, tested) reads the empty-identities tell, and sign-up now says
      the address is taken. An existing *unconfirmed* account is a genuine resend and still gets
      "check your email", which is true for it. Saying so costs no privacy: the tell is already in
      the response the browser holds, so probing addresses was never actually prevented.
- [x] **The audit found two more real problems, neither reported:**
      - **The app demanded 6 characters; the server demands 8 plus a lower case letter, a capital
        and a digit.** So a password the UI accepted was rejected, and the refusal shown was
        Supabase's raw one, which prints `abcdefghijklmnopqrstuvwxyzABC…` at the reader.
        `PASSWORD_RULES` / `passwordProblem` / `passwordHint` now hold the rule in one place (used by
        sign-up AND the reset page, which disagreed with each other), and `describeWeakPassword`
        rewrites the server's refusal, reading the real requirements out of it so it stays true if
        the dashboard rule changes.
      - **Signing in with an unverified address was a dead end.** It said "confirm your email first"
        with no way to act; the link is usually expired or lost. It now offers **"Send me a new
        confirmation link"** right there (`signIn` flags `unconfirmed` from the error code).
- [x] **Verified correct already, left alone:** wrong password and no-such-account return the same
      message, which is deliberate and must not be "fixed" into leaking which addresses exist; a
      reset for an unknown address still reports success for the same reason.
- [x] **`PasswordField`** — a shared input with a show/hide eye, used by sign in, sign up and both
      fields on the reset page, so they cannot drift apart. Typing a password blind on a phone is
      where a lot of "wrong password" attempts actually come from. The eye is `tabIndex={-1}` so it
      never sits between the field and the submit button, and announces its state.

- [x] **Verified against the real backend, driving the real form** (iPhone viewport): 9/9 — existing
      confirmed account says "already an account" and does NOT promise an email; existing unconfirmed
      still gets the check-your-email step; unconfirmed sign-in offers a fresh link and that link
      really sends; wrong password says the pair does not match; a weak password shows a readable
      rule with no alphabet dump; the eye reveals and re-hides. Then the reset page via a real
      recovery link: two fields, two eyes, the rule shown, and a weak password refused in our words
      rather than the stale "6 characters". 520 unit tests, build + lint clean, zero page errors.

---

## Phase 25 — WCAG 2.2 AA colour contrast (2026-07-28) ✅

Drift's palette was designed by eye and had never been checked against a contrast standard.
It is live in a public beta, so the gap mattered. Audited every token across 2 themes x 3
realms with a relative-luminance calculator, then verified in real Chromium by rasterizing
the actual `color-mix()` output. **Target: WCAG 2.2 Level AA** (1.4.3 text, 1.4.11 non-text,
2.4.7 focus visible). The rules now live in **CLAUDE.md §10**.

The structural news was good: zero Tailwind palette colours anywhere, every colour routed
through seven CSS variables, and no text over images. So most of this was a token fix.

**What was broken (measured):**

- [x] Dark tile faces: label **3.42:1**, blurb **2.22:1** across 60 cards (28 fields, 10 news
      sections, 10 art forms, 12 arXiv categories). The worst failure in the app.
- [x] Primary buttons `bg-accent` + `text-paper-raised`, light: **3.36:1** across 37 sites.
- [x] Gallery `--accent` #b97d59 at **2.99:1**, below even the 3:1 non-text floor.
- [x] Papers `--accent-strong` at 4.47, missing 4.5 by 0.03.
- [x] `--line` at **1.20:1** drawing the only visible edge of every text input.
- [x] Focus drawn as a 1px border swap; **2.57:1** light / 1.66:1 dark over tile tints.
- [x] 14 low-alpha text sites between 2.88 and 3.99.
- [x] Papers cover label: all 9 discipline hues, **2.46 to 3.64**, text on its own hue.

**What shipped:**

- [x] **`src/lib/contrast.ts`** — pure WCAG + OKLCH maths. **`contrast.test.ts`** reads the real
      hexes out of globals.css via **`palette.testkit.ts`**, so the contract binds the stylesheet
      rather than a copy of it: retune a token and the suite goes red on its own.
- [x] **Retuned the light accent ramp** (6 values). Fixed all 37 buttons, the gallery floor and
      the papers link text without touching a call site. Dark was already passing, untouched.
- [x] **`--line-strong`** (3.01:1), a SECOND border token. `--line` stays the decorative
      hairline (1.4.11 exempts it); `--line-strong` is for control boundaries — inputs,
      textareas, icon-only buttons. Text-labelled buttons keep `--line`, which 1.4.11 allows
      because the label identifies the control. Deliberately the lightest passing value.
- [x] **Dark tile faces derived, not mixed** (`src/lib/tiles.ts`). Lowering the mix percentage
      cannot work: it trades text contrast against the neighbour-distinguishability rule and no
      value satisfies both. Re-lighting in OKLCH at L=0.34 escapes the trade: label **9.17**,
      blurb **5.94**, neighbour ΔE **6.48** — better separation than the light grid has (5.00).
      Zero new hex constants; the 60 authored tints stay the single source of truth.
- [x] **One shared focus utility**, `focus-ring` / `focus-ring-within`: 2px `--accent-strong`
      at 2px offset, replacing ten ad-hoc border swaps.
- [x] **Papers cover label** re-lit away from its own hue backdrop: 6.18 light, 7.80 dark.
- [x] Three decorative monograms given `aria-hidden`, so their exemption is real rather than
      assumed (and a screen reader stops announcing a stray letter).
- [x] **`npm run audit:contrast`** — Playwright sweep of the running app, measuring composited
      pixels across every route x both themes. Catches what token maths cannot.

**Verified:** `npm run audit:contrast` **PASS, 1464 text nodes, 16 views x 2 themes**, zero
failures (was 258). A keyboard walk of **182 tab stops** across 6 routes x 2 themes: every stop
has a visible focus indicator, none under 3:1. **641 unit tests**, build + lint clean.

> **Deviation from the approved plan:** the plan put the tile grid's `ring-line` on the
> `--line-strong` list. Measurement showed `--line-strong` reaches only **2.47:1 light / 2.17
> dark** against the tile faces, because the faces are mid-toned — so applying it would have
> darkened the grid *without* achieving compliance. The ring was left decorative (the tile is
> identified by its tinted fill and serif label) and the focus ring carries the load instead,
> at 4.66 light / 6.27 dark on the same faces.

> **Also corrected during the work:** the audit first read two handle inputs as having no focus
> indicator at all. They do — their wrapper carries `focus-within`. They were weak, not absent.

---

## The tour teaches crossing realms as a tap, not a swipe ✅ *(2026-07-28)*

**The report.** The tour's "swipe sideways to cross realms" step works on a phone but fights the
laptop: on a trackpad a horizontal two-finger swipe *is* the browser's back/forward gesture, so the
tour was asking readers to navigate out of the app. An over-swipe on a phone can do the same. The
top bar has carried a doorway control since Phase 15 that does the identical thing on every device.

- [x] The step (`try-horizontal` → **`cross-realm`**) now spotlights `data-tour="cross-realm"`, the
      real doorway control, with `gestureHint: "tap"`. It still advances on the genuine `"crossed"`
      event, so the reader really crosses; nothing about the step is a mock.
- [x] Copy: **"Cross into the other realm"** + "On a touchscreen a sideways swipe does the same
      thing", so the gesture stays discoverable without being forced.
- [x] The sideways swipe itself is **unchanged** and still crosses realms. Only the tour changed.
- [x] A spotlight step means the scrim now *blocks* stray gestures here (a `swipe-side` hint made it
      deliberately pass-through), so the tour can no longer trigger a browser back-navigation.
- [x] The feed's focus-release effect follows the renamed step id: the doorway control is not
      rendered while a focus is set (`crossEnabled = canCross && !focus`), so without it the step
      would spotlight a control that is not there.
- [x] Tests pin it: the step taps a spotlighted `cross-realm` target, **no step anywhere forces a
      sideways swipe**, and the copy still mentions the swipe.

**Verified:** driven with Playwright at 1280x860 and 390x844 (touch) — the coach card reads the new
copy, the spotlight lands on the doorway pill (label on desktop, glyph only on a phone), a click
through the spotlight hole crosses into the Gallery ("crossed to gallery"), and the tour advances to
"End when you like". Zero console errors. **644 unit tests**, build + lint clean.

---

## Two small fixes: a header that fits every phone, and a tour that starts in the right realm ✅ *(2026-07-28)*

**1. The feed's top bar was clipped on a beta tester's phone** (the monogram cut off on the left,
"End & view trail" cut off on the right). Not a phone-size problem alone: **every child of the header
was `shrink-0`**, so once the labels grew the row simply outgrew the viewport. Measured it, rather
than guessed: at 360px with the root font at 19px (Chrome's page-text scaling, or Android's display
size) the row is **364px wide in a 360px viewport**. The feed shell is `overflow-hidden`, so the
surplus was clipped invisibly, and because a hidden box is still *programmatically* scrollable the
browser slid the whole row sideways when a control at the far end took focus. That is why the logo
looked cut off too.

- [x] Tighter geometry on a phone (`gap-2`, `px-3`), full spacing from `sm` up.
- [x] A **short label under `sm`**: "End trail" / "Keep trail", the long form from `sm` up. The wide
      copy is `display: none`, so it stays out of the accessible name.
- [x] The End button is the **one child allowed to shrink** (`min-w-0 truncate`), so the row can
      always fit rather than overflow, however the text is scaled.
- [x] Found while sweeping every element for overflow: the card's **chip + reactions row** did the
      same thing at 320px with scaled text. The chip now shrinks past its longest word and breaks it.
- [x] `pt-safe` **was being used by the tour overlay and had never been defined** as a utility, so it
      did nothing. Defined (bare `env(safe-area-inset-top)`, a no-op in a browser tab) and the feed
      header now carries the same top inset, so an installed PWA on a notched phone is clear of it.

**Verified:** a Playwright sweep of `/drift` at 320 / 360 / 390 / 412 / 768 px, each at root font 16
and 19-22px, asserting that **no element's box leaves the viewport**: previously 360@19 and 320@20
overflowed, now **ALL WIDTHS OK**. Screenshots in both themes read calm, not cramped.
`npm run audit:contrast` **PASS, 1456 nodes, 16 views x 2 themes** (the label change touches text, so
this was re-run rather than assumed).

**2. Starting the tour by hand from the Gallery broke it.** The tour is an Encyclopedia walk: its
home steps spotlight the orbit search, the field grid and the news subjects, and the Gallery panel
renders none of them, so the tour pointed at controls that were not on screen.

- [x] `TourProvider.start()` now persists `lastRealm: "encyclopedia"`, so any later mount of the home
      page restores it (covers the `/account` entry point, where home mounts fresh).
- [x] The home page also switches its **live** panel over as the tour begins, because "Take a tour"
      sits on that page: it is already mounted, and no settings restore was going to run again. The
      async settings read is guarded so it cannot land on top of the tour's choice.
- [x] **Verified** from both entry points, starting in the Gallery: before the tour the three
      Encyclopedia-only targets are genuinely absent (the reported bug), and after it starts the
      Encyclopedia tab is selected, the CTA reads "Surprise me in Encyclopedia", all five home
      targets exist, and all four home steps reach their spotlight. Zero page errors.

**644 unit tests**, build + lint clean.

---

## Bug fix: "drift within a field" broke on some fields, two ways ✅ *(2026-07-28)*

**The report.** Two symptoms, both after having drifted normally first: on a phone, tapping a field
drifted **random** cards instead of the field's (a reload cured it); on a laptop, tapping a field gave
**"Couldn't load a card just now"**, and **only Architecture did it**, and later it worked.

**One root cause, measured rather than guessed.** A field drift asks the discover route for a window
of a topic's pages ranked by incoming links. Our junk filter drops list/index/navigation pages, and
one of its rules is `/\blistings\b/`. Sorted by incoming links, those hubs are not scattered but
**contiguous**: `articletopic:architecture` is hundreds of "National Register of Historic Places
listings in …" pages deep, all densely inter-linked, so they rank high together. A whole 12-page
window could therefore be **nothing but junk**, and the batch came back empty. Sampling 12 random
offsets per field: **architecture returned ZERO cards 6 times out of 12** (average 1.3 cards per
12-page window), **visual-arts 3 of 12**, and mathematics / linguistics / performing-arts / sports
never. That is why it was Architecture.

Both symptoms follow from that empty batch:

- The **seed** treated one empty window as fatal, threw, and showed "Couldn't load a card just now".
  A second attempt would have worked, which is exactly the reader's "and then after some time it
  worked again".
- A **refill** that came back empty fell through to `doDrift`'s generic last resort, a random
  *thread* neighbour of the current card. That card is not in the field and arrives labelled only
  "Drifting" while the banner still promises "Within Architecture": the phone's "it just drifted
  randomly". A reload re-seeded with fresh offsets, so it looked fixed.

- [x] **Fix the cause: exclude those titles in the SEARCH, not after the fact** (`topicSearch` in
      `src/lib/wiki.ts`, used by `wikiDiscoverTopic`). The window is then spent on pages we can
      actually use. Kept in step with `isListLikeTitle` by a unit test, since the two describe the
      same pages.
- [x] **The seed no longer believes the first empty answer**: up to 3 windows, the last at the head
      of the bucket, which is always well-formed. The artist seed is exempt (an oeuvre is a finite
      ordered set that must be read from the top).
- [x] **A field refill reaches deeper before giving up.** The ordinary window is the top ~400 pages
      of a topic, which a long stay in one field can read dry; a second try samples to 1000 rather
      than pretending a 30,000-page field is empty.
- [x] **A focused drift never leaves its field silently.** Under a field focus the off-field thread
      fallback is gone (an honest "the source is catching its breath" instead), and **liking a card
      no longer pulls the drift out of the field**: the liked-card follow is the passive drift
      gesture, which is what a focus governs. Pulling a thread yourself is still free, as always
      under a focus. Unfocused drifting still follows a like exactly as before.

**Verified.** Same probe, after: **all 28 fields, 0 empty windows in 112 samples** (architecture went
from 1.3 to **12.0 cards per window**). The reported flow driven in a browser (normal drift first,
home, then a field) on a phone viewport: Architecture, Visual Arts and Mathematics each open cleanly
and **every** drift is labelled with the field it promised. Liking a card inside a field drift keeps
the field; liking one in an unfocused drift still follows the like. **648 unit tests**, build + lint
clean, zero page errors.

---

## Phase 26 — Tables (and infobox facts) in Encyclopedia cards *(started 2026-07-28)*

**Why.** A card's body is plain text (`prop=extracts&explaintext` throws away everything that is not
prose), so a paragraph reading "as the table below shows" arrives with no table anywhere. Same for
the infobox, where a lot of a page's actual answers live. Goal: on **Read more**, the body carries
the article's real data tables, in the place the prose refers to them, plus the infobox as
label/value rows in the card's existing "Details" disclosure.

### M-W0 — Wikipedia compliance, verified against primary sources ✅ *(DONE & verified 2026-07-28)*

Checked BEFORE writing any feature code, at the owner's request. Findings, from the WMF **Terms of
Use §7**, **WP:Copyrights**, **API:Etiquette** and the **User-Agent policy**:

- **Licence.** Text is CC BY-SA 4.0 + GFDL. A table, an infobox and a paragraph are all the same
  article text under the same licence, so tables need no separate permission.
- **Attribution.** "A hyperlink (where possible) or URL to the article" is an explicitly permitted
  method, because the article's history lists its authors. Every card already links to its article,
  and that link covers anything taken from that page. Already satisfied.
- **Licence notice.** ⚠️ The gap. The ToU require "a licensing notice stating which license the work
  is released under, **along with either a hyperlink or URL to the text of the license**". Drift
  named "CC BY-SA" on /about, /privacy and the public footer but **never linked the licence**, and
  none of those places was the screen where the content is actually read. This was true of today's
  plain extracts, independent of tables.
- **Modifications** must be indicated "in a reasonable fashion": excerpting is already visible
  (Read more, the fade), and the table footer will say what it left out.
- **ShareAlike** binds adaptations. Drift reproduces verbatim excerpts, so none is created. *If
  `AI_REWRITE` is ever switched on, the rewritten text IS an adaptation and must be CC BY-SA.*
- **Non-free media** is "not under the CC BY-SA or GFDL license as such". Confirmed empirically that
  `prop=pageimages` excludes it: "Pulp Fiction", whose lead image is a non-free poster, returns **no
  page image at all**.
- **API etiquette**: serial not parallel (our 300ms gate serializes every Wikimedia call),
  descriptive UA with site + contact, cached responses, GET, no bulk downloading. `action=parse` is
  a documented read endpoint; 1 to 4 calls per explicit Read-more tap, edge-cached for a day, is
  ordinary interactive use. `maxlag` is for non-interactive bots and does not apply.

Fixes shipped:

- [x] `src/lib/licenses.ts` — one place naming each source's licence **and its URL**, with the two
      separate obligations (attribution vs notice) written down so a future session cannot conflate
      them. Papers deliberately has no entry: arXiv abstracts are not ours to label.
- [x] The notice now appears **on the card**, beside the source link: a quiet "CC BY-SA 4.0 ↗"
      (Gallery cards get "CC0 1.0 ↗"), `rel="license"`.
- [x] The footer, /about and /privacy now **link** the licence text instead of only naming it
      (shared `LicenseLink`), and both pages say plainly that each card links back to the page whose
      history credits its authors.
- [x] `pilicense: "free"` pinned explicitly on all three `pageimages` call sites, so "no fair-use
      file ever reaches a card" is a stated guarantee rather than an inherited default.
- [x] Compliance guards in `src/lib/licenses.test.ts` (the notice must link creativecommons.org;
      `CARD_PROPS.pilicense === "free"`), each carrying the reason it exists.

**Verified:** licence links present with the right hrefs on the card (Encyclopedia and Gallery),
/about and /privacy; `/api/realm/encyclopedia/summary?id=Pulp Fiction` returns no image;
**654 unit tests**, build + lint clean, `npm run audit:contrast` **PASS (1482 nodes)**.

### M-W1 — the pure parser ✅ *(DONE & verified 2026-07-28)*

`src/lib/wikihtml.ts` + `wikihtml.test.ts` + `wikihtml.fixtures.ts`. Article HTML in, ordered
`Block[]` (paragraph | table) + infobox `Fact[]` out. No network, no DOM, **no new dependency**, and
no Wikipedia HTML is ever injected into the page: the card will render *data*, so there is nothing
for a sanitizer to do. Same register as `lib/realms/arxiv.ts` (regex Atom parsing) and
`lib/mathtext.ts`.

- [x] `elementEnd` (depth-aware element slicing), `decodeEntities`, `htmlToText`, `cleanArticleHtml`,
      `replaceMath`, `htmlTable`, `infoboxFacts`, `htmlBlocks`, `takeBlocks`, `blocksToText`.
- [x] **Math costs no new logic.** MediaWiki ships the TeX twice in machine-readable form
      (`<annotation encoding="application/x-tex">` and the fallback image's `alt`), both spelled
      `{\displaystyle …}` — exactly what `preprocessMath` already converts to the markers
      `<MathText>` renders. Better than the plaintext path, which has to clean up flattened MathML.
- [x] Tables: header row detection, clamped colspan/rowspan, caps (10 data rows × 6 columns, 140
      chars per cell) with the true totals kept so the card can say what it left out, the section
      heading as a fallback caption, and refusal of navboxes / maintenance banners / infoboxes /
      nested-table layouts / unclassed tables with no header cell.
- [x] Infobox → the `facts` shape the card already renders, handling both modern infoboxes
      (`th.infobox-label` + `td.infobox-data`) and **taxoboxes** (labels are plain cells ending in a
      colon), de-duplicated by label, `<br>` read as a comma because a value is a list.
- [x] **Images are dropped from every cell.** A licensing decision, not a layout one (a file in an
      article may be non-free), written down at the top of the module so it is not "improved" later.
- [x] 41 unit tests over **verbatim** captured markup in `wikihtml.fixtures.ts`, including the two
      traps that hand-written fixtures would have missed: TemplateStyles CSS living **inside a table
      cell**, and `<sup class="reference">` footnotes.

**Four real bugs the tests + a live run caught (none guessable from reading):**

1. `dropElements` skipped *past* an element it decided to keep, so every hatnote and short
   description nested inside the lead's one big `<div class="mw-parser-output">` survived. It now
   steps into a kept element.
2. `htmlTable` trusted its caller to have cleaned the markup, so a header read
   "Absolute hardness[13]" and an image-only column looked full. It cleans its own input.
3. **Running the parser over ten LIVE articles** (not fixtures) found MediaWiki's own error text in
   the body: parsing a section alone leaves a footnote group without its list, so the HTML ends with
   `<span class="error mw-ext-cite-error">Cite error: There are <ref group=lower-alpha> tags…</span>`.
4. The same run found an infobox coordinate reading "40.7057°N 73.9964°W / 40.7057; -73.9964": a
   coordinate ships three spellings of itself, two hidden. Hidden markup is now dropped outright
   (`display:none`), which is the general rule that fixes it. It also refuses a very wide spanned
   table, after the periodic table's own grid came back 19 columns wide.

**Verified (M-W1):** 41 parser tests; a temporary live pass over Mohs scale, Beaufort scale, Periodic table,
Brooklyn Bridge, Octopus, Euler's identity, Cognitive development, Doric order, Coffee and Black hole
asserting **no markup leaks of any kind** (no CSS, no `[13]`, no `{\displaystyle}`, no entities, no
`<`) and sane tables — Mohs came back with its hardness table intact, Octopus with its taxobox
(Kingdom/Phylum/Class), Brooklyn Bridge with 10 infobox rows, Euler's identity with rendered math.
**695 unit tests**, build + lint clean. (The live pass was deliberately not kept in the suite: it
needs the network. The fixtures are the standing gate.)

### M-W2 — the server: an HTML-backed "Read more" ✅ *(DONE & verified 2026-07-28)*

- [x] `wikiParse` in `lib/wiki-server.ts`: `action=parse`, through the SAME 300ms gate as every other
      Wikimedia call (API:Etiquette asks for serial requests), with the parser report, edit links and
      TOC turned off. Its own function rather than a `wikiQuery({action:"parse"})` spread override.
- [x] `wikiExtended` now walks the article **section by section**, stopping the moment the reading
      budget is full and never exceeding 4 requests. The lead usually carries 3 to 6 paragraphs, so
      most pages cost 2 calls of 12 to 40KB, against 174 to 824KB for the whole page.
- [x] `ExtendedBody` (`lib/types.ts`) adds optional `blocks` + `facts`. Gallery and Papers return
      exactly what they returned before; nothing is stored on a `Card`, so saved trails and the cloud
      sync payload do not grow by a byte.
- [x] **Falls back to the old plaintext path** on any throw, on `nosuchsection` at the first request,
      or when the parse yields fewer than 2 paragraphs. A reader can never end up worse off (§4).

**Verified:** the route driven over 12 articles — table-rich (Mohs, Beaufort, Periodic table),
infobox-only (Brooklyn Bridge, Octopus, Coffee, Cthulhu), math (Euler's identity), plain (Cognitive
development, Doric order, Black hole) and a short one (Aisle). Every one returned blocks (no
fallbacks), 3 to 10KB, **no markup leaked into any paragraph or cell**, and the infobox rows read
cleanly (Kingdom=Animalia; Origin=Yemen; Created by=H. P. Lovecraft). Latency 1.0 to 3.2s on a cold
dev server with no cache; production is compiled, closer to Wikimedia, and edge-cached for a day.

### M-W3 — the card: tables in the reading flow ✅ *(DONE & verified 2026-07-28)*

- [x] `src/components/CardTable.tsx` — rendered from DATA, never from Wikipedia's HTML, so there is
      nothing to sanitize. Caption band, header row, zebra rows, all in `globals.css` tokens (§10).
- [x] **A wide table scrolls inside its own box**, never the page, with a soft right-edge fade while
      there is more to the right (the card's existing fade language, turned sideways). Cells carry a
      width floor and ceiling: without them a 6-column table in a 310px box squeezed each column to
      ~50px and turned a prose cell into a ten-line tower.
- [x] **Gestures:** a sideways drag over a *scrollable* table belongs to the table (its touches stop
      there, so it cannot read as a cross-realm swipe); over a table that fits, gestures pass through
      untouched. Wheel events are never intercepted, so reading and overscroll-to-advance are exactly
      as before.
- [x] **Keyboard + a11y:** a scrollable table is a tab stop with the app's shared focus ring, a
      `role="group"` and a label naming it; a table that fits adds no tab stop at all.
- [x] The soft bottom fade is suppressed when the body ends on a table (a gradient washing over a
      table's last row reads as a rendering fault).
- [x] The infobox lands in the card's existing **Details** disclosure, so a Wikipedia card gains
      Kingdom/Phylum/Class (or Carries/Crosses/Opened) once expanded.
- [x] **Honesty in the footer**, only when something really was left out: "Showing 10 of 13 rows",
      and — because a table can introduce itself with "…with images of the reference minerals in the
      rightmost column" — **"Images are not shown here."** when the table had images we removed on
      licensing grounds. `totalCols` deliberately counts only columns a reader could have read, so
      the card never "admits" to hiding a column that our own no-images rule emptied.

### M-W4 — the standing gate sees it ✅ *(DONE & verified 2026-07-28)*

- [x] `scripts/audit-contrast.mjs` now expands a card (Mohs scale) and opens Details before
      measuring, so table and infobox text is audited on every future run: **77 nodes on that view,
      against 23 collapsed.**

### M-W5 — bug fix: a wide table was widening the whole article ✅ *(2026-07-28)*

**The report.** On a card whose table is wide, tapping Read more made the *prose* too wide and cut it
off, and the page could not be scrolled sideways to reach it. "Only the table should be wider than
the page, not the article."

**Cause.** A flex item defaults to `min-width: auto`, meaning "never narrower than my content", so
the single widest child sized the entire reading column. Measured: expanding grew the reading region
from **554px to 976px** and pushed paragraph edges to x=1630 on a 1280px screen, where the card's
`overflow-hidden` clipped them. The table was behaving; the article around it was not.

- [x] `min-w-0` on the reading column, on the `[data-drift-scroll]` region and on the body container
      (each is a flex item that must take its width FROM the card, not from its content), plus
      `w-full min-w-0` on the table's own figure.
- [x] **Verified by measurement, before and after.** After: the reading column stays 554px on desktop
      and 310px on a phone whether or not a table is present, prose is never clipped, the page never
      scrolls sideways, and the Beaufort table alone is **1246px inside a 310px box**, scrolling on
      its own. Which is exactly the ask: the table is the only thing that exceeds the page.

**Verified (M-W2/3/4), in a real browser:** on a phone (390px) and desktop, light and dark — the
table lands directly under the sentence that promises it; a wide table scrolls inside its box while
the page never scrolls sideways; a real touch drag inside a scrollable table does **not** cross
realms while the same drag over prose still does; `r`/"Read more"/"Show less" all behave and
re-expanding does not refetch; the Octopus Details rows carry the taxobox; a table-less card and the
whole Gallery realm are untouched. **698 unit tests**, build + lint clean, `npm run audit:contrast`
**PASS, 1610 nodes across 17 views x 2 themes**, zero console errors.

---

## Bug fix: a chosen field or orbit was silently ignored until the app was reloaded ✅ *(2026-07-28)*

**The report (a second time).** On a phone, after drifting for a while, picking a field just kept
drifting randomly and ignored the choice. Same for "drift around a page". Reloading cured it. The
earlier fix (the field seed returning empty windows) was real but was **not this**: this one hits
orbits too, and an orbit drift can never serve random cards, so the focus was never being applied at
all.

**Cause.** `/drift` read its params **once per mount**, from `window.location.search`. That quietly
assumed arriving with new params always means a new component. Whenever that does not hold — a router
that reuses the page, a client restored from cache — the params were simply never read: the previous
drift carried on, wandering wherever it liked, and only a reload (a fresh mount) could clear it.

**Reproduced deterministically** by simulating exactly that: change the URL to a field focus while
the feed is NOT remounted. Old behaviour, verbatim from the run: `field arrived with no remount:
FAIL banner=null … next drift: OFF FIELD chip=DRIFTING · LITERATURE`. The URL said Physics; the drift
went to Rendang, then A Midsummer Night's Dream. (Ordinary navigation could not reproduce it here
across 18 scripted runs, in dev AND in a production build, which is why the first pass missed it.)

- [x] **The session now follows the URL, not the mount.** `sessionKey` (`lib/focus.ts`, unit-tested)
      names the params that decide *which* session this is; the feed compares it each render and
      (re)starts when it changes, resetting history, buffers, orbit and trail state — but never the
      seen list, since not repeating yourself belongs to the reader, not the session.
- [x] **The feed's own URL rewrites do not restart anything.** Anchoring an orbit with the eye and
      letting a focus go with "Drift freely" both rewrite the URL; each now marks the new key as
      already applied, so the drift you are in the middle of is undisturbed.
- [x] `useSearchParams` replaces `window.location.search`, with a Suspense boundary reusing the
      feed's existing "Finding a starting point…" state.
- [x] A test pins that `sessionKey` covers **every param any focus kind writes**, so a future focus
      that adds one cannot silently share a key and fail to start.

**Verified:** the simulated failure now PASSES (field and orbit both take hold, the next drift is on
topic) and the same script FAILS against a build with only this fix reverted, so the test has teeth.
Regression: 6/6 scripted field/orbit navigations, 4/4 realistic paths (after the eye, after "Drift
freely", after the back gesture, after ending a trail), and a heavy session (12 drifts, a like, a
thread pull, two realm crossings) then a field and an orbit, all on topic. The eye re-anchors and
"Drift freely" releases without restarting the trail (stops unchanged). **702 unit tests**, build +
lint clean, zero page errors.

---

## Scaling, the cheap end: making the calls we already make count ✅ *(2026-07-28)*

**The question.** At 200 req/min to Wikimedia, does the app hold up with ~10 concurrent readers, and
is the answer "register more email addresses"? No, and no.

**Measured first.** A real 12-card session costs **≈2.4 Wikimedia calls per card** (threads 1.0,
discover ~0.5, Read more ~0.6, a reaction ~0.3) plus ~1 Art Institute call for the doorway. A calm
reader is ~5 calls/min, so **10 readers ≈ 50/min: a quarter of the ceiling**, and the wall is around
35 to 40 concurrent readers. Two facts shaped the work: **the edge cache already works** (verified in
production, `x-vercel-cache: MISS` then `HIT`), so the lever is hit RATE; and **half of all doorway
lookups find nothing and were `NO_STORE`**, making the most repeated lookup the one that never cached.

- [x] **Discover offsets align to the window size** (`randomOffset(rng, max, step)` in
      `lib/discover.ts`). Unaligned, a 4-card window could start at any of 401 offsets per topic
      (~11,000 URLs across the registry), so the CDN almost never saw one twice. Aligned, windows
      tile: 101 URLs per topic for refills, 34 for seeds, **same range, same cards**, no page
      half-served at two offsets.
- [x] **Discover batches are `CACHE_STABLE`** (1 day / 7 stale) rather than `CACHE_MEDIUM`. A bucket's
      ranking barely moves in a day and stale-while-revalidate refreshes it in the background.
- [x] **"No doorway" caches for 10 minutes** (new `CACHE_SHORT`), and a found doorway for a day. The
      old reasoning — a miss might be a transient failure — was right, and the conclusion (`NO_STORE`)
      too strong. `crossRealmDoorway` now **throws** on an upstream failure instead of swallowing it,
      so `null` means only "we looked and there is nothing there": a real failure still answers with
      no doorway and `NO_STORE`, and is never cached as if it were an answer.
- [x] **429s are logged** with their host in `upstream.ts`. Being rate-limited was invisible: the
      retry absorbed it and nobody could see us approaching the ceiling.

**Deliberately not done:** client-side IndexedDB caches for threads or expanded bodies (Drift avoids
repeats by design, so the hit rate would be near zero for real complexity), deferring the doorway
prefetch (it feeds a visible chip, so that is a product change), authentication, and extra
identities. On the last one: the limits are enforced **per client identity**, Vercel's egress IPs are
shared regardless, and rotating identities to multiply quota risks the whole app. The sanctioned 10x
is authenticating as an established editor (200 → **2,000/min**), which is a later decision.

**Verified:** simulated over a day of traffic, discover goes from **~3% of calls served by the edge
to ~76%** at 10 readers (89% at 30); locally, every requested offset is a whole window, 15 drifted
cards were 15 distinct cards across 7 topics (variety untouched), a field drift still works, and the
doorway now answers `s-maxage=600` for "nothing there" and `s-maxage=86400` for a hit. **705 unit
tests**, build + lint clean. Numbers and the reasoning are written up in `docs/beta-readiness.md` Q3.

---


## Bug fix: starting a drift hung on "Finding a starting point…" in dev ✅ *(2026-07-29)*

**The report.** Clicking a drift button on the homepage sat on "Finding a starting point…" forever.
Reloading that same URL opened the first card normally. It appeared right after the caching work
above, so that was the first suspect.

**It was not the caching work, and it was not production.** The same failure reproduces on the
commit *before* those changes, and a production build of that same unfixed commit **passes** (all
nine scripted entry paths). It is dev-only, which is also why "reload and it works" was such a clean
tell: React StrictMode double-invokes an effect on a client-rendered mount, and **not** on a
hydration mount. A homepage click is client-rendered; a reload is hydrated.

**Cause: the session guard and the cancel flag disagreed about what a cleanup means.** The seed
effect claims its session key in `appliedKeyRef` *before* the load finishes, and returns early if the
key is already claimed. React re-runs an effect by calling the cleanup and then the effect body, so
StrictMode produced: run 1 claims the key and starts loading → cleanup sets `cancelled = true` → run 2
sees its own key already applied and returns. Nothing was left to finish the load, the `finally` that
clears `initialLoading` is itself guarded by `!cancelled`, and the feed sat there.

Instrumented, verbatim from the run: `effect FIRE applied=null` → `before loadSeen` → `cleanup` →
`effect FIRE applied=<same key>` → `effect BAILED (same key)` → `pre-continue, cancelled= true`, and
**zero** network requests. After a reload the effect fires once and reaches `fetchDiscoverBatch`.

- [x] **The in-flight load lives in a ref, so a repeat entry can re-adopt it.** The guard now clears
      the cancel flag instead of walking away; a cleanup with **no** successor (really leaving
      `/drift` mid-load) still cancels, so there are no stray fetches and no `persistSeen` for a card
      nobody saw. This also hardens the guard against any future same-key re-fire in production, e.g.
      a non-session param changing while the seed is still loading.

**Verified** in a browser (headless Chromium, an isolated dev instance): the five soft-nav entry
points that were all wedged — Encyclopedia "Surprise me", a field tile, an "in the news" tile, and
Gallery "Surprise me" — now open a card, and so do a hard load and a forward-navigation back into a
session. The guard's original job still holds: "Drift freely" rewrites the URL with the trail
undisturbed (same card, no reload, no restart). The same script passes against a production build.
**705 unit tests**, build + lint clean, zero page errors. No unit test was added: the defect is
effect-lifecycle behaviour in a page component, and a pure-logic restatement of it would only test
the copy.

**Noted, not changed:** `TourProvider`'s welcome-offer effect has the same shape (`decidedRef` claimed
eagerly, a closure cancel flag, a cleanup). It does not wedge today because `loading` is true on the
first pass, so the StrictMode double-invoke happens before the guard is claimed. Verified by
observation: the welcome offer appears on every fresh profile. Worth revisiting if that effect's
dependencies ever change.

---

## Bug fix: on the installed app, a new drift inherited the last one ✅ *(2026-07-29)*

**The report (a third time, and this time reproduced).** On the home-screen PWA: finish a drift, start
another, and it keeps the one you just left. Pick Physics after Mathematics and you drift Mathematics.
Tap Encyclopedia after a Gallery session and you drift the Gallery. Restarting the app cures it. Only
ever on the installed app, never in a browser tab. The two earlier fixes (the empty-window field seed,
then "the session follows the URL, not the mount") were both real and neither was this: **the URL
itself was wrong.**

**Cause 1 (the reported one): Next's client Router Cache keys entries by PATH SEGMENT, not by URL.**
`/drift` is the one route in Drift whose identity lives entirely in the query string, so every session
shares one cache entry. Once a `popstate` — the phone's back gesture — has restored a `/drift` entry,
the next `router.push("/drift?<other params>")` is answered with the URL already sitting in that
entry. Traced live, the app asked for one thing and Next's own router pushed another:

```
DBG HOME startFocusedDrift push realm=encyclopedia&focus=field&bucket=physics&seed=Physics
TRACE pushState  →  /drift?realm=encyclopedia&focus=field&bucket=mathematics&seed=Mathematics
```

Nothing downstream could have saved it: the feed follows the URL faithfully, and the URL said
Mathematics. **It needs a long-lived page**, which is exactly why only the installed app had it: on a
phone the back gesture IS navigation, and a home-screen PWA keeps one document alive for days, so the
poisoned entry persists until you force-quit. That is the "restarting fixes it" from the report.

- [x] **`/drift` is a dynamic segment** (`app/(app)/drift/layout.tsx`, `dynamic = "force-dynamic"`),
      which keeps it out of that cache entirely. Isolated first: `router.push`, `router.replace`, a
      raw `history.pushState` and **a unique nonce in the query string all still fail** (proof the key
      is the segment, not the URL), while `router.refresh()` beforehand fixes it (proof it is the
      cache). The cost is one small RSC request per drift start: `/drift`'s server output is a
      client-component shell with no data, and it is login-gated and `Disallow`ed in robots.txt, so
      there was nothing to prerender for.

**Cause 2 (found while investigating, same symptom): the settings restore outranked the reader.**
`/`'s realm panel starts on Encyclopedia and then restores `lastRealm` from IndexedDB asynchronously.
On a phone that read can land AFTER a tap — storage is slower, and a whole session's writes are still
draining through the localforage chains — so the button read "Surprise me in Encyclopedia" when they
aimed at it, "Surprise me in Gallery" by the time they hit it, and started a Gallery drift.

- [x] **A choice already made outranks a restored default.** `realmChosenRef` / `trailChoiceRef` gate
      the restore, the same guard `tourActiveRef` already used one line above.

**Verified** on an emulated phone against a production build, since the client Router Cache is a
production-only behaviour (dev never reproduces it). The trigger matrix isolates the cause: a back
gesture poisons it (3 of 3 shapes), a link-only route back does not. Before: mismatch on the very
first repeat. After: **12 of 12 soak cycles** (pick a field → drift → end → save → view the trail →
back → home → pick a different field) land on the field that was tapped, the Gallery-then-Encyclopedia
case is right, and every entry point (fields, in the news, both realms' "Surprise me") still opens.
Cause 2 is verified with the phone's slow storage simulated (a 1.5s settings read): the button no
longer changes under the reader's thumb. Both tests fail against a build with only the fix removed.
The earlier session-follows-the-URL suite still passes in dev and production. **705 unit tests**,
build + lint clean, zero page errors.

**Watch this if Next is upgraded:** the fix leans on a framework behaviour, so if `/drift` is ever made
static again, re-run the trigger matrix. The durable alternative, if it comes back, is to move the
session identity out of the query string and into the path.

---

## A public reading section, and the AdSense rejection behind it ✅ *(2026-07-29)*

**The trigger.** AdSense refused the site for "Low value content". Researched before building
anything, and it was not a verdict on the app:

1. **The domain was 10 days old** (registered 2026-07-19, applied within the week). "Low value
   content" is Google's catch-all for a site with no history; the practical bar is 3 to 6 months.
   Nothing we build changes that one.
2. **5 crawlable pages, ~2,040 words**, of which only `/` (595) and `/about` (605) were content.
   `/privacy`, `/install` and `/contact` are utility pages that do not count. Google's own wording
   for this rejection: "may not have enough text, and/or the site was deemed to be under construction."
3. **The product is gated, and the fix does not exist pre-approval.** Verified verbatim: the AdSense
   crawler login for login-protected pages works only *"After your account has been activated."*

**The move we did NOT make.** Opening the feed to signed-out visitors was on the table and is the one
change that would have hurt. A crawler at `/drift` gets one random Wikipedia extract in an app shell,
which is precisely Google's named violation ("copy and republish content from other sites without
adding any original content"), so it invites a worse rejection and a scraped-content suspension risk
on a live account. It is also unnecessary: the landing already carries an interactive `ThreadDemo`
and a rendered trail map, so a reviewer can already see how Drift works.

- [x] **Six new public reading pages** plus a journal: `/how-it-works` (reusing the bundled
      `ThreadDemo` + `EXAMPLE_TRAILS`, so it demonstrates without a single live upstream call),
      `/principles` (the §2 rules and what each has cost, the most genuinely unique page on the
      site), `/sources`, `/faq`, `/colophon`, and `/notes` with four real notes drawn from this
      project's history (the dead related-pages endpoint, Portal:Current events over a news API, the
      WCAG audit, why Drift exists).
- [x] **`components/PublicPage.tsx`** lifts the shell `/about` had grown first (back link, monogram,
      column width, footer, `Section`) so six pages are content-only, and stays server-only: these
      pages exist to be read, and a crawler should not need to run JavaScript to find the words.
- [x] **One list, two readers.** `lib/site.ts` now owns `PUBLIC_CONTENT_ROUTES`; `AuthGate` and
      `sitemap.ts` both derive from it via `isPublicRoute`. They used to be maintained separately,
      which is a standing invitation for a page that renders signed-out but is never indexed, or is
      indexed but shows the sign-in screen (a soft 404). The old test pinned the literal list, which
      only proved it had not changed; it now asserts the *invariant* in both directions.
- [x] **`/notes/<slug>` is allowed through by prefix**, matched on `"/notes/"` with the slash, so
      `/notesecret` stays gated. Pinned by a test.
- [x] **The registry cannot drift from the routes.** `lib/notes.ts` holds metadata (pure, feeds the
      index and the sitemap); bodies are static routes, since JSX cannot live in `src/lib` (§8.5).
      `notes.test.ts` pins every slug to a real page file **and** fails on an orphan route, plus the
      standing no-em-dash rule on all note copy.
- [x] **Navigation stays calm for signed-in readers.** The new pages are linked from `PublicFooter`
      only, which renders on the public pages and never on a signed-in reader's home (that keeps its
      own short list: trails, atlas, interests, install, contact). The footer went to two rows,
      reading above and small print below, because eleven links on one wrapped line is a pile.
- [x] **`docs/adsense-resubmission.md`** is the part only the owner can do: Search Console
      verification, sitemap submission, how to confirm the pages actually indexed, the earliest
      sensible resubmission date (~20 October 2026, three months post-registration), the
      post-approval crawler-login step, and an explicit "do not do this" list.
- [x] **The contrast audit covers the new routes.** They were about to be the largest block of
      untested text on the site.

**Verified.** Public surface measured the same way before and after: **5 URLs / ~2,040 words → 15
URLs / ~8,000 words**, 12 of them real content pages. Checked against a **real gated build** (`next
start` with the Supabase env present, which is the only way to test this): all 15 render their own
content to a signed-out visitor, all 7 gated routes still refuse, `/notesecret` 404s, and
`sitemap.xml` lists exactly the 15 with nothing gated leaked. `npm run audit:contrast`: **2,450 text
nodes across 24 views x 2 themes, all passing**. **720 unit tests** (15 new), build + lint clean.

**Honest expectation, recorded so a later session does not relitigate it:** approval is still
unlikely to hinge on any of this. A login-gated app with a dozen pages about itself is a thin case
for a publisher network, and the deciding factors are domain age and organic traffic. The pages were
worth building anyway: they are the SEO surface, the sign-up explanation, and the clearest statement
of what Drift is for. If a second application is refused for the same reason, the recommendation in
the doc is to stop applying rather than keep padding.

---

## Compliance audit, M0: the live breach ✅ *(2026-07-31)*

An independent legal and copyright audit was commissioned (`docs/drift-compliance-audit.md`, and the
brief it was given is at `docs/legal-audit-prompt.md`). Its verdict: Drift **could not lawfully
operate as configured**, and the reason was not the plan to run ads, which every licence and source
term permits. It was that the AdSense loader was already live on every public page with no consent
mechanism, while `/privacy` described a consent prompt that had never been built.

Measured live before the fix: a cold load of `/` contacted `pagead2.googlesyndication.com` **and**
`fundingchoicesmessages.google.com`, and wrote an **`FCCDCF` cookie** to `.usedrift.org`. So this was
not a latent script problem. A cookie was being set on every visitor, including logged-out EEA
visitors, with no banner, no CMP and no consent signal, on a site earning nothing because the AdSense
application had been refused.

**Cause: two switches that disagreed.** `adsenseScriptEnabled` required only a publisher id, while
`adsenseReady` (the visible ad units) required the kill switch. The reasoning was that the script had
to be live for Google to review the site while ads stayed off. That produced the worst of both: full
legal exposure, no revenue.

- [x] **One switch.** `NEXT_PUBLIC_ADS_ENABLED` now governs everything Google: the loader script, the
      ownership meta tag, and (in M4) the consent gate and the copy describing it. `adsenseScriptEnabled`
      requires `enabled && client`. A test asserts the property directly: with the switch off there is
      **no** combination of the other variables that puts Google on the page.
- [x] **The false sentence on `/privacy` is gone.** With ads off the page now states plainly that Drift
      shows no advertising and that consent will be asked for before anything from an advertiser loads.
      The ads-on branch was rewritten to describe a gate that will actually exist, and is dormant until it does.
- [x] **`ads.txt` parked** at `docs/ads.txt.pending` until the account is approved (audit Mi-6).
- [x] **`StorageNotice` marked as informational only.** Audit C-13 is explicit that a "Got it"
      dismissal cannot become valid consent by acquiring a second button; the comment says so where
      the next person will read it.

**Verified** against a production build carrying the **live publisher id** with the switch off, which
is production's exact configuration: 10 public pages, **zero third-party requests, zero cookies**.
The same script against the live site returns 2 third-party hosts and 1 cookie, so the check has
teeth. 722 unit tests, build + lint clean.

**Still open:** M1 to M5 of the audit (per-image credit, the legal documents, the Gallery EU
public-domain filter, the consent gate, hygiene) plus the operator tasks (processor agreements,
hosting regions, KvK/VAT, trademark searches). Four of the audit's open questions were resolved
against the code: arXiv already has its own 3 s gate, the landing images are recorded as AIC CC0 /
Haeckel / NASA-ESA-Hubble (the ESA ones still need checking, since ESA/Hubble material is usually
CC BY 4.0 and not public domain), no cached route reads the session, and the inbox renders a received
card with **no** licence notice, which is a real gap M1 closes.

---

## Compliance audit, M1: attribution that travels ✅ *(2026-07-31)*

The audit's copyright findings. Article *text* was already handled well; images were not, and
nothing said the text had been modified.

- [x] **Per-image credit (B-4).** A Wikipedia image is a separate work with its own author and
      licence, and the card asserted the ARTICLE's licence over it. `lib/imagecredit.ts` (pure, 16
      tests) parses each file's `extmetadata`; `fetchImageCredits` in `wiki-server.ts` gets it in
      **one batched call per card batch**, not one per card. The card now shows creator, the licence
      named and hyperlinked, and a link to the file description page.
- [x] **Two fail-closed rules.** No image is displayed if its licence needs a credit we cannot
      establish, or if the file carries `Restrictions` (trademark / personality rights: copyright-free
      is not use-free). Unknown provenance counts as "cannot establish", so cards saved before this
      shipped show no picture rather than an uncredited one.
- [x] **Modification indicated (M-2).** `excerpted and reformatted by Drift` on the card,
      `reformatted by Drift; images removed` when expanded. CC BY-SA §3(a)(1)(B) is a separate limb
      from creator and licence, satisfied by neither.
- [x] **The notice travels with the data (M-11).** Every card carries an `attribution` block, so a
      trail in Postgres, a share in transit and a cached payload are self-describing.
- [x] **Received cards carry the notice (Q-7).** The inbox rendered a lighter component with a source
      link and no licence. It now has both, and the same fail-closed image rule.
- [x] **The PNG export drops images (B-5).** Arranging third-party images into a composite is the
      strongest ShareAlike trigger in the product, and the export is the one artefact built to leave
      Drift. Titles and shape only, with a burned-in `Titles from Wikipedia · CC BY-SA 4.0` line. The
      on-screen map keeps its pictures. `NodeThumb` now renders the monogram *under* the image so the
      export is not a row of empty circles.
- [x] **AIC (Mi-1).** Cards name `The Art Institute of Chicago` in full, completing the caption the
      museum requests, and every AIC response is checked against its own `info.license_text` and
      refused if it is not CC0 — which the code never read before.
- [x] **Current events credited (Mi-2)**, `/sources` corrected to stop describing images as covered
      by the article's licence, and an independence disclaimer added (Mi-7).
- [x] **`public/landing/CREDITS.md`** records all 24 hosted landing images. ⚠️ The cosmos group is
      **unverified**: "public domain" is right for NASA and wrong for ESA, whose Hubble releases are
      normally CC BY 4.0. Flagged in the file, in `data.ts`, and on the owner's action list.

**Two bugs found only by testing against the live API**, both of which would have silently disabled
every image: Commons-hosted files report `missing: true` on en.wikipedia while still returning
`imageinfo`, and `piprop=name` returns underscores where API titles use spaces. Neither is visible by
reading the code.

**Verified live:** Seville Cathedral credits `Ingo Mehling · CC BY-SA 4.0` with the licence and the
file page both linked; Monet resolves to `Nadar · Public domain`; Octopus to `albert kok · CC BY-SA
3.0`. 738 unit tests, build + lint clean.

---

## Compliance audit, M2: the legal documents ✅ *(2026-07-31)*

The obligations that have **no size threshold**. M0 and M1 fixed things that were live and wrong;
none of M2 was breaching anything today, because ads are off and the app is behind a login. It is
still the most valuable of the remaining milestones: DSA Articles 11, 12, 14, 16, 17 and 18 apply to
every intermediary service regardless of size, and `/privacy` was missing most of what GDPR Article
13 requires.

**The DSA classification the audit did is load-bearing and was not redone.** Drift is a **hosting
service** under Article 3(g)(iii) but **not an online platform**, because sharing reaches only mutual
friends and that restriction is enforced by a database policy (`are_friends()` in the `shares` insert
RLS policy) rather than by the interface. That removes Articles 20 to 28 entirely: no internal
complaint-handling system, no out-of-court dispute body, no trusted flaggers. Article 15(2) exempts a
micro enterprise from transparency reporting. Nothing built below promises any of those, and a test
asserts the terms do not.

- [x] **`/terms` (M-5).** The Terms of Service, covering the Article 14(1) list: what users may not
      do, how moderation works, what happens on breach, and how to complain. The words live in
      `lib/terms.ts` as data and are rendered twice, at `/terms` for people and `/terms.md` for
      anything reading it as a document, which is how Article 14(1)'s "machine-readable format" is
      satisfied without two copies that can disagree. `lib/inline.ts` is the two-rule
      (`**strong**`, `[label](href)`) parser that makes one source serve both.
- [x] **The CC BY-SA trap, avoided on purpose.** A boilerplate "you may not copy or redistribute
      content from this service" clause would breach **§2(a)(5)(C)** (no downstream restrictions) of
      the licence covering nearly all the content, caused by the very document written to close a
      compliance gap. The terms instead say Drift **claims no rights and adds no conditions**, and
      that the source material stays available under its own licence. Two tests guard it: one for
      the carve-out, one asserting no clause anywhere tells a reader they may not redistribute.
- [x] **Article 16 notice-and-action.** A mode of `/contact` rather than a page of its own, since
      Article 16(2) asks for a mechanism that is easy to access. Choosing "Report illegal content"
      adds the location field (16(2)(b)), raises the explanation floor to 40 characters (16(2)(a),
      "sufficiently substantiated"), and requires an unticked good-faith checkbox (16(2)(d)).
      The receipt email IS the 16(4) confirmation and carries the 16(5) promise; the inbox copy is
      subject-lined `ACTION` and lists what still has to happen, so the duty is not left in a spec.
- [x] **Anonymity, and why it is broader than the Article requires.** 16(2)(c) requires name and
      email **except** for offences under Articles 3 to 7 of Directive 2011/93/EU. Rather than make
      a notifier self-classify into the child sexual abuse category on a web form, the address is
      optional for **every** report and the form says what is lost by omitting it. Permitting more
      anonymity than the Article requires is not a breach of it.
- [x] **Articles 11 and 12 contact points** published on `/contact`: the single point of contact for
      Member State authorities, the Commission and the Board, the languages accepted, and that
      recipients may use the same address. `contactAddress()` in `lib/site.ts` (see below).
- [x] **`/privacy` rewritten to the Article 13 checklist (M-7)**, in the same plain voice the audit
      called a virtue. Layered: a five-line summary over the full detail (Art 12(1)). Every one of
      the twelve items in the audit's table is now present, including the ones that are answered by
      saying "none": no DPO and why, no automated decision-making within Article 22, no consent to
      withdraw.
- [x] **The basis is CONTRACT, not consent.** Article 6(1)(b), performance of the terms, covers
      almost everything; two rows are 6(1)(f) with the interest stated; advertising is 6(1)(a) and
      only 6(1)(a). Writing "with your consent" across a notice is both inaccurate and strategically
      bad, because it would make every operation in the app individually revocable.
- [x] **Nothing described that does not exist.** The B-3 failure was a sentence promising a consent
      prompt nobody had built. Every conditional passage now reads the same flag the feature does:
      the Turnstile sentence appears only with a site key, the OAuth recipient only with a provider
      configured, the ads branch only with the switch on.
- [x] **Data export (Mi-3).** "Download your data" on `/account`, above the delete flow, because
      taking a copy is what you want before deleting. One JSON file covering Articles 15 and 20.
      Local stores come from IndexedDB; `exportSocialData` fetches the three tables that never sync
      locally (profile, friend requests, shares in both directions), scoped by the same RLS the
      delete path relies on. Absent sections mean "not held", never `null`, and the file says so.
- [x] **Contact-form IP disclosure (Mi-5).** Article 13 requires disclosure at the time the data are
      obtained, so it is at the form, not only on `/privacy`. Accurate about the throttle: a counter
      in the memory of a short-lived server process, never written to disk.
- [x] **`docs/processing-record.md` (Mi-4).** The Article 30 record. The "fewer than 250 employees"
      exemption does **not** apply: the carve-outs are disjunctive and Drift's processing is
      continuous rather than occasional. Eight activities, five processors, the Article 32 measures,
      and a breach procedure worth having written down before it is needed.
- [x] **Sign-up references the terms.** A contract nobody was shown is a weak one, and it is the
      Article 6(1)(b) basis the whole privacy notice rests on. The 16+ line is the term; the
      self-declaration at sign-up is M4 and this does not pretend to be one.

**Verified.** 789 unit tests (up from 738), build and lint clean. `npm run audit:contrast` PASS over
3,156 text nodes across 26 views in both themes, including `/terms` and a new `/contact [report]`
row that drives the form into its Article 16 mode so the extra fields, the checkbox label and the
anonymity note are actually measured. Against a **real gated production build** with the live
Supabase env, all 12 public pages render their own content to a signed-out visitor and all 7 private
routes still show the sign-in screen. `/sitemap.xml` lists `/terms`; `/robots.txt` leaked nothing.
The Article 16 validation was exercised through the real route (five rejection paths, each naming
the right field) and in a real browser (an incomplete notice never reaches the network, and the
good-faith box is never pre-ticked).

**Deliberately left.**

- **`/legal`, the Article 3:15d BW imprint, is NOT built.** It needs the operator's legal name and
  establishment address, which is item 4 of `docs/owner-actions.md` and the one thing the audit
  recommends a lawyer for (§6.1), because the answer decides whether a home address gets published.
  A placeholder imprint is worse than none. Consequence to be honest about: **Article 13(1)(a) GDPR
  is therefore only partly met on `/privacy`** too, which names the controller as one person in the
  Netherlands and gives contact details but no legal name. Both close together, in an hour, once
  that decision is made.
- **The published contact address defaults to `noreply@usedrift.org`**, which is the address known
  to work (Cloudflare Email Routing forwards it). It reads badly on an Article 11 line, which is why
  `NEXT_PUBLIC_CONTACT_ADDRESS` exists and why routing something like `contact@` is now on the
  owner's list. Publishing a nicer address that bounces would be worse.
- **The export button was not clicked end to end.** Its pure core is unit tested, it type-checks and
  builds, and the storage reads it uses are the app's existing ones, but the card only renders for a
  signed-in user and there are no test credentials for the production backend. One click for the
  owner. Flagged rather than assumed.
- **M3 (Gallery EU public-domain filter), M4 (consent gate and age gate) and M5 (hygiene)** are next
  and untouched.

---

## Compliance audit, M2 closing pass ✅ *(2026-07-31)*

The owner answered the open questions and pushed back on one instruction that was wrong. This closes
M2 completely.

- [x] **`/legal`, the imprint (M-6), is built.** The owner supplied the details, so the reason it was
      withheld is gone. Thomas van der Hulst, trading as Usedrift (a trade name on the same KvK
      registration as RiskOptimix), Uilenstede 138, 1183 AN Amstelveen, KvK 90992318. Linked from
      every public footer, in the sitemap, and rendering to a signed-out visitor. Details live in
      `lib/imprint.ts`, so `/privacy` names the same controller and the two cannot disagree: that
      also closes the **Article 13(1)(a)** gap flagged last session.
- [x] **No VAT number is published, deliberately, and the page says why.** Article 3:15d(1)(f) BW
      requires it only "insofar as" a VAT-liable activity is carried on, and Drift is free, carries
      no advertising and earns nothing. A test pins the omission so it cannot be quietly filled in
      without also removing the explanation. It becomes required the day an advert renders.
- [x] **`contact@usedrift.org` is the built-in default**, the owner having routed it. `/contact`,
      `/privacy` and `/legal` all publish it, and the contact form delivers there unless
      `CONTACT_INBOX` says otherwise. The `noreply@` address it replaced worked but read as an
      instruction not to write, which is the opposite of what DSA Article 11 is for.
- [x] **The processor-agreement instruction was wrong and is corrected.** The owner could not find
      the "accept" buttons because for most providers there are none. **Vercel and Resend are already
      in force**: both DPAs are pre-signed addenda that bind "upon Customer entering into the
      Agreement", with the SCCs signed by deeming. **Cloudflare's does not** bind automatically and
      needs accepting, but only matters if Turnstile is switched on. Supabase publishes one under
      Organisation → Legal Documents and needs a look. `docs/owner-actions.md` §3 now explains what a
      DPA is, why a pre-signed PDF looks unsigned, and `docs/processing-record.md` records the
      per-provider position.
- [x] **The landing-page cosmos images (M-1, Q-1) are resolved, and one was worse than the audit
      guessed.** `cosmos-jupiter.jpg` was the JunoCam "Jupiter Blues" close-up, whose credit on JPL's
      own page reads `NASA/JPL-Caltech/SwRI/MSSS/Gerald Eichstadt/Sean Doran © CC NC SA`. That is
      **CC BY-NC-SA**: citizen-scientist processing of raw mission data carries the processors' own
      terms even though NASA hosts the result. **NonCommercial cannot be cured by crediting** and is
      squarely wrong for a site being prepared to carry advertising, on the only public indexed page.
      Replaced with the Cassini Jupiter portrait (PIA04866) from `images.nasa.gov`.
- [x] **The two Hubble images are credited rather than replaced.** The same file has two publishers
      with two positions: NASA states Hubble outreach imagery is "generally not subject to copyright"
      (and `hubblesite.org/copyright` now 301-redirects to that page, verified this session), while
      ESA/Hubble publishes the same files under CC BY 4.0. Provenance was never recorded, so rather
      than argue it, both are credited on a new **Illustrations** section of `/colophon` naming the
      creators and linking CC BY 4.0, with every public footer linking there. Compliant on ESA's
      reading, merely polite on NASA's. §3(a)(2) expressly allows attribution by link, which is the
      only workable medium when the images appear as trail-map thumbnails.
- [x] **The lesson is written where the next person will hit it.** `CREDITS.md` and
      `landing/data.ts` now say that a NASA-hosted image is **not** automatically public domain, that
      NC and ND are never acceptable here, and that the source URL must be recorded on adding a file.
      Half the work in this pass came from not knowing where an image had been downloaded from.

**Verified.** 798 unit tests, build and lint clean. `npm run audit:contrast` PASS over 3,347 text
nodes across 27 views in both themes, `/legal` included. Against a real gated production build with
the live Supabase env, `/legal` renders its own content to a signed-out visitor and carries the name,
address, KvK number, email and the VAT explanation; `/privacy` names the same controller; `/contact`
publishes the DSA address; `/colophon` carries the Hubble credit with the licence linked; the footer
links to it. `/sitemap.xml` lists `/legal`.

**Still with the owner**, and none of it is code: check the Supabase DPA, save the Vercel and Resend
DPAs as dated PDFs, record the DPF certification dates, supply a VAT number if VAT-liable, click the
data export once, and have the €200 to €400 trade mark conversation. On that last one the owner's own
search turned up **Studio Drift Holding B.V.** holding DRIFT in Nice classes 9, 41 and 42 in the
Benelux, which is exactly the escalation trigger the audit set at Mi-8. `docs/owner-actions.md` §6
explains trade names versus trade marks, what the classes mean, and the bounded question to ask.

---

## Gallery images were not loading, and it was not us ✅ *(2026-07-31)*

Reported alongside M2: every card in the Gallery realm showed its title and description over the
monogram placeholder, with no artwork. It looked like a regression from M1's fail-closed image rule,
which is what makes it worth writing down: **it was not.** That rule is scoped to Wikipedia images,
and the Art Institute path never touched it.

**The museum's image host is behind Cloudflare bot management, and its rules changed.** A request
that looks like a browser but carries a `Referer` from a localhost origin gets a 403 challenge page,
which the browser then discards as `ERR_BLOCKED_BY_ORB`. Measured, deterministically, 5 out of 5
each way:

| Request | Result |
|---|---|
| `Referer: http://localhost:3000/`, browser UA | **403** |
| no `Referer`, browser UA | **403** |
| `Referer: https://www.usedrift.org/`, browser UA | 200 |
| no `Referer`, our own `Drift/1.0 (url; email)` UA | 200 |

So this only ever bit **local development**, and the live origin is unaffected. Note the last row:
an honest, identifying User-Agent passes where a browser-shaped one without a referrer does not,
which means the fix needs no header spoofing at all. Worth recording against audit **C-6**, which
found on 31 July that "AIC's IIIF image server imposes no anti-hotlinking condition": still true as a
matter of terms, no longer true as a matter of what a server returns.

- [x] **`/api/img/artic/[id]/[width]`**, a same-origin passthrough that fetches with the same
      identifying User-Agent the JSON API gets. The upstream URL is BUILT from a validated UUID and
      a bounded width, never taken from the caller, so it cannot be pointed at another host. Streams
      rather than buffers, and caches for the museum's own 30 days.
- [x] **`ARTIC_IMAGE_PROXY`, on outside production and off inside it.** Proxying moves image bytes
      onto our bandwidth, and `docs/beta-readiness.md` deliberately relies on card images not doing
      that, so production keeps linking to the museum. Set it to `1` in Vercel if the museum ever
      starts refusing the live origin too; budget roughly 250 KB per artwork and 1 MB per zoom.
      Licence-wise the switch is free either way: every artwork is CC0 and checked per response
      against the museum's own `info.license_text`.

**Verified** in a real Chromium: from a page on `http://localhost:3000`, a direct museum URL fails
with `ERR_BLOCKED_BY_ORB` and the same three artworks load through the passthrough at their full
843px. The route rejects a path-traversal id and an out-of-range width with 400. Production mode was
checked too: with the switch at its default, cards carry the museum's own URL exactly as before.

---

## Compliance audit, M3 + M4 + M5 ✅ *(2026-07-31)*

The last three milestones, done together. With these the audit is fully implemented in code; what
remains is on the owner's list and needs a dashboard or a decision, not a commit.

### M3 — the Gallery is now filtered for EUROPE, not America (M-4)

The museum's `is_public_domain` is a **US** determination: 95 years from publication, so in 2026
anything published before 1931. Europe runs on life of the author plus 70, counted from 31 December
of the year of death, so the author must have died in **1955 or earlier**. The gap is not narrow, and
the museum's own terms put the burden on the reuser.

- [x] **`lib/realms/artic.publicdomain.ts`**, pure and 20 tests. Admit only where **every** attributed
      artist died at or before `currentYear - 71`, recomputed from the clock so the Gallery widens by
      a year each 1 January with no edit. One unknown modern hand on a collaboration excludes the
      whole work. Where there is no death date, or no artist at all, fall back to the artwork's own
      end date and require it to precede 1830.
- [x] **An unresolvable artist narrows rather than empties.** A failed agent lookup counts as "death
      date unknown", which sends the work to the date proxy, so an upstream hiccup costs the modern
      end of the Gallery rather than all of it.
- [x] **One gate, every seam.** `usable()` in the server adapter is `isUsableArtwork` plus the term
      test, and all seven card-producing paths go through it, including the thread candidates: a
      chip promising somewhere to go must not lead somewhere Drift may not show. Artist search
      drops in-copyright artists before offering them, so a name never resolves to an empty drift.
- [x] **Costs one request per batch, not per artwork.** `/agents?ids=a,b,c` takes a list, and the
      records are cached for the life of the instance.

**Verified against the live API**, which is the only way this could have been: *E-10: English Dining
Room* by **Narcissa Niblack Thorne**, whom the museum flags `is_public_domain=true` and who **died in
1966**, is now refused. Mondrian (1944), Pippin (1946), van Gogh (1890) and Matisse (1954, whose term
expired one year ago) are all admitted. Antiquities with no named artist survive on the date proxy.
"Thorne" returns no artist match at all.

⚠️ **The Gallery got smaller, and by more than the audit predicted.** Of a 20-item page: eight
buckets lose 0 to 4, but **ukiyo-e drops to 13/20 and botanical to 9/20**. That is not modern
copyright, it is the 1830 proxy catching nineteenth-century work whose artist has no recorded death
date. The audit called that proxy "deliberately conservative" and it was left exactly as specified,
because loosening it is a legal judgement, not a product tweak. If the owner wants that material
back, the derivable alternative is `cutoff - 85` (1870 in 2026), on "made it at fifteen, lived to a
hundred". Their call, and it is on their list.

### M4 — the consent gate and the age gate (B-1, M-8)

The "on" side of the switch M0 built. This is what has to exist before `NEXT_PUBLIC_ADS_ENABLED=1`
is ever set.

- [x] **`lib/consent.ts`** (pure, 13 tests) and **`components/ConsentGate.tsx`**. The provider, the
      banner, the footer link and the AdSense loader in one file, because they are one mechanism.
- [x] **One invariant, and it is the whole point.** `AdSenseLoader` renders the Google script if and
      only if the switch is on **and** the stored choice is `granted`. It is the only path to a
      third-party request in the app, which makes the claim on `/privacy` checkable.
- [x] **Accept and Reject at genuinely equal weight**, expressed as one shared class string rather
      than two that could drift. Measured on rendered pixels: identical width, height, font weight,
      size, colour, background and border. Refusing is one click, the same as accepting. This is the
      AP's published `vuistregels` standard and the single thing it writes most letters about.
- [x] **Nothing pre-ticked** (there is nothing to tick: one purpose, two buttons), **no cookie wall**
      (the page stays readable and refusing costs nothing), and **withdrawal from every page** via
      "Cookie settings" in the footer, which reopens the choice. A withdrawal reloads, so the loader
      never mounts again.
- [x] **Google consent mode v2**, all four signals defaulting to `denied`, installed as a blocking
      inline head script so it is in place before anything Google could run. A test asserts the
      bootstrap contains no `'granted'` anywhere.
- [x] **Consent evidence** (Article 7(1) puts the burden of demonstrating consent on us): the choice,
      an ISO timestamp, and the version of the ask. A record answering an older version reads as
      unset and re-asks, because consent does not carry across a change of purpose or recipient.
- [x] **The 16+ age gate (M-8).** A never-pre-ticked declaration at sign-up, checked before the
      password so nobody is asked to fix a password for an account they may not have. Only the
      **boolean** is stored (`settings.age16Plus`): a date of birth would be a new category of
      personal data to hold, protect, export and delete for an answer we do not need.
- [x] **`/faq` copy joins `/privacy`** in deriving its advertising paragraph from the same
      `adsConfig()` read that governs the loader, so neither page can describe a state the app is
      not in. That was the B-3 failure.

**Verified in a real browser against a build with ads ON and the live publisher id**, which is the
configuration this exists for:

| | third-party hosts | cookies |
|---|---|---|
| no choice made | **NONE** | **NONE** |
| pressed Reject all | **NONE** | **NONE** |
| pressed Accept all | `pagead2.googlesyndication.com` | none yet |

That is the exact inverse of the M0 breach. Re-verified that **ads OFF is still genuinely nothing**
across 10 pages with the live publisher id present: no banner, no `gtag`, no third-party request.
Contrast PASS with the banner on screen on every page, both themes.

⚠️ **This is not a certified CMP, and it cannot be.** Google separately requires a Google-certified
IAB TCF v2.2 platform for personalised ads in the EEA and UK (audit B-2), and certification is a list
you are on, not code you write. This gate is what makes Drift lawful under ePrivacy and the GDPR. It
does not make Drift eligible for personalised ads. Also not built: suppressing personalised ads for
under-18s, which needs an 18+ signal Drift does not collect and a Google API that cannot be tested
without an approved account. Both are on the owner's list as BEFORE ADS.

### M5 — hygiene (M-10, BP-2, BP-3, BP-4, C-3)

- [x] **The cache guard is structural, not a comment (M-10).** `cacheHeaders(profile, request)` now
      takes the request and refuses if it carries an `Authorization` header or a Supabase session
      cookie. To cache anything you must hand over the object that proves you should not. It
      **throws in development** and degrades to `no-store` in production: a route that stops caching
      is a performance problem, and serving one reader's data to another is not a problem you fix
      afterwards. All 11 call sites updated.
- [x] **`Accept-Encoding: gzip` on Wikimedia requests (BP-3)**, which the robot policy asks for.
- [x] **`Retry-After` is honoured rather than capped (C-3).** The old code did
      `Math.min(retryAfter * 1000, 1500)`, which is not honouring it: told to wait five seconds and
      returning after 1.5 is a faster way to be refused again, and repeated early retries are what
      move a client into Wikimedia's lowest access class. Now the stated wait is taken in full, the
      **HTTP-date form** is parsed (it used to read as absent), and a wait longer than 3 s means give
      up rather than retry early.
- [x] **Deletion propagation is proved, not assumed (BP-4).** `lib/deletion.test.ts` reads the real
      migration SQL and asserts every column referencing `auth.users` carries `on delete cascade`,
      including both ends of `shares`, so a share already delivered to a friend goes when either
      party deletes their account. It also fails if a future migration adds a user reference without
      one.
- [x] **A licence line on the text export (BP-2)**, with the reasoning recorded next to it: the audit
      is explicit that a text export of titles and URLs is *not* Adapted Material and does not engage
      §3(a), so this is courtesy, and it does not claim the file is licensed.

### One thing the verification found that the audit missed

Measuring "ads off means zero cookies" turned up a cookie: **`WMF-Uniq`, set by `upload.wikimedia.org`
whenever a card's picture loads.** Reproduced 4 out of 4. It is Wikimedia's own cookie on Wikimedia's
own domain, httpOnly, unreadable by Drift, and it appears only once you are reading cards; **the 13
public pages set nothing at all**. Not caused by any of this work, and not a tracker of ours, but
`/privacy` said "no cookies" and that is now stated accurately instead. Removing it entirely would
mean proxying every Wikipedia image the way Gallery images can be proxied, which is a real bandwidth
decision and belongs to the owner.

**Verified overall.** 855 unit tests (up from 798), build and lint clean, `npm run audit:contrast`
PASS over 3,356 nodes across 27 views in both themes, and 3,551 with the consent banner on screen.

---

## Compliance audit: review and clean-up ✅ *(2026-08-01)*

Six milestones landed in two sessions and the owner reported being lost in the volume of it. This
session re-checked the work against the audit rather than against its own write-up, then cut back
what the volume had left behind. **No finding was found to be wrongly implemented or missed.**

**The review.** All six milestones were spot-checked against the audit's actual text, not the plan
entries describing them: the one-switch ads gate, the consent gate's single invariant, the
fail-closed image rule and where it is applied, the EU public-domain filter at all seven
card-producing seams, the cache guard's required-request signature, the licence module, the imprint,
the public-route registry, the PNG export, the arXiv gate. Gates re-run clean from scratch: **855
tests, build, lint**. The implementation is in good shape and the pure-logic-in-`src/lib` discipline
held throughout, which is why it was checkable at all.

**What the volume left behind, now fixed.**

- [x] **A stale comment on `/contact` said the imprint "is a decision they have not made yet".**
      `/legal` has existed since the M2 closing pass. A future session reading that would have
      rebuilt something that is already live. Now it says where the imprint is and why it is not
      duplicated onto `/contact`.
- [x] **The arXiv pre-flight work existed only inside the audit document.** M-12 requires the
      no-endorsement disclaimer to name arXiv (an express ToU prohibition, not the inference it is
      for Wikimedia and the museum) and notes the licence claim can be made more generous, since the
      ToU puts titles, authors and abstracts under CC0. Nothing at the flag said so. The note now
      lives at `PAPERS_ENABLED` in `src/lib/realms/index.ts`, which is the one place a session
      enabling the realm must pass through. The rate limit was already handled.
- [x] **`docs/handover-m2.md` deleted.** A handover prompt for a milestone finished three
      milestones ago, describing `/legal` as blocked and M3 to M5 as future work. Recoverable from
      commit `e6dc681`.
- [x] **`docs/processing-record.md` corrected on two points.** It still said the hosting regions were
      unknown after the owner had looked them up (now: a request to write the answers in, since they
      were never recorded), and still carried deletion propagation as a "known gap" when M5 proved
      the cascades against the real migration SQL. All three of BP-4's places to check are now
      answered, including the honest residual: Resend's own message logs are outside our reach.
- [x] **This file's "Current status" block was itself the slop.** It had grown to ~150 lines of
      stacked "Latest" paragraphs going back to 2026-07-22, all of which are in the log below in
      full, and its baseline numbers were three sessions stale (641 tests, 16 views). Replaced with a
      status block, plus a standing instruction not to stack another paragraph onto it.
- [x] **`docs/owner-actions.md` rewritten from 447 lines to a prioritised list.** The old file mixed
      four completed items, a legal tutorial on what a DPA is, a trade mark primer, and the four
      things actually outstanding, with no ordering by what matters. The rewrite leads with where the
      owner stands, then: four tasks totalling about half an hour, the advertising decision, the
      judgement calls each with a recommendation, and a parked ads checklist. The audit's reasoning
      stays in the audit, where it can be read on purpose rather than by accident.

**The substantive finding of the review is about advertising, and it is arithmetic rather than law.**
Vercel Hobby is licensed for non-commercial use only, so the first rendered advert requires Vercel
Pro at roughly $240 a year, against a few euros of AdSense revenue at fifty readers, on an account
that stands refused. Nearly every remaining obligation in the audit (a certified CMP, Google's data
processing terms, a VAT number, under-18 ad suppression) exists only because of ads. Recommending
against them removes most of the remaining burden and costs the project nothing it currently has.

**Not changed, deliberately.** The public footer now carries four small-print paragraphs (the content
licence, the illustration credits, the independence disclaimer, the copyright line). That is legal
creep on a page designed to be quiet, but every element is either required or cheap insurance the
audit specifically asked for, and thinning it is a copy decision for the owner rather than a
clean-up. Flagged rather than done.

**Verified.** 855 tests, build and lint clean, after the changes as before them. The two code edits
are a comment and a comment; no behaviour was touched.

---

## Phase 27: share a card or trail outward ✅ *(2026-08-01)*

Ads were ruled out on cost grounds, so the growth idea is now that a reader can send a card or a
finished trail to someone outside Drift, usually on WhatsApp. Full design in the approved plan; the
research that shaped it is summarised here because two of its findings constrain everything after.

**What the research settled.**

- **Android opens links in the installed app already.** Chrome captures in-scope links into an
  installed PWA by default. `launch_handler` only refines which window.
- **iOS cannot, and this is a hard platform limit.** No universal-links equivalent exists for a
  home-screen web app; links open in Safari or the sender's in-app browser, always. Worse for us,
  **an iOS PWA's storage is a separate container from Safari's**, so a reader signed in inside their
  installed Drift arrives at a shared link signed OUT. Not fixable. The design absorbs it by making
  the signed-out read good rather than by pretending otherwise.
- **A signed-out trial is nearly free.** Every content API route already requires no auth (the login
  gate is a client-side page gate), so the trial reuses `CardView` and needs no backend at all,
  which also means per-image credits and the fail-closed image rule come with it.

### ⚠️ This reclassifies Drift under the DSA, and `/terms` currently says otherwise

Friend-only sharing sat outside the definition of an "online platform" because `are_friends()` made
"a closed group of a finite number of pre-determined persons" (Recital 14) a database fact. **A
forwardable link is not that**, and Recital 14 adds that requiring registration does not help where
admission is automatic. So public links make Drift an online platform.

The obligation delta is small: **Article 19 excludes micro and small enterprises from Articles 20 to
28** (bar 24(3), which is answering the ACM if it asks for user numbers), and Articles 11 to 18
already applied and are already built. **Nothing new has to be built.** But `src/lib/terms.ts` states
the old classification in as many words, and a published document describing a state the app is not
in is exactly the audit's B-3 failure. That correction is M4 and must ship before the feature is
reachable in production.

### M1: the link exists ✅

- [x] **`supabase/migrations/0004_public_shares.sql`.** Token as primary key (16 random bytes,
      base64url), owner cascade, revoke as a timestamp rather than a delete so the owner keeps the
      record while a reader sees the same nothing as an invented token.
- [x] **No anonymous SELECT policy, deliberately.** The obvious design, `for select to anon using
      (revoked_at is null)`, is quietly catastrophic: RLS filters rows but does not require a WHERE,
      so any anonymous caller could `select *` and read every share ever created. Reads go through
      **`get_public_share(token)`**, a security-definer function taking the token as an exact-match
      argument, so there is no listing and no enumeration. The token is the capability.
- [x] **`lib/publicshare/link.ts`** (pure, 13 tests): tokens, URLs, titles, and `parsePublicShare`,
      which turns any malformed row into the same calm "not available" as a revoked one.
- [x] **`lib/publicshare/server.ts`.** A separate anonymous client, because `getSupabase()` returns
      null during SSR by design and the og: tags must be in server HTML: WhatsApp's preview crawler
      runs no JavaScript.
- [x] **`lib/publicshare/client.ts`** (create, revoke, list) and **`components/ShareLink.tsx`**, with
      the OS share sheet and a copy fallback. The token is minted client-side so the share sheet can
      open in the same gesture, since `navigator.share` needs transient activation.
- [x] **Entry point at the trail map**, under it rather than in the button row: the map is the exit
      and the reward (principle 3), so the offer to show it comes after you have looked. Not behind
      `NEXT_PUBLIC_SOCIAL`: that flag hides the friend *graph*, and a link you paste into a chat
      yourself is not one.
- [x] **`npm run verify:share` passes, 11 checks against the live database.** The sharpest is that an
      anonymous `select *` on `public_shares` returns nothing; if that ever fails, every link in the
      system is exposed at once. Also proved: a revoked token and an invented one are the same
      nothing, a stranger can neither read nor revoke someone else's link, and deleting a user takes
      their links with them.
- [x] **The script provisions BOTH its test users and deletes them**, rather than using
      `SUPABASE_EMAIL`. That account's password has been stale since July, so a sign-in failure there
      reads as a bug in the feature; and more seriously, this script deletes shares and deletes a user
      to prove the cascade, which must never be pointed at the owner's real account.

### M2: the public page ✅

- [x] **`/s/[token]`, a SERVER component.** It has to be: WhatsApp's preview crawler runs no
      JavaScript, so the og: tags must be in the server HTML, and a reader arriving from a chat
      should get the thing rather than a spinner that becomes the thing.
- [x] **`noindex` on both branches, and `/s/` disallowed in `robots.txt`.** A token is a capability,
      so a search engine listing one has handed it out. Also keeps Drift from becoming a crawlable
      republication of Wikipedia, which is what AdSense rejected the site for once already.
- [x] **One dead-link state for every kind of dead**: revoked, mistyped, from a deleted account, or
      never real. A reader cannot act on the difference and a prober learns nothing from it.
- [x] **The link preview** (`opengraph-image.tsx`), 1200x630 and 45KB, well inside WhatsApp's ~300KB
      cliff. ⚠️ **Titles and trail shape only, never the source images**: arranging third-party
      pictures into a composite is what makes an artefact Adapted Material under CC BY-SA 4.0, the
      same reasoning that took images out of the PNG export (audit B-5). Carries the burned-in
      `Titles from Wikipedia · CC BY-SA 4.0` line, because this file is built to travel.
- [x] **Signed in: "Save a copy" and "Drift on from here"**, the latter seeding `/drift` from the
      trail's last stop, so you pick up where the sender left off.

### M3: three cards ✅

- [x] **`CardView` reused rather than a lighter public card.** That is the whole design: per-image
      credits, the fail-closed image rule, the source link and the modification indication all come
      with it. A second card component would have been a second place to forget them, which is
      exactly what the audit found in the friend inbox (Q-7).
- [x] **The limit is stated before the first pull, never after the third.** A limit you know about is
      a boundary; one that appears once you are invested is the pattern this app is a reaction to.
- [x] **Zero backend work**, because every content API route already requires no auth. The cap also
      bounds anonymous draw on the shared Wikimedia budget (`docs/beta-readiness.md` Q3).
- [x] **Trial cards carry `arrivedVia`**, so a card still says why it appeared (principle 1). It would
      otherwise have been the one place in Drift where something arrived unexplained.

### M4: the app, and the documents ✅

- [x] **`launch_handler: navigate-existing`.** Chrome already captures in-scope links into an
      installed PWA, so Android worked; this stops three shared links leaving three Drift windows.
      Does nothing on iOS, and the copy never claims otherwise: the install line reads "Drift installs
      to your home screen", not "open this in the app", which would be a button that does nothing for
      half its readers.
- [x] **`/terms` corrected, with a test that pins it.** The old sentence explained the Article 20/21
      exemption by "sharing only ever reaches mutual friends", which public links made false. It now
      cites Article 19, and a test fails if either the old sentence or the phrase "not an online
      platform" reappears. **The exemption now rests on the operator being one person rather than on
      the architecture**, which is a weaker guarantee and worth knowing is the load-bearing one.
- [x] **A `/terms` section on share links**, saying plainly that a link is a key rather than an
      invitation, that anyone holding it can pass it on, and that "Stop sharing" kills it for
      everyone. Effective date moved to 1 August 2026.
- [x] **`/privacy` row**, its own rather than folded into the friends row, because this is the only
      thing in Drift deliberately readable without an account.
- [x] **`docs/processing-record.md` v2**: activity row 9, the §3 correction, and the capability-vs-RLS
      note. A dated banner on the audit document records that M-5 and C-10's classification is spent.
- [x] **Share links in the data export**, including withdrawn ones, and not behind
      `NEXT_PUBLIC_SOCIAL`.
- [x] **`audit:contrast` measures the share page** via `AUDIT_SHARE_TOKEN=<token>`, and prints a note
      when no token is supplied so it cannot go quietly unmeasured.

**Verified.** 869 unit tests, build and lint clean, `npm run verify:share` 11/11 against the live
database. In a real browser against a gated production build: the trail and card pages render signed
out with all three stops and their notices; three pulls work against the live Wikipedia API and the
budget survives a reload; the invitation and CTA appear at the limit and the chips go; a dead token
lands on the calm state; signed in, the panel replaces the trial, "Save a copy" lands in My Trails and
"Drift on from here" points at the last stop. `npm run audit:contrast` PASS over **4,928 text nodes
across 28 views in both themes**, share page included.

⚠️ **One verification lesson worth keeping.** A first contrast run "PASSED" at 408 nodes and a
screenshot showed the trial missing. Neither was a code fault: `next start` was serving a `.next`
that had been rebuilt underneath it, so chunk hashes no longer matched, hydration failed silently,
and every client component vanished while server-rendered text stayed. **A passing contrast run with
a suspiciously low node count means a stale server, not a clean page.** Kill the server before
rebuilding.

**Not done, deliberately:** view counts, open notifications, link expiry, and unhiding the friend
layer. The first two are engagement loops and are named as out of scope in `ShareLink.tsx` so the
next session does not add them as an obvious improvement.

### M5: the three things owner testing found ✅ *(same day)*

The first pass shipped a feature that was verified at desktop widths and signed out, and all three
faults lived exactly outside that. Worth recording, because the pattern is more useful than the bugs.

- [x] **There was no way to share a card at all.** `CardView` has had an `onShare` hook since Phase
      10, and the feed passed it, but gated on `socialEnabled()` — the flag that hides the FRIEND
      GRAPH, which is off. So the control never rendered, and the only route out of the app was to
      finish a trail first. The gate is now `cloudConfigured && user`: hiding the friend graph should
      never have hidden public sharing, which is not a social graph.
- [x] **One sheet for one verb.** There were two unrelated affordances: a paper-plane button labelled
      "Send to a friend" on a card, and a separate "Share a link" panel under a trail map plus its own
      "Send to a friend" button. New `components/ShareSheet.tsx` is opened by both surfaces and offers
      the same two things in the same order: a public link always, sending to a friend only when
      `NEXT_PUBLIC_SOCIAL` is on. The card button now reads "Share this card".
- [x] **The card could not be scrolled on a phone (`flow` mode on CardView).** The real fault was
      shape, not CSS. `CardView` is built for the feed, where the card owns the viewport, the page
      behind it does not scroll, and one marked region `[data-drift-scroll]` is what the drift gesture
      measures. Dropped into a 70vh box on a scrolling page that becomes **two nested scrollers**, and
      on touch they fight: a drag either moves the page and carries the card away or moves the card
      and feels stuck. `flow` makes the card grow to its content so the PAGE scrolls, and takes the
      feed-only parts with it: the scroll region and its marker, the "threads below" hint, the
      overscroll-to-advance cue, and the pinned desktop thread bar (`ThreadsSection` gained a third
      `flow` variant that shows at every width).
- [x] **The two auth states are now coherent, and each says which it is.** What read as a phone
      versus laptop difference was signed-out versus signed-in, and the states genuinely diverged: a
      signed-in reader got no threads at all, which is the one thing Drift is for. Threads are now
      fetched once, by a shared `useThreads` hook, and shown in both states. Pulling one means
      something different on purpose: **signed out it continues inline and costs one of three cards;
      signed in it hands off to the real feed** at `/drift?seed=…`, because an account holder should
      not be reading a cut-down Drift inside a share page when the real one is one navigation away and
      will keep their trail. Both panels now open with a plain label, "You are signed in" or "You are
      not signed in", so the difference is legible instead of looking like a bug.

**Verified on a real iPhone 13 viewport, both auth states**, which is what the first pass did not do:
signed out, a shared trail shows its state label, 3 stops and 3 chips, a pull produces a card with
**no nested scroller** and the page scrolling 1305 to 2205px, and that card carries its own 3 threads;
a shared card carries its threads directly; signed in, the panel shows both actions plus chips that
hand off to `/drift?realm=encyclopedia&seed=Aspheric%20lens`; and in the feed the share button is
present, the sheet opens, a link is minted and "Stop sharing" is offered. 869 tests, build and lint
clean, `verify:share` 11/11, contrast PASS over **4,930 nodes across 28 views** in both themes.

**The lesson, for the next feature that reuses a feed component.** `CardView`, `TrailMap` and the
gesture layer are written for a screen the feed owns. Reusing them elsewhere is right, and the
attribution machinery is the reason to, but check what they assume about their container before
trusting a desktop screenshot. And verify at 390px in both auth states, not one of the four.

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
