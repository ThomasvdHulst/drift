# Drift — Beta Readiness (sending it to 20–50 friends)

Research + findings for the step from "personal use" to "a small group of real users."
Written 2026-07-19. This is a **findings and options** doc, not a committed plan. Nothing
here is implemented yet. Cross-references: `docs/deploy.md` (the deploy checklist),
`docs/backend.md` §6–7 (backend scaling + auth). The anti-slot-machine principles (CLAUDE.md
§2) still bind every option below.

The four questions this answers:
1. Email, user support, security and safety once we have a domain + Resend.
2. Do the Vercel + Supabase free tiers hold for 20–50 users?
3. The API rate-limit problem: shared or per-user, what causes it, how to scale.
4. What else is crucial before sending links.

---

## TL;DR (what actually matters)

| Priority | Item | Why | Effort |
|---|---|---|---|
| 🔴 must | **Set `WIKI_USER_AGENT` in Vercel with a real URL + email** | Without contact info, Wikimedia may treat us as "unidentified" ⇒ **10 req/min**. With it ⇒ **200 req/min**. Cheapest 20x win there is. | 2 min |
| 🔴 must | **Server-side caching of the Wikipedia proxy** | All users share ONE Wikimedia budget (see Q3). Caching collapses overlapping requests so 5 people reading "Octopus" cost one upstream fetch, not five. This is the real scaling lever. | small–medium |
| 🔴 must | **Custom SMTP (Resend) + turn Confirm-email ON + branded templates** | The built-in Supabase sender does ~2 emails/hour to your own address only. Real signups can't confirm or reset without this. | small (mostly config) |
| 🟠 should | **Account deletion + a plain "what we store" note** | You're now holding other people's email + trails. Courtesy + basic data hygiene. No delete-account path exists today. | small |
| 🟠 should | **A feedback channel + light error visibility** | The whole point of the beta is "do people reach for it." You need to hear back and to know when it breaks. | small |
| 🟢 nice | Custom domain, Supabase Pro ($25/mo) to kill the 7-day pause, leaked-password protection | Polish + reliability once people rely on it. | varies |

---

## Q3 — The rate-limit problem (the important one), solved properly

### What's actually happening

Every card the user sees costs **live** calls to Wikimedia:
- 1 call for the card summary (`/api/realm/wikipedia/summary`),
- 1 call for its threads (`/api/realm/wikipedia/related`),
- plus discover-batch calls when the random buffer refills, plus read-more, topics, etc.

The proxy routes are `export const dynamic = "force-dynamic"` and the upstream fetches use
`cache: "no-store"` (`src/lib/upstream.ts`). **Nothing is cached.** Two people who both drift
into the same page each pay the full upstream cost. There is no shared cache and no CDN caching
on the API responses (no `Cache-Control` headers are set anywhere in `src/app/api/`).

### Shared or per-user? **Shared, once deployed.**

