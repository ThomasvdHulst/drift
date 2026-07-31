# Handover prompt: pick up at M2 of the compliance audit

Paste everything below the line into a fresh session, or just point the next session at this file.

---

You are picking up work in the **drift** repository, mid-way through implementing an independent
legal and copyright audit. The working tree is clean, all gates pass, and nothing is committed
(nothing is ever committed here unless the owner asks).

## What Drift is

A local-first web app for "healthy scrolling": a feed of full-screen knowledge cards where **the user
is the algorithm**. Every card shows visible "threads" (related directions) you pull to steer your own
rabbit hole. Sessions have a beginning (a seed), a middle (the trail) and an end (a shareable trail
map). Content is Wikipedia (Encyclopedia realm) plus public-domain art from the Art Institute of
Chicago (Gallery realm), with an experimental arXiv realm behind a flag. Next.js 16 + React 19 on
Vercel, IndexedDB locally with optional Supabase sync, login-gated, live at
<https://www.usedrift.org> in a 20 to 50 person beta. Its soul is the anti-slot-machine principles in
CLAUDE.md §2, which bind every feature.

## Read these first, in this order

1. **`CLAUDE.md`** — the working rules. §2 (principles), §4 (API facts and graceful degradation),
   §8 (**the working agreement**: nothing is done until tested and *verified*; tick boxes in
   `plan.md`; stop after each milestone; never commit unless asked), §10 (contrast rules).
2. **`docs/drift-compliance-audit.md`** — the audit you are implementing. Long, and worth reading in
   full at least for the Blocking and Material findings. The reasoning matters: it cites the
   provisions, so you can write copy that is actually accurate rather than approximately legal.
3. **`plan.md`** — the living progress tracker. Read the "Current status" block, then the two newest
   entries at the bottom: "Compliance audit, M0" and "Compliance audit, M1".
4. **`docs/owner-actions.md`** — everything that needs the owner rather than code. Keep it current as
   you go; it is how they know what is waiting on them.
5. Skim `src/lib/site.ts`, `src/components/PublicPage.tsx`, `src/app/(app)/privacy/page.tsx`,
   `src/app/(app)/account/page.tsx`, `src/app/api/contact/route.ts`.

## What is already done

**M0 (deployed or deploying): the live breach.** The AdSense loader used to run whenever a publisher
id was configured, independent of the ad kill switch. Production was serving `adsbygoogle.js` and
`fundingchoicesmessages.google.com` and writing an `FCCDCF` cookie to every visitor, including
logged-out EEA visitors, with no consent mechanism, while earning nothing because the AdSense
application had been refused. Now **one switch** (`NEXT_PUBLIC_ADS_ENABLED`) governs the loader, the
ownership meta tag, the consent gate and the copy that describes them. `/privacy` no longer describes
a consent prompt that does not exist. `ads.txt` is parked at `docs/ads.txt.pending`.

**M1: attribution that travels.** Per-image creator and licence on every card (`src/lib/imagecredit.ts`
parses `extmetadata`; `fetchImageCredits` in `src/lib/wiki-server.ts` gets it in one batched call per
card batch). Two fail-closed rules: no image if its licence needs a credit we cannot establish, or if
the file carries `Restrictions`. The `excerpted and reformatted by Drift` modification indication that
CC BY-SA §3(a)(1)(B) requires. An `attribution` block on every card so trails and shares are
self-describing. The licence notice on received cards in the inbox. Images removed from the PNG export
(the strongest ShareAlike trigger in the product). The AIC caption completed and every museum response
checked against its own `info.license_text`. The current-events portal credited, `/sources` corrected,
an independence disclaimer added, and `public/landing/CREDITS.md` written.

Do not redo any of that. If something there looks wrong, say so rather than silently changing it.

## Your job: M2, the legal documents

Everything below is required regardless of whether ads ever run. None of it is blocking *today*
(ads are off, the app is behind a login), but the DSA obligations have no size threshold and the
privacy notice is missing most of what Article 13 requires.

### 1. `/terms` — Terms of Service *(audit M-5)*

The audit's DSA classification is already done and is genuinely useful, so do not redo it: Drift is a
**hosting service** but **not an online platform**, because sharing is restricted to mutual friends
and that restriction is enforced by a database policy rather than the UI. That removes DSA Articles
20 to 28 entirely. Article 15(2) exempts a micro enterprise from transparency reporting. Live
obligations are Articles 11, 12, 14, 16, 17 and 18. The audit's M-5 remedy lists the required content
item by item; follow it.

**One trap, and it is easy to walk into.** Do **not** include a standard "you may not copy or
redistribute content from this service" clause. CC BY-SA 4.0 §2(a)(5)(C) forbids downstream
restrictions, so boilerplate like that would be a licence breach caused by the very document you are
writing to fix a compliance gap. The terms must expressly carve out the source content and say it
remains available to users under its own licences.

### 2. Article 16 notice-and-action *(audit M-5)*

A route for reporting illegal content. It must capture a substantiated explanation, the exact
location, the notifier's name and email — **except** for notices about offences under Articles 3 to 7
of Directive 2011/93/EU, where anonymity must be possible — and a good-faith statement. Automated
acknowledgement of receipt (Art 16(4)), and notification of the outcome and available redress
(Art 16(5)). It can be a mode of `/contact` rather than a separate page. `src/app/api/contact/route.ts`
and `src/components/ContactForm.tsx` are the existing machinery; reuse the Resend send path and the
anti-spam layers.

