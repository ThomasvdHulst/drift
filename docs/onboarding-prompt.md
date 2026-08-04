# Starting a session on Drift

Paste this whole file as the first message of a new AI session (or point the assistant at it:
"read `docs/onboarding-prompt.md` first"). It is written to stay true as features come and go:
it says what Drift **is**, where the truth about it **lives**, and how work here is **done**.
It does not list features, because that list changes every week and `plan.md` already keeps it.

---

## 1. What Drift is

Drift is a calm, local-first web app for **healthy scrolling** — a deliberate antidote to
doomscroll feeds. It is a feed of full-screen "knowledge cards" where **the reader is the
algorithm**: every card shows visible **threads** (related directions) you pull to steer your own
rabbit hole, and nothing advances on its own. A session has a beginning (a seed), a middle (the
trail) and an end (a shareable **trail map**), so the reward sits at the exit rather than at the
next swipe.

Content is **vetted human knowledge from openly-licensed sources**, organised into **realms**
(rooms you read in). It runs locally with `npm run dev`, persists in the browser (IndexedDB),
**optionally** syncs to a cloud backend when configured, and is deployed as a small beta.

It is one person's project, read by a handful of people. Treat "calm, honest and finished" as
worth more than "more".

## 2. The principles that bind every change

`CLAUDE.md §2` holds the **anti-slot-machine principles**. Read them there, in full, before
proposing anything. In short: the reader always sees *why* a card appeared; nothing autoplays or
pre-loads to tease; sessions have a shape; awareness is gentle, never guilt; and AI may reshape
vetted content but must never invent facts.

They are **hard product constraints, not preferences**. If a change would be easier without one,
the change is wrong, not the principle. A feature that is technically correct and quietly
dishonest with the reader (a banner promising something the feed is not doing, a control that is
hidden rather than made to work) is a bug here.

## 3. Read these, in this order

1. **`CLAUDE.md`** — the working rules. Non-negotiable. Pay attention to:
   - **§2** the principles above;
   - **§4** hard-won API facts and the graceful-degradation contract (which upstream endpoints are
     dead and what replaced them; why external calls are proxied through our own API routes; which
     dependencies are optional and must never break the core loop when absent);
   - **§5** content filtering, **§6** look and feel, **§7** the commands;
   - **§8** the **working agreement** — how you must behave. It governs everything below.
   - **§10** the colour-contrast rules (WCAG 2.2 AA) and the two gates that check them.
2. **`plan.md`** — the **living progress tracker and source of truth for where we are**. Read the
   "Current status" block at the top first, then skim the newest entries at the bottom. Every
   shipped phase and every bug fix has an entry explaining *why*, not just *what*.
3. **`docs/`** — the standing references (deployment and env vars, the backend and auth model,
   scaling and beta readiness, compliance, and what is left for a human to do). Open the one your
   task touches.
4. **`drift-spec.md`** — the original product spec. Historical: later phases deliberately reopened
   some of its "never" lines, and `plan.md` records each such decision. Its §2 still binds.
5. **`src/lib/*`** — the pure, unit-tested, React- and DOM-free logic: persistence seam, card model,
   realms, threads and diversity, focused drift, and the newer modules. **This is where the real
   thinking lives.** Skim the file for the area you are touching and read its comments; they carry
   the reasons.

## 4. How the code is shaped

- **Next.js (App Router) + React + TypeScript**, Tailwind for styling, `motion` for transitions.
  Pages live in `src/app`, shared UI in `src/components`.
- **`src/lib/*` is pure logic**: small, unit-testable functions with no React, no DOM, no network.
  New logic belongs there, with tests, and the components call into it. That separation is the main
  defence against the bugs that actually happen here.
- **`src/app/api/*` is a thin server-side proxy** to external services. The browser does not call
  them directly (see `CLAUDE.md §4` for the reasons, and for the one sanctioned exception).
- **Optional dependencies degrade, never break.** Anything external — an AI runtime, the cloud
  backend, a mail sender, an anti-spam service — must leave the core reading loop fully working
  when it is unconfigured or unreachable.
- **All colour lives in `src/app/globals.css`** as tokens. There are no Tailwind palette colours in
  this codebase and it must stay that way.
- **Secrets go in `.env.local`** (git-ignored), with a committed example. Anything prefixed
  `NEXT_PUBLIC_` is public; server-only keys never get that prefix.

## 5. How to work here

From `CLAUDE.md §8`, because it is the part most often skipped:

1. **A task is not done until it is tested and the tests pass — verified, not assumed.** As
   applicable: `npm run build` clean (this is the type-check gate), `npm run lint` clean,
   `npm run test` green, and **the real screen exercised in a browser**. If you could not verify
   something, say so plainly and mark it unverified. Never report an untested step as done.
2. **Follow `plan.md`.** Work the current phase in order, tick boxes as things land, keep the
   status block accurate, and add an entry when something ships. Future sessions read that file to
   find out where things stand; leaving it stale is a real cost.
3. **Deliver one testable increment at a time and stop**, so the owner can play with it. Do not
   barrel through several milestones silently.
4. **Match the surrounding code**: its structure, its naming, and especially its **comment
   density**. Comments here explain *why*, and often name the bug that motivated the shape. Keep
   that up; it is what makes the codebase readable a month later.
5. **Stay in scope.** Do not add sources, dependencies, accounts, metrics or parking-lot ideas that
   were not asked for. Engagement-maximising metrics are never in scope.
6. **Ask before destructive or irreversible actions.** Do not commit, push, or delete what you did
   not create without being asked.
7. **Prefer plan mode for non-trivial work** and get sign-off before writing code.

## 6. Verifying in a browser

`npm run dev` serves at `localhost:3000`. The hosted app is login-gated whenever the cloud env vars
are present; `CLAUDE.md §7` shows how to launch an isolated, ungated instance for testing, and how
to run a second instance when one dev server is already up. Driving the real app with Playwright
(already a dependency) is the most reliable way to prove a flow end to end — check for the
first-run welcome modal, and remember that two cards are in the DOM during a transition.

When a change touches colour, opacity or a tinted surface, `npm run audit:contrast` measures the
**rendered** pixels of a running dev server, which is a different check from the token unit tests.

## 7. Ground rules for talking to the owner

- Say what you actually verified and what you did not. Show failing output rather than describing
  it.
- Flag a genuine problem with the request in a sentence or two, then get on with the work.
- No em dashes or en dashes as punctuation in user-facing copy (compound hyphens are fine).
- Keep explanations short and concrete. The owner knows this codebase.

---

## 8. Today

_Fill this in each session: what you want done, in your own words. Everything above is standing
context; this is the actual task._

**What I want to do today:**

<!--
Useful things to say here, when they apply:
  • the symptom, in reader's terms ("I pulled a thread and got stuck in the Gallery")
  • how to reproduce it, or where you saw it (which realm, which screen, phone or laptop)
  • whether this is a bug fix, a new feature, an experiment, or a question
  • how far to go: a quick patch, a plan first, or ship it end to end
  • anything explicitly OUT of scope for today
-->