Wikimedia does **not** rate-limit *Drift users*. It rate-limits the **source IP** making the
requests to Wikipedia. Because Drift proxies every Wikipedia call **server-side** (that's the
architecture, and it's correct), the source IP is:

- **Locally (`npm run dev`):** each friend runs their own copy ⇒ their own home IP ⇒ their own
  budget. Not the relevant scenario once you send a link.
- **On Vercel (the deployment everyone hits):** all server-side requests egress from **Vercel's
  shared IP pool**. So to Wikimedia, *every Drift user's traffic looks like it comes from one
  place*. **All your users draw down a single shared budget.** Two people scrolling at once
  roughly double the request rate against that one budget; it degrades linearly with concurrent
  users. That is exactly the "API stops for a few seconds" symptom, now hitting more often
  because more people share the pool.

There's a second, smaller multiplier: the 300 ms spacing gate in `upstream.ts`/`wiki-server.ts`
is a **module-level singleton, per serverless instance**. Under load Vercel runs several
instances concurrently, each spacing its own requests at 300 ms independently, so the aggregate
rate to Wikimedia can exceed what a single gate would allow. The gate smooths one instance's
bursts; it does not coordinate across instances.

### The actual numbers (verified 2026-07-19)

Wikimedia rolled out **global API rate limits in 2025**, and they now apply to **both** the REST
gateway **and the Action API** (`en.wikipedia.org/w/api.php`, which is what Drift uses). Per IP,
for anonymous (no access token) traffic:

| Caller | Limit |
|---|---|
| Anonymous, **no identifying User-Agent** | **~10 requests / minute** |
| Anonymous, **compliant User-Agent** (contact URL/email) | **~200 requests / minute** |
| Requests from real web browsers (unauthenticated) | ~200 requests / minute |
| Authenticated new account | ~200 req/min |
| Established editor account | ~2,000 req/min |
| Bot flag / global rights | exempt |

Source: <https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits>. 200 req/min ≈ **3.3 req/sec,
shared across all users** on the Vercel IP. At ~2 upstream calls per card, that's ~100 card-views
per minute for the *whole app combined* before throttling — comfortable for one person, tight
the moment several people drift simultaneously.

⚠️ **Load-bearing detail:** `wiki-server.ts` falls back to `"Drift/0.1 (local hobby project)"`
if `WIKI_USER_AGENT` is unset, and `docs/deploy.md` currently lists that env var as *optional*.
Under the new rules, a User-Agent **without contact info risks the 10 req/min bucket instead of
200**. So setting `WIKI_USER_AGENT` in Vercel to something like
`Drift/1.0 (https://your-domain; you@email)` is not just politeness anymore; it's a 20x rate
difference. Do this first.

### How to scale (in order of leverage)

1. **Set a compliant `WIKI_USER_AGENT` in Vercel** (URL + email). Moves the shared budget from a
   possible 10/min to 200/min. Two minutes, do it regardless of everything else. Same for
   `ARTIC_USER_AGENT` (Gallery).
2. **Cache the proxy responses.** This is the structural fix. Card summaries and threads are
   **deterministic by title** and change rarely, so they're extremely cacheable. Two good layers,
   ideally both:
   - **CDN / edge caching** on the GET routes: set `Cache-Control: s-maxage=...` (e.g. a day for
     summaries/related, shorter for discover) and drop `force-dynamic`. Vercel's Edge Network then
     serves repeats **without hitting Wikipedia or even running the function** — this cuts both the
     Wikimedia budget draw *and* Vercel function invocations at once.
   - **A shared data cache** for the cases the CDN can't key cleanly (or to survive across regions):
     Next.js Data Cache (`fetch(..., { next: { revalidate } })` instead of `no-store`), or a small
     Upstash/Vercel KV in front of the upstream call. Keyed by realm + native id.
   - Effect: with a handful of users the working set of pages overlaps a lot; caching turns "N users
     × every page" into "each distinct page fetched ~once." The shared 200/min budget suddenly goes
     very far. **This alone likely makes 20–50 low-concurrency users a non-issue.**
   - Note what stays uncacheable: `generator=random` (already mostly retired in favour of discover
     batches) and randomized discover offsets. But summaries + threads are the bulk of per-card cost
     and they cache beautifully.
3. **Keep / tune the client-side load reduction already in place:** 1-ahead prefetch only, the
   random-batch buffer (one request yields ~8–20 cards), the graceful "catching its breath" hint.
   These are good; caching complements them.
4. **(If you ever really push it) Coordinate the gate across instances** with a shared limiter
   (Upstash Redis token bucket), or **authenticate to Wikimedia** (OAuth token / a bot-flagged
   account) for a higher/exempt limit. Both are heavier and almost certainly **unnecessary** at
   50 users once caching is in. Listed for completeness.

**Bottom line for Q3:** it's one shared budget on Vercel, the cause is "no caching + shared egress
IP + a new 200/min-per-IP Wikimedia limit," and the fix is (a) a real User-Agent and (b) caching
the proxy. Neither changes the product or violates §2.

---

## Q2 — Do the free tiers hold for 20–50 users?

**Short answer: yes, with two caveats already covered elsewhere (email SMTP, and the rate-limit
caching above).** Numbers verified 2026-07-19.

### Vercel Hobby (free)
- ~100 GB bandwidth/mo, generous function invocations (Vercel currently quotes ~1M/mo on Hobby;
  older docs said 100k — either way fine), 100 GB-hrs-ish compute, 10 s function timeout.
- **The heavy asset — images — does NOT touch Vercel bandwidth.** Card images are hotlinked
  straight from Wikimedia / Art Institute IIIF. Vercel only serves the app bundle + small JSON
  API responses. So bandwidth is a non-issue at this scale.
- Function invocations are the thing to watch: each card ≈ 2 invocations today. **Caching (Q3)
  cuts this too**, because CDN-cached responses don't invoke the function.
- **Overage behaviour is safe:** exceed a limit and the feature locks until the month resets;
  Hobby **cannot** bill you by surprise.
- ⚠️ **Licence caveat:** Hobby is for **non-commercial / personal** use. Sending it to friends
  and colleagues as a free personal experiment is fine. If it ever becomes a product you charge
  for or run as a business, that needs Pro. "Colleagues trying my hobby project" = fine.
- Sources: <https://vercel.com/docs/limits>, <https://vercel.com/pricing>.

### Supabase Free
- ~500 MB Postgres, ~5 GB egress/mo, **50,000 monthly active users**, ~2 active projects.
- Drift's data is **tiny** (a trail is a little JSON; a few hundred trails is well under a MB).
  Storage, egress, and MAU are nowhere near binding at 50 users.
- **Two real free-tier frictions:**
  1. **Built-in auth email is rate-limited** (~2/hour, own-address only). This blocks real
     onboarding ⇒ solved by Resend SMTP (Q1).
  2. **Projects pause after ~7 days of no activity.** With 20–50 people actually using it this
     basically never triggers; if it does, the next request wakes it (a slow first load). If you
     want zero pausing + daily backups, **Pro is $25/mo** — optional, worth it only once people
     rely on it.
- No backups on Free (see Q4). Sources: <https://supabase.com/pricing>.

### Resend (for Q1)
- Free tier: **3,000 emails/month, 100/day, 1 verified domain**, SMTP relay + DKIM/SPF/DMARC.
- 50 signups + occasional password resets is a rounding error against 3,000/mo. Plenty.
- Source: <https://resend.com/pricing>.

**Verdict:** the free stack holds for 20–50 users. The only free-tier *blocker* is auth email,
and that's exactly what the Resend step fixes. The only free-tier *risk* is the 7-day pause (mild)
and no backups (see Q4).

---

## Q1 — Email, support, security, safety (once you have a domain + Resend)

Grouped into: (A) make email work, (B) auth flows to verify, (C) security hardening, (D) safety /
data-hygiene for real users.

### A. Wire up email (the unblock)
1. **Resend:** create account, **add your domain**, add the DNS records Resend gives you (SPF /
   DKIM / DMARC) at your registrar, wait for verification.
2. **Supabase → Auth → Emails → SMTP Settings:** paste Resend's SMTP host/port/user/password and a
   **From** address on your verified domain (e.g. `no-reply@your-domain`).
3. **Supabase → Auth → Providers → Email → turn "Confirm email" ON.** Sign-up then returns no
   session and the app already shows a "check your email" panel with a Resend action (built in the
   auth overhaul).
4. **Redirect URLs:** confirm Site URL + Redirect URLs include the production domain and
   `/account/reset` (see `docs/deploy.md` Step 4). Email confirm links and reset links both rely on
   these.

### B. Auth flows to actually test end-to-end (with a brand-new address)
The plan notes flag that a full live signup was **not** recently exercised (stale test creds). Before
sending links, run the real thing once:
- Sign up with a fresh email ⇒ receive branded confirm email ⇒ click ⇒ sign in ⇒ land in Drift.
- **Forgot password** ⇒ reset email ⇒ `/account/reset` sets a new password ⇒ sign in.
- **Change password** while signed in (`/account`).
- Sign out ⇒ local data cleared ⇒ sign back in ⇒ trails pulled from cloud.
All of these are already **built**; this is verification, not new code.

### C. Branded email templates (the hand-over item from memory)
Supabase → Auth → Email Templates lets you edit the HTML for: **Confirm signup**, **Reset
password**, **Magic link**, **Change email address**. Deliver branded HTML matching Drift's "quiet
reading room" look (cream paper, ink text, one sage accent, serif display). At minimum do **Confirm
signup** and **Reset password**. (This is the standing to-do noted in memory.)

### D. Security + safety hardening (Supabase settings, mostly free toggles)
- **Re-audit RLS** — every table is `user_id = auth.uid()`; run `npm run verify:supabase` and
  `npm run verify:social` to confirm isolation + friends-only sharing before opening the door.
- **Secret key hygiene** — confirm `SUPABASE_SECRET_KEY` is **not** set in Vercel (only the two
  `NEXT_PUBLIC_*` vars belong there). It bypasses RLS.
- **Leaked-password protection** — Supabase Auth has a HaveIBeenPwned check; turn it on.
- **Minimum password strength / length** — set a sane minimum in Auth settings.
- **"Secure password change"** — enable the re-authentication step (referenced in `docs/backend.md`
  §7).
- **Auth rate limits** — Supabase has built-in per-IP limits on sends/sign-ins; defaults are fine at
  this scale. (CAPTCHA/Turnstile on auth is available but overkill for 50 known people.)
- **Open vs invite-only signup** — a public link can be forwarded. For 20–50 known friends, *open
  signup + email confirmation* is the pragmatic choice. If you want tighter control, options are:
  allowed-email-domain gating, a shared access code in front of signup, or manually creating
  accounts. Decide deliberately; don't leave it unconsidered.

---

## Q4 — What else is crucial before sending links (things easy to forget)

Ordered roughly by importance.

1. **Account deletion + basic data controls.** There is **no delete-account path today** (only
   `clearAllLocalData`, a local wipe). Once you hold other people's email + trails, a "delete my
   account" (removes their rows + the auth user) is the right thing, and expected. A "download my
   trails" export is a nice-to-have (some of it exists via trail PNG/text export).
2. **A plain "what we store" note.** One calm paragraph or a tiny page: what's stored (your email,
   your trails/reactions/settings), where (Supabase), that content comes from Wikipedia/AIC, and how
   to delete it. Colleagues especially will ask. Doesn't need to be a legal doc.
