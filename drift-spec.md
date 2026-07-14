# Drift — Product & Build Specification (v1, local hobby edition)

A local, single-user web app for "healthy scrolling": a feed of beautiful knowledge cards where **you are the algorithm**. Instead of an opaque recommendation engine deciding what comes next, every card offers visible "threads" you can pull to steer your own rabbit hole. Sessions end with a shareable **trail map** of where your curiosity wandered.

This spec is written to be handed to Claude Code. It defines scope, mechanics, content pipeline, data model, UI, and a build order.

---

## 1. Core concept in one paragraph

You open Drift and either pick a topic seed from the homepage or hit "Surprise me." You get a full-screen card: an image, a title, and a 2–3 sentence hook drawn from Wikipedia. At the bottom of the card are 2–3 **thread chips** — related directions you could take ("Ancient computing", "Shipwreck archaeology", "How gears work"). Tap a thread and the next card follows that direction. Swipe/scroll past without choosing and you drift semi-randomly. Every card you visit is recorded as a node in your **trail**. When you end the session, you see your trail map — a visual chain of your journey — which you can name, save, and export as an image to send to friends.

## 2. Design principles (the anti-slot-machine rules)

These are product constraints, not nice-to-haves. They are the reason Drift exists:

1. **Transparency over opacity.** The user always sees *why* the next card appeared (the thread they chose, or "drift" if random). No hidden ranking.
2. **Agency over autoplay.** Nothing advances automatically. No videos that autoplay, no infinite preloading animations that tease "just one more."
3. **Sessions have shape.** A session has a beginning (topic seed), a middle (the trail), and an end (the trail map). The trail map is the *reward for stopping* — the app's dopamine is placed at the exit, not the next swipe.
4. **Gentle awareness, not guilt.** A small unobtrusive counter shows cards visited this session (e.g. "12 stops"). After ~25 cards, a soft inline card appears: "You've wandered far — want to see your trail?" It is dismissible and never blocks.
5. **Content is vetted, AI only reshapes.** All content originates from Wikipedia/Wikimedia. If AI is used, it summarizes, labels, and curates — it never invents facts.

## 3. v1 scope

**In:**
- Homepage with curated topic seeds + "Surprise me"
- The Drift feed (cards, swiping, thread chips)
- Expandable card ("read more" → longer extract + link to full article)
- Trail tracking and the trail map screen
- Save/like trails; a local "My Trails" page
- Local persistence (no accounts)
- AI enhancement layer via **local Ollama models** (see §6) — still behind a feature flag with graceful fallback, so the app keeps working even when Ollama isn't running

**Out (explicitly, for later):**
- User accounts, friends, social features, comments
- Mobile app packaging
- Non-Wikipedia sources (arXiv, Our World in Data, good-news feeds)
- Recommendation/personalization models

## 4. Tech stack