### 3. Article 11/12 contact points *(audit M-5)*

One line on `/contact`, naming the single point of contact for Member State authorities, the
Commission and the Board, the languages you accept, and that recipients may use the same address.

### 4. `/privacy` rewritten *(audit M-7)*

The audit has a table of exactly what is missing against Articles 13 and 14, and a **legal-basis
mapping** you should follow rather than invent. The important part of that mapping: the service runs
on Article 6(1)(b) *contract*, **not** consent. Only advertising is consent. Writing "we process your
data with your consent" across the board is both inaccurate and strategically bad, because it makes
every operation withdrawable.

Name the processors (Vercel, Supabase, Resend, Cloudflare, Google), state retention periods, and keep
the plain-language voice the page already has — the audit explicitly calls that a virtue. A layered
notice (short human summary, then the full detail) satisfies Article 12(1) better than either extreme.

### 5. `/legal` imprint *(audit M-6)* — **BLOCKED, do not build with placeholders**

Needs the owner's legal name, establishment address, and KvK/VAT position. That decision is item 4 of
`docs/owner-actions.md` and the audit recommends a lawyer for it (§6.1), because the answer decides
whether they publish their home address. **A placeholder imprint is worse than no imprint.** Build the
page only once you have the real details. If they are not available, leave it, and say so clearly in
your summary.

### 6. Data export *(audit Mi-3)*

Article 20 does not require a self-service button, it requires you to *fulfil requests*. But the
button is about two hours and also serves Article 15 access requests. Put it beside the existing
delete flow in `src/app/(app)/account/page.tsx`; the account-deletion path already enumerates the same
tables, so the export is the same joins with `select` instead of `delete`. Return one JSON file.

### 7. Contact-form disclosure *(audit Mi-5)*

The per-IP throttle and Cloudflare Turnstile both process IP addresses, which are personal data, and
neither is mentioned anywhere. Article 13 requires disclosure **at the time the data are obtained**,
so it needs a line at the form itself, not only in `/privacy`. Be accurate about the throttle: it is
in-memory in an ephemeral serverless function and never written to disk.

### 8. `docs/processing-record.md` *(audit Mi-4)*

The Article 30 record. Note that the "fewer than 250 employees" exemption **does not apply**, because
the carve-outs are disjunctive and Drift's processing is continuous rather than occasional. One table,
six or seven rows. Most of the content comes from the privacy work in step 4.

## Facts you need before you start

- **`src/lib/site.ts` is the single source of truth for public routes.** `PUBLIC_CONTENT_ROUTES` feeds
  both `AuthGate` (via `isPublicRoute`) and `sitemap.ts`. Add `/terms` and `/legal` there and both the
  gate and the sitemap follow. A test asserts the invariant in both directions.
- **`src/components/PublicPage.tsx`** is the shell every public page uses: `PublicPage`, `Section`,
  `P`, `Bullets`, `Lead`, `A`. Server-only and hook-free on purpose, so these pages server-render
  their full text and a crawler does not need JavaScript to read them.
- **`<Lead>` convention, no exceptions:** the trailing space goes **inside** the tag
  (`<Lead>Attribution. </Lead>`). JSX drops whitespace between an element and a following line in some
  positions. Where a comma or colon follows, put it inside the tag too, so a `</Lead>` never sits
  against punctuation.
- **No em or en dashes in user-facing copy.** A standing owner preference, enforced by unit tests for
  several copy registries. Use periods, colons, commas, parentheses.
- **Tone.** The owner pushed back once already on copy that read like a series of essays with a moral
  at the end. Plain, specific, calm. No aphorisms, no wholesome lessons, and do not sell the product.
  Read `/principles` and `/faq` for the register they settled on.
- **Add new routes to `scripts/audit-contrast.mjs`**, or they go unmeasured. WCAG 2.2 AA is a standing
  gate here (CLAUDE.md §10).

## How to verify

CLAUDE.md §8 is strict about this and it is the rule that matters most here.

- `npm run test`, `npm run lint`, `npm run build` all clean. Currently **738 tests**.
- `npm run audit:contrast` against a running dev server, for the new pages in both themes.
- **Browser check against a real gated build**, which is the only way to test the auth gate:
  `npm run build && npx next start -p 3181` with the real Supabase env present, then confirm every new
  page renders its own content to a signed-out visitor rather than the sign-in screen.
- For ungated UI work: `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev`.
  Next 16 allows one `next dev` per directory, so copy the repo to a scratch dir (hard-linking
  `node_modules`) if one is already running.
- Confirm `/robots.txt` and `/sitemap.xml` list the new pages and nothing gated leaked in.

## When you finish

Add an entry to `plan.md` in the style of the M0 and M1 entries: what the finding was, what was done,
what was verified, and anything deliberately left. Update `docs/owner-actions.md` if anything moved
between "code" and "owner". Then **stop** and let the owner review, rather than starting M3.

M3 (Gallery EU public-domain filter), M4 (consent gate and age gate) and M5 (hygiene) come after, and
are described in `plan.md` and in the audit's §5 action list.