3. **A feedback channel.** The entire point of the beta (CLAUDE.md §9) is learning whether people
   reach for Drift. Add a quiet "send feedback" link (mailto or a simple form). Cheap, high signal.
4. **Light error visibility.** Right now you'd only hear about a break if a friend mentions it. Add
   something minimal: Vercel's built-in Analytics/Logs at least, or a free Sentry project, so you
   *know* when the Wikimedia throttle or an auth issue bites. Pair with the Q3 caching so it bites
   rarely.
5. **First-run clarity for a signed-in user.** The interactive "pull a thread" demo lives on the
   **logged-out landing page**. A brand-new user who signs up lands straight in the app — check that
   the thread mechanic is self-evident there too (a one-time gentle hint, or reuse a bit of the
   landing explanation). Don't assume the landing page taught them; some will sign up fast.
6. **The Q3 caching + User-Agent work** — repeated here because it's the difference between "smooth
   for a group" and "everyone hits the breather at once."
7. **Custom domain, end to end.** Since you're getting one anyway: point Vercel at it, and update
   Supabase **Site URL / Redirect URLs** and the email **From** + links to match. Aligning the app
   domain with the email sending domain also improves deliverability (less spam-foldering).
8. **Backups.** Supabase Free has no backups. If friends' trails start to matter, Pro adds daily
   backups. At minimum, know the risk before inviting people.
