# Drift flyer brief (for Claude Design)

A one-page brand + creative brief to attach in Claude Design so the flyer matches
the real product. Everything below is pulled from the live app (`globals.css`
tokens, the fonts, the landing and About pages).

---

## 1. What Drift is (so the copy stays true)

Drift is a calm, full-screen feed of "knowledge cards" (Wikipedia articles and
public-domain artworks) where **you are the algorithm**. Every card shows visible
"threads" you pull to steer your own path. Nothing autoplays, nothing is a hidden
ranking, and every session ends with a small **map of where your curiosity
wandered**. It is deliberately the opposite of a doomscroll feed. It runs at
**usedrift.org** and installs to your home screen like an app.

Tone: warm, calm, literary, quietly confident. The opposite of a casino. Never
shouty, never hypey.

**Do not claim "ad-free" or "no ads"** (the site is adding optional ads). Say what
is true: no autoplay, no hidden ranking, no endless feed, you are in control.

---

## 2. Design system (match this exactly)

### Colors (light theme, use these for the flyer)

| Role | Hex | Use |
| --- | --- | --- |
| Paper (background) | `#f5efe4` | The whole flyer background. Soft warm cream, never stark white. |
| Paper raised (cards) | `#fbf7ef` | Any raised card / step panel sitting on the paper. |
| Ink (text) | `#2b2723` | Headlines and body. Warm near-black, never pure black. |
| Ink soft (secondary) | `#6f665b` | Subtitles, captions, footer. Muted warm gray. |
| Accent (sage) | `#6f8f74` | Sparingly: the sprig, chip fills, small accents. |
| Accent strong (sage) | `#4f6d55` | Links, the step numbers, small emphasis on paper. |
| Line (hairline) | `#e4dbcb` | 1px borders and dividers. |

One accent only (sage green), used sparingly. This is a "quiet reading room," so
let the cream and generous whitespace do most of the work.

(Dark theme, for reference only, do NOT use for the flyer: paper `#1b1917`, ink
`#ece4d6`, accent `#86a98c` / `#a9c6ad`.)

### Typography

- **Display / headlines: Fraunces** (a warm serif). This carries the personality.
  Use it for the big catchphrase and section titles. If Fraunces is unavailable,
  Newsreader or another warm high-contrast serif is a close substitute.
- **Body / steps / footer: Inter** (clean sans). Generous line-height.
- Never use a generic system font for the headline. The serif is the brand.

### Look and feel

- Generous whitespace and calm rhythm. Let it breathe; do not fill every corner.
- **Soft rounded corners** (about 16px radius on cards / the QR panel).
- **Gentle, warm shadows** only (e.g. a soft `rgba(43,39,35,0.12)` drop), never harsh.
- Hairline `#e4dbcb` borders instead of heavy rules.
- A single sage botanical touch is on-brand (the logo already has a sprig; do not
  add clip-art or stock imagery). Optional: one small piece of public-domain line
  art or a faint card motif, kept very subtle.

### Component patterns (reuse these shapes)

- **Chips / pills**: fully rounded, sage fill at ~10% opacity, sage-strong text, a
  faint sage ring. This is the app's "thread" look.
- **Step badges**: a small circle, sage at ~12% opacity, with a sage-strong serif
  number inside.
- **Cards / panels**: `#fbf7ef` fill, 1px `#e4dbcb` border, ~16px radius, soft shadow.

### Logo usage

- Use the **wordmark** ("Drift" with the sage sprig) as the primary mark, near the
  top. It is ink + sage on transparent, so it sits on the cream perfectly.
- Do not recolor, add effects to, or stretch the logo. The sprig is part of it.
- The **monogram** (the "D" with a sprig) is an optional small accent (e.g. tiny in
  the footer). Do not use both large.

---

## 3. Flyer specification

- **Format:** A6 **portrait**, **105 x 148 mm**. For print export use **300 DPI =
  1240 x 1748 px**. Add 3mm bleed if exporting a print PDF.
- **Audience:** university / college students, dropped in mailboxes and handed out.
- **Goal:** get them to scan the QR, create a free account, install it, and try it.
- **One clear message.** Limited space is fine. Do not crowd it.

### Content blocks (top to bottom)

1. **Logo** (Drift wordmark), small, top.
2. **Catchphrase headline** (Fraunces, large, ink). Pick one; my lead suggestion is
   the first. Options:
   - "Done with the doomscroll?"
   - "Done with social media?"
   - "Tired of being fed?"
   - "Scroll less. Wonder more."
3. **Subhead** (one calm line): "Drift is scrolling that leaves you curious, not
   numb." (or the real tagline: "Pull a thread. See where it goes.")
4. **One short value line** (Inter, ink-soft): "A calm feed of full-screen knowledge
   cards where you are the algorithm. No autoplay, no hidden ranking. You choose
   every step, and each session ends with a map of where your curiosity wandered."
5. **How to start (4 steps)** with sage step badges:
   1. **Scan the code** (or visit usedrift.org)
   2. **Create a free account**
   3. **Add it to your home screen** (tap Share, then "Add to Home Screen")
   4. **Pull a thread and drift**
6. **QR panel** (see below).
7. **Footer**: `usedrift.org` in sage-strong, plus a quiet line: "A calm corner of
   the internet, for the curious."

### QR code placeholder (important)

- **Do not generate a real/scannable QR** (I will drop the real one in later). Instead
  reserve a clean **placeholder**: a `#fbf7ef` rounded square, ~**32 x 32 mm**, 1px
  sage or hairline border, centered, labeled "QR" or "scan me" faintly inside, with a
  small caption under it: "Scan to start." Keep clear space around it so a QR will scan.
- Also print the URL **usedrift.org** as text near the QR, as a fallback.

### Copy rules

- **No em dashes or en dashes** anywhere in the copy. Use periods, commas, colons,
  parentheses. (Compound hyphens like "full-screen" are fine.)
- Keep it calm and short. British/US spelling is fine, just be consistent.

---

## 4. Output / export

- **Primary: export to Canva** (Claude Design's Export menu has a Canva handoff), so
  I can drop the real QR code into the reserved placeholder there.
- Also give me a **print-ready PDF** at A6, 300 DPI (with 3mm bleed if possible), and
  a **PNG** at 300 DPI.
- A standalone HTML version is a nice bonus but not required.
- Because the QR goes in later, make the QR placeholder its own clearly separated
  element that is easy to select and replace in Canva.

---

## 5. Assets and references to feed Claude Design

- **Logos to upload** (from this repo, both ink-on-transparent, for the light flyer):
  - `public/brand/drift-logo.png` (wordmark, primary)
  - `public/brand/drift-monogram.png` (the "D" mark, optional small accent)
  - (The `...-reversed.png` versions are for dark backgrounds. Do not use them here.)
- **Web-capture / visit these live pages** to match the real look and voice:
  - `https://www.usedrift.org` (landing: hero, colors, type, the calm feel)
  - `https://www.usedrift.org/about` (voice, the reading-room palette)
  - `https://www.usedrift.org/install` (exact wording of the install steps)
