// Colour maths for accessibility: WCAG 2.2 contrast, plus the OKLCH conversions
// used to derive one colour from another without drifting off its hue.
//
// Two callers, both of which need the same primitives and must not disagree:
//   • `contrast.test.ts` — the palette's conformance contract (globals.css).
//   • `tiles.ts` / `PaperCover` — deriving a dark-theme face from an authored
//     light tint, where the derived colour has to CLEAR a contrast bar.
//
// Pure and DOM-free, so it unit-tests in the default node environment like the
// rest of `src/lib` (CLAUDE.md §8.5).
//
// ⚠️ WCAG 2.x contrast is defined on **sRGB relative luminance**, NOT on any
// perceptual lightness. OKLCH is used here only to MOVE a colour (keep its hue,
// change its lightness); whether the result passes is always re-checked with
// `contrastRatio`. Never substitute OKLCH L for a contrast check — they disagree,
// and the disagreement is exactly where accessibility bugs hide.

export type RGB = [number, number, number];

/** `#rgb` / `#rrggbb` → 8-bit channels. Throws on anything else, so a typo in a
 *  palette constant fails loudly in a test rather than silently rendering black. */
export function parseHex(hex: string): RGB {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`bad hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

/** 8-bit channels → `#rrggbb`, clamped and rounded. */
export function toHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** sRGB transfer function and its inverse (gamma ⇄ linear light). */
const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1..21. Order-independent. */
export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Flatten a translucent foreground onto an opaque background.
 *
 * Tailwind's `/NN` opacity modifiers (`text-ink/60`, `border-accent/35`) are the
 * single biggest source of contrast surprises in this codebase: the token itself
 * passes, and the modified version quietly does not. Contrast is only defined
 * between opaque colours, so anything with a `/NN` has to come through here
 * first.
 */
export function compositeOver(fg: RGB, bg: RGB, alpha: number): RGB {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as RGB;
}

/** Contrast between two hex colours, with an optional foreground alpha. */
export function ratio(fgHex: string, bgHex: string, alpha = 1): number {
  const bg = parseHex(bgHex);
  const fg = alpha === 1 ? parseHex(fgHex) : compositeOver(parseHex(fgHex), bg, alpha);
  return contrastRatio(fg, bg);
}

/** CSS `color-mix(in srgb, a P%, b)`, so a derived colour can be checked here
 *  and rendered there without the two drifting apart. */
export function mixSrgb(aHex: string, bHex: string, portion: number): RGB {
  const [a, b] = [parseHex(aHex), parseHex(bHex)];
  return a.map((v, i) => v * portion + b[i] * (1 - portion)) as RGB;
}

// ---------------------------------------------------------------------------
// WCAG 2.2 thresholds.
// ---------------------------------------------------------------------------

/** 1.4.3 Contrast (Minimum), normal text. */
export const AA_TEXT = 4.5;
/** 1.4.3, large text: ≥24px, or ≥18.66px (14pt) bold. */
export const AA_LARGE_TEXT = 3;
/** 1.4.11 Non-text Contrast: UI component boundaries/states, meaningful graphics. */
export const AA_NON_TEXT = 3;
/** 1.4.6 Contrast (Enhanced). Not our target; body prose clears it anyway. */
export const AAA_TEXT = 7;

/** Does this size count as "large text" under 1.4.3? */
export function isLargeText(pxSize: number, bold = false): boolean {
  return bold ? pxSize >= 18.66 : pxSize >= 24;
}

// ---------------------------------------------------------------------------
// OKLCH — for MOVING a colour, never for judging it.
//
// Used to derive a dark-theme face from an authored light tint: keep the hue the
// designer chose, retarget the lightness, damp the chroma. Doing the same thing
// by mixing toward the dark paper tone (the old `color-mix` approach) collapses
// the hue differences that keep 28 neighbouring tiles distinguishable.
// ---------------------------------------------------------------------------

export type Oklab = { L: number; a: number; b: number };

export function toOklab(rgb: RGB): Oklab {
  const [r, g, b] = rgb.map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Inverse of `toOklab`. Clamps into sRGB gamut, so extreme L/chroma pairs give
 *  the nearest representable colour rather than an out-of-range channel. */
export function fromOklab({ L, a, b }: Oklab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.max(0, Math.min(255, toGamma(c) * 255))) as RGB;
}

/**
 * Re-light a colour: hold its hue, set a new OKLCH lightness, scale its chroma.
 *
 * `chromaScale` below 1 keeps a re-lit tint inside the "quiet reading room"
 * (§6) instead of turning it neon once it is dark enough to carry cream text.
 */
export function relight(hex: string, L: number, chromaScale = 1): string {
  const { a, b } = toOklab(parseHex(hex));
  return toHex(fromOklab({ L, a: a * chromaScale, b: b * chromaScale }));
}
