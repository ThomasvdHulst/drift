// The two faces of a start tile: how one authored tint renders in each theme.
//
// Every tile grid in the app (the 28 field cards in `topics.ts`, the 10 news
// sections in `current.ts`, the 10 art forms in `artic.forms.ts`, the 12 arXiv
// categories in `arxiv.categories.ts`) carries ONE authored `tint`. This module
// is the single place that decides what that tint actually looks like.
//
// ── Why the dark face is derived rather than mixed ──────────────────────────
//
// The tints were authored as pale washes on cream, and rendered with
// `color-mix(in srgb, tint 45%, var(--paper-raised))`. On the dark paper tone
// that same mix lands a pale pastel halfway onto near-black, producing a
// saturated MID-tone: the 2026-07-28 contrast audit measured the tile label at
// 3.42:1 and the blurb at 2.22:1 against it, both failing WCAG 1.4.3 AA.
//
// Lowering the mix percentage cannot fix it. Contrast improves as the face gets
// darker, but the faces converge on the paper tone as they do, and the tiles
// stop being distinguishable FROM EACH OTHER — which `tile-contrast.testkit.ts`
// independently requires (MIN_NEIGHBOUR_DELTA_E). There is no percentage where
// both hold: at 30% the blurb still fails, and by the time the blurb passes
// (10%) neighbouring tiles are 1.5 ΔE apart, i.e. the same colour to an eye.
//
// Re-lighting in OKLCH escapes the trade entirely. Keeping the authored hue and
// simply moving the lightness produces a deep tone that carries cream text
// (label 9.17:1, blurb 5.94:1) while PRESERVING the hue differences that keep 28
// neighbours apart (ΔE 6.38, better separation than the light grid has). The
// chroma is damped so a tint deep enough to read on does not turn neon, which
// would break the "quiet reading room" (CLAUDE.md §6).

import { relight } from "./contrast";

/** OKLCH lightness of a dark-theme tile face. Chosen as the deepest value that
 *  still reads as a tinted card rather than a black rectangle; every text bar is
 *  cleared with room to spare, so copy changes cannot silently break it. */
export const DARK_TILE_L = 0.34;

/** How much of the authored chroma survives the re-light. Full chroma at this
 *  lightness reads as saturated colour blocks, which is the opposite of §6. */
export const DARK_TILE_CHROMA = 0.55;

/** Portion of the authored tint in the light face, over `--paper-raised`. */
export const LIGHT_TILE_MIX = 0.45;

/**
 * The light-theme face, as a CSS `color-mix()` that resolves at render time.
 *
 * Left as CSS rather than a computed hex so it keeps reading the live
 * `--paper-raised`: the light grid is unchanged by this module, and retuning the
 * paper tone still flows through exactly as it did before.
 */
export function tileFaceLight(tint: string): string {
  return `color-mix(in srgb, ${tint} ${LIGHT_TILE_MIX * 100}%, var(--paper-raised))`;
}

/**
 * The dark-theme face: the same authored hue, re-lit to carry cream text.
 *
 * Returns a plain hex, because it is derived from the tint alone and does not
 * depend on the paper tone.
 */
export function tileFaceDark(tint: string): string {
  return relight(tint, DARK_TILE_L, DARK_TILE_CHROMA);
}

// ---------------------------------------------------------------------------
// The Papers cover label (Phase 17), same problem in miniature.
//
// `PaperCover` draws a category chip in the discipline's own `hue`, on a
// background made of that same hue at low alpha. Text and backdrop being the
// same colour is exactly the shape of a contrast failure: the audit measured all
// nine disciplines between 2.46:1 and 3.64:1, in both themes.
//
// The chip keeps its hue (that is the whole point of the cover), so the fix is
// to re-light the LABEL away from its backdrop: darker in light mode, lighter in
// dark. Chroma is kept at full here, unlike the tile faces — the chip is a small
// accent on a quiet cover, so its colour should stay legible as the discipline's
// colour.
// ---------------------------------------------------------------------------

/** OKLCH lightness targets for the cover label. Each clears 4.5:1 against the
 *  chip's own backdrop for all nine hues with headroom; `arxiv.categories.test`
 *  holds them there. */
export const COVER_LABEL_L = { light: 0.44, dark: 0.78 } as const;

/** The cover label colour for one theme, derived from the discipline's hue. */
export function coverLabelColor(hue: string, theme: "light" | "dark"): string {
  return relight(hue, COVER_LABEL_L[theme], 1);
}