- **Next.js (App Router) + React + TypeScript** — one project; API routes act as a thin server-side proxy to the local Ollama server (avoids browser CORS issues with `localhost:11434` and keeps all AI logic in one place). Run with `npm run dev`, open `localhost:3000`.
- **Tailwind CSS** for styling, **framer-motion** for card transitions/swipe gestures.
- **Persistence: IndexedDB via `localforage`** (trails can grow; localStorage's 5MB limit is avoidable pain). Simple key-value: `trails`, `settings`, `seen-pages`.
- **No database, no auth, no deployment.** Local only.
- Trail map rendering: plain **SVG** built in React (no d3 needed for v1 — trails are mostly linear chains with occasional labeled edges).
- Trail export: render the SVG to PNG client-side (canvas serialization or `html-to-image`).

## 5. Content pipeline (Wikipedia — free, no key, CORS-friendly)

All from the Wikimedia REST API (`https://en.wikipedia.org/api/rest_v1/...`):

| Need | Endpoint |
|---|---|
| Random card | `GET /page/random/summary` |
| Specific card | `GET /page/summary/{title}` — returns title, description, extract, thumbnail, original image, canonical URL |
| **Threads** | `GET /page/related/{title}` — returns ~20 related pages with their own summaries/thumbnails. **This endpoint is the heart of the app.** |

Practical notes for the implementation:
- Always set a descriptive `User-Agent`/`Api-User-Agent` header per Wikimedia etiquette.
- Filter junk: skip pages with no extract, no thumbnail (configurable — maybe allow ~20% imageless cards so text-only gems aren't lost), disambiguation pages (`type: "disambiguation"`), and list articles (`title` starting with "List of") unless the user explicitly threads into one.
- Keep a session-level `seenPages` set to avoid repeats; persist a longer-term seen list with decay (e.g. cap at 500 titles, FIFO) so re-visits are possible eventually.
- Prefetch: when a card is shown, fetch its related pages immediately in the background so thread taps feel instant. Prefetch at most 1 card ahead — deliberately do NOT build a deep preloaded queue (see design principle 2).
- **Topic seeds (homepage):** a hand-curated JSON file of ~12 seed collections, each a list of 10–20 strong Wikipedia titles. Example seeds: Space, Deep Ocean, Ancient Worlds, How Things Work, Mathematics, Human Body, Lost & Found (archaeology/mysteries), Animal Kingdom, Art & Artists, Language, Inventions & Accidents, Earth's Extremes. "Surprise me" = random endpoint.

## 6. Thread generation

**Without AI (default, always works):**
1. Fetch `/page/related/{title}` for the current card.
2. Filter out seen pages and junk (as above).
3. Pick 3 that are *diverse from each other*: simple heuristic — score candidates by dissimilarity of their `description` fields (e.g. avoid picking three biographies; use the `description` string's first noun/category word as a crude class) and pick greedily.
4. Thread chip label = the related page's short `description` if present and < 40 chars, else the page title.

**With AI (feature flag `AI_THREADS=true`, powered by local Ollama at `http://localhost:11434`):**

*Model recommendations (from the locally available models):*
- **LLM default: `qwen2.5:14b`.** The task is deliberately light — pick 3 titles from ~20 candidates and write a 2–5 word label for each, as JSON. A 14B model handles this easily, and **latency is the real constraint**: thread generation runs for every card and should finish within the prefetch window (~1–3 s) so chips appear instantly. The 27B/32B models are overkill here and their extra seconds per card would be felt constantly.
- **Optional "quality mode": `gemma3:27b`** behind a config setting (`OLLAMA_MODEL` in `.env.local`), for experimenting with whether bigger models write noticeably better thread labels. Fun to A/B against 14b, not the default.
- **Embeddings: `nomic-embed-text`.** This is a genuinely valuable addition the local setup unlocks: embed the `title + description` of all ~20 related candidates, then pick 3 that are maximally distant from each other (greedy max-min cosine distance). This replaces the crude "description dissimilarity" heuristic in the non-AI path too, is near-instant (274 MB model), and guarantees diverse threads (no three biographies in a row). Pipeline: embeddings pick a diverse shortlist of ~6 → LLM picks the final 3 and writes labels.

*Implementation:*
- Next.js API route `POST /api/threads` → calls Ollama `POST /api/chat` with `format: "json"` (or a structured-output JSON schema) and `keep_alive: "30m"` so the model stays loaded between cards. Prompt: *"Here is the article a curious reader is on (title + extract) and N candidate next articles. Pick the 3 most intriguing and mutually diverse next steps. For each, return the exact candidate title and a 2–5 word evocative thread label. Respond ONLY with JSON: [{"title": ..., "label": ...}]"*. Validate that returned titles exactly match candidates; drop any that don't.
- Embeddings via Ollama `POST /api/embed` with `model: "nomic-embed-text"`.
- Optional second flag `AI_REWRITE=true`: rewrite the card extract into a punchier 2-sentence hook. Keep this **off by default** — smaller local models are more prone to drifting from the source text, and Wikipedia extracts are already decent. If enabled, always keep the "From Wikipedia →" link and instruct the model to only rephrase, never add facts.
- Cache all AI results in IndexedDB keyed by page title + model name, so repeat visits cost nothing.
- Graceful fallback: Ollama unreachable, timeout (>6 s), or malformed JSON → silently fall back to the embedding-only heuristic (or plain heuristic if embeddings also fail). The app must never visibly break because Ollama isn't running.

## 7. Data model

```ts
type Card = {
  pageTitle: string;        // canonical Wikipedia title (unique id)
  displayTitle: string;
  description?: string;     // Wikipedia short description
  extract: string;          // 2–3 sentence summary
  longExtract?: string;     // fetched lazily on "read more"
  imageUrl?: string;
  sourceUrl: string;        // canonical Wikipedia URL
};

type TrailStep = {
  card: Card;
  arrivedVia: { type: "seed"; seedName: string }
            | { type: "thread"; label: string; fromTitle: string }
            | { type: "drift" };            // swiped past without choosing
  timestamp: number;
  dwellMs?: number;         // rough time on card (nice for the trail map)
  expanded: boolean;        // did they open "read more"?
};

type Trail = {
  id: string;               // uuid
  name: string;             // user-editable; default auto: "Pasta shapes → Naval warfare"
  steps: TrailStep[];
  createdAt: number;
  liked: boolean;
};
```

Auto-name suggestion: `firstCard → lastCard` (first and last step titles).

## 8. Screens & UX

### 8.1 Homepage
- App name + one-line tagline ("Pull a thread. See where it goes.")
- Grid of topic seed tiles (image + name), plus a prominent **"Surprise me"** tile.
- Link to **My Trails**.
- Small stat line if trails exist: "You've saved 4 trails · 87 stops wandered."

### 8.2 Drift feed (the core)
- One full-screen card at a time, vertically swipeable (wheel/trackpad scroll, arrow keys, touch swipe, and visible next/prev affordance for mouse users).
- **Layout: full-screen desktop-first** — on wide screens the card uses the whole viewport (image as a large panel on the left or full-bleed behind a legibility gradient, text and threads on the right/lower third). Build it responsive with standard Tailwind breakpoints so it collapses naturally into a vertical phone-style card later — no separate mobile design needed now.
- Card anatomy, top to bottom:
  - Image (full-bleed, gradient overlay for text legibility)
  - Title + short description
  - 2–3 sentence extract
  - **"Read more" toggle** → expands to a longer extract (fetch the article's lead section via the mobile-sections or extracts API) + "Open full article ↗" link
  - **Thread chips row**: 2–3 chips, each labeled, visually distinct (e.g. small thread/yarn icon). Tapping a chip animates the card sliding away in that "direction" and the chosen label briefly floats as a transition ("Following: Ancient computing…").
- Swiping without choosing a thread = drift (semi-random next card, weighted ~50% toward one of the untapped threads and ~50% fully random — feels organic, still surprising).
- Persistent, quiet UI chrome: back-to-home button, session stop counter ("12 stops"), **"End & view trail"** button. A tiny breadcrumb of the last 3 stops (dots with tooltips) hints at the growing trail.
- Going *back* (swipe down / up-arrow) revisits previous cards in the trail — read-only, doesn't duplicate steps.

### 8.3 Trail map
- Shown when the user taps "End & view trail" (and reachable later from My Trails).
- Rendering: a vertical (or gently meandering) SVG path. Each stop = a node: small circular thumbnail + title. Each edge is labeled with how you traveled: the thread label, or a dotted line for "drift." Stops where the user tapped "read more" get a subtle glow/badge.
- Header: auto-generated name (editable), date, stats ("14 stops · 21 min · 3 threads pulled").
- Actions: **Save trail**, **♥ Like**, **Export as image** (PNG download), **Copy as text** (a nicely formatted text version with links, e.g. for pasting in a chat: `🧵 Pasta shapes → … → Naval warfare (14 stops)` plus the list of links).
- A "Continue this trail" button reopens the feed from the last card.

### 8.4 My Trails (the local "profile")
- List/grid of saved trails: name, date, mini-preview of the path (tiny sparkline-like version of the trail SVG), stop count, liked-heart.
- Tap → full trail map view. From there: continue, rename, export, delete.
- Filter: All / Liked.

## 9. Look & feel (defaults — adjust per founder taste)

- Direction: **calm, clean, and inviting — "a quiet reading room."** Default theme is a warm off-white paper tone (soft cream, not stark white) with ink-dark text and one muted accent color (sage green or dusty blue) used sparingly for thread chips and links. Generous whitespace, soft rounded corners, gentle shadows.
- Typography: a warm serif display font for card titles (e.g. Fraunces or Newsreader) paired with a clean sans for body text (Inter). Slightly generous line-height for relaxed reading.
- A **"night library" dark mode toggle** (deep warm gray, not pure black) for late-evening sessions — likely when the app gets used most.
- Motion: smooth, physical card transitions (framer-motion springs); the thread-following transition should feel like being *pulled* sideways/diagonally, distinct from the neutral vertical drift swipe.
- No red badges, no notification patterns, no streak flames. The visual language of the app should feel like the opposite of a casino: a quiet library with very good lighting.

## 10. Build order for Claude Code (milestones)

Each milestone is independently testable — stop and play after each one.

- **M1 — Walking skeleton:** Next.js app, Drift feed showing random Wikipedia summary cards, swipe navigation, junk filtering, seen-set. No threads yet.
- **M2 — Threads:** related-pages fetch, heuristic thread selection + chip UI, thread-tap navigation, drift weighting, prefetch of the next card.
- **M3 — Trails:** trail recording (steps + arrivedVia + dwell), End & view trail, SVG trail map, auto-naming.
- **M4 — Persistence & My Trails:** localforage storage, save/like/rename/delete, My Trails page, continue-a-trail.
- **M5 — Homepage & polish:** topic seeds JSON + homepage grid, "Surprise me," read-more expansion, export-as-PNG and copy-as-text, session counter + gentle 25-card nudge, keyboard shortcuts.
- **M6 — AI layer (Ollama):** `/api/threads` route proxying to local Ollama; embedding-based diversity shortlisting (`nomic-embed-text`); LLM thread curation + labels (`qwen2.5:14b` default, model configurable via `.env.local`); JSON validation, result caching, and silent fallback to the heuristic when Ollama is down or slow.

## 11. Success criteria for the experiment (the actual point)

After a week of personal use, the questions to answer:
1. Do I actually reach for Drift at the moments I'd normally open Instagram/YouTube?
2. Does pulling threads feel *better* than being fed — or do I miss the opacity?
3. Do sessions end naturally, and does the trail map feel like a reward?
4. Did I learn things I remember two days later?

Instrument lightly for this: store per-session stats (start time, stops, threads pulled vs drifts, duration) in IndexedDB and show a simple personal stats view on My Trails ("this week: 5 sessions, avg 11 min").

## 12. Stretch ideas (parking lot, not v1)

- Additional sources: arXiv abstracts, Our World in Data charts, public-domain archives, good-news wire.
- "Trail seeds from friends": import a shared trail text and start from its last stop.
- Weekly digest: "your best trail this week."
- Wikipedia pageviews API to optionally bias drift toward under-visited gems ("off the beaten path" mode).
- Spaced resurfacing: occasionally drift back to a card from a previous trail ("Remember this?").