9. **Content edge cases.** All content is vetted (Wikipedia CC BY-SA + AIC CC0) with junk filtering,
   but Wikipedia can still surface mature/graphic topics. Low risk for a friends-and-colleagues
   group; just a known non-blocker. No "safe mode" exists.
10. **Attribution stays visible.** "From Wikipedia ↗" links + AIC credits are present — keep them;
    they're the licence obligation and the §2.5 ethos.
11. **Social layer expectations.** Handle-only discovery + friends-only sharing (DB-enforced) is a
    small, safe surface. There's **no block/report** yet (`docs/backend.md` §6.10 flags this before
    opening to strangers). Fine for a known group; know it's there.

---

## Suggested sequence (if/when you greenlight)

1. **Rate-limit safety (Q3):** set `WIKI_USER_AGENT` + `ARTIC_USER_AGENT` in Vercel, then add proxy
   caching (CDN headers first, shared cache if needed). Verify throttling doesn't trip under a
   two-browser concurrent test.
2. **Email (Q1):** Resend domain + SMTP, Confirm-email ON, branded Confirm/Reset templates, then run
   the full signup/confirm/reset E2E once with a fresh address.
3. **Trust basics (Q4):** delete-account path + a short "what we store" note + a feedback link.
4. **Optional polish:** custom domain wired through Vercel + Supabase; decide open vs invite signup;
   consider Supabase Pro for no-pause + backups.

Each is independently shippable and testable per the working agreement (CLAUDE.md §8). None touches
the core loop or the anti-slot-machine principles.
