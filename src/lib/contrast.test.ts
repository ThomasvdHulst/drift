import { describe, expect, it } from "vitest";
import {
  AA_NON_TEXT,
  AA_TEXT,
  compositeOver,
  contrastRatio,
  fromOklab,
  isLargeText,
  parseHex,
  ratio,
  relativeLuminance,
  relight,
  toHex,
  toOklab,
} from "./contrast";
import { realmsInStylesheet, tokensFor } from "./palette.testkit";

// ---------------------------------------------------------------------------
// The palette's conformance contract.
//
// This file is the readable answer to "what is our palette ALLOWED to be". The
// tokens are read straight out of `src/app/globals.css` (see palette.testkit),
// so this binds the stylesheet that actually renders rather than a copy of it:
// retune a token there and this goes red without anyone remembering to update a
// second table.
//
// Only real pairings are asserted. The full cross-product would bury the ones
// that matter under combinations no screen ever shows.
// ---------------------------------------------------------------------------

const THEMES = ["light", "dark"] as const;
const REALMS = realmsInStylesheet();

/** Every surface a foreground can land on, in one realm/theme. */
const SURFACES = ["paper", "paperRaised"] as const;

describe("contrast maths", () => {
  it("reproduces the WCAG reference ratios", () => {
    // The two anchors from the spec: black-on-white is 21:1, identical is 1:1.
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratio("#7f7f7f", "#7f7f7f")).toBeCloseTo(1, 5);
    // A published worked example: #767676 is the lightest grey passing 4.5 on white.
    expect(ratio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("is order-independent", () => {
    expect(ratio("#2b2723", "#f5efe4")).toBeCloseTo(ratio("#f5efe4", "#2b2723"), 10);
  });

  it("parses both hex forms and rejects junk", () => {
    expect(parseHex("#abc")).toEqual(parseHex("#aabbcc"));
    expect(parseHex("f5efe4")).toEqual([245, 239, 228]);
    expect(() => parseHex("#12345")).toThrow();
    expect(() => parseHex("rebeccapurple")).toThrow();
  });

  it("flattens alpha before measuring, since contrast needs opaque colours", () => {
    const bg = parseHex("#fbf7ef");
    // alpha 1 and 0 are the two endpoints; anything between sits in order.
    expect(compositeOver(parseHex("#2b2723"), bg, 1)).toEqual(parseHex("#2b2723"));
    expect(compositeOver(parseHex("#2b2723"), bg, 0)).toEqual(bg);
    const full = ratio("#2b2723", "#fbf7ef");
    const half = ratio("#2b2723", "#fbf7ef", 0.5);
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(1);
  });

  it("classifies large text the way 1.4.3 does", () => {
    expect(isLargeText(24)).toBe(true);
    expect(isLargeText(23.9)).toBe(false);
    expect(isLargeText(18.66, true)).toBe(true);
    expect(isLargeText(18, true)).toBe(false);
  });

  it("round-trips sRGB through OKLab", () => {
    for (const hex of ["#f5efe4", "#2b2723", "#6f8f74", "#b97d59", "#000000", "#ffffff"]) {
      expect(toHex(fromOklab(toOklab(parseHex(hex))))).toBe(hex);
    }
  });

  it("relight holds the hue while moving the lightness", () => {
    const src = "#d0e7c5"; // pale green tint
    const dark = relight(src, 0.34, 0.55);
    // Lighter in, darker out.
    expect(relativeLuminance(parseHex(dark))).toBeLessThan(
      relativeLuminance(parseHex(src)),
    );
    // Still green: g stays the dominant channel.
    const [r, g, b] = parseHex(dark);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
});

describe.each(REALMS)("palette conformance — %s", (realm) => {
  describe.each(THEMES)("%s", (theme) => {
    const t = tokensFor(theme, realm);

    // -- 1.4.3 text ---------------------------------------------------------

    it.each(SURFACES)("body text (text-ink) clears AA on %s", (surface) => {
      expect(ratio(t.ink, t[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(SURFACES)("secondary text (text-ink-soft) clears AA on %s", (surface) => {
      expect(ratio(t.inkSoft, t[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(SURFACES)("link text (text-accent-strong) clears AA on %s", (surface) => {
      expect(ratio(t.accentStrong, t[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // -- 1.4.3, filled buttons ---------------------------------------------
    // ~37 primary buttons render `bg-accent text-paper-raised`, with
    // `hover:bg-accent-strong`. Both states carry the same small label, so both
    // owe the full 4.5.

    it("primary button label clears AA on bg-accent", () => {
      expect(ratio(t.paperRaised, t.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("primary button label clears AA on bg-accent-strong (the hover)", () => {
      expect(ratio(t.paperRaised, t.accentStrong)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("the hover state is visibly darker/lighter than the resting state", () => {
      // Not a WCAG rule, but if the two steps converge the hover stops reading
      // as feedback. Keep a perceptible gap.
      expect(ratio(t.accent, t.accentStrong)).toBeGreaterThanOrEqual(1.2);
    });

    it("bg-ink button label clears AA", () => {
      expect(ratio(t.paperRaised, t.ink)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // -- 1.4.11 non-text ----------------------------------------------------

    it.each(SURFACES)(
      "control boundaries (--line-strong) clear 3:1 on %s",
      (surface) => {
        expect(ratio(t.lineStrong, t[surface])).toBeGreaterThanOrEqual(AA_NON_TEXT);
      },
    );

    it.each(SURFACES)("the focus ring clears 3:1 on %s", (surface) => {
      // M-C4 draws focus with --accent-strong.
      expect(ratio(t.accentStrong, t[surface])).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it.each(SURFACES)("accent-as-graphic clears 3:1 on %s", (surface) => {
      // Trail-map strokes and accent-filled indicators are meaningful graphics.
      expect(ratio(t.accent, t[surface])).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    // -- deliberate non-requirements ---------------------------------------

    it("--line stays a soft hairline (decorative, exempt from 1.4.11)", () => {
      // Asserted so nobody 'fixes' it into --line-strong and darkens every
      // divider in the app. Decorative rules are exempt; control boundaries use
      // --line-strong instead.
      expect(ratio(t.line, t.paperRaised)).toBeLessThan(AA_NON_TEXT);
    });
  });
});

describe("alpha-modified text utilities in use", () => {
  // The `/NN` modifiers the app applies to a text token, checked flattened.
  // Anything added to a component must be added here too.
  const TEXT_ALPHAS: [string, "ink", number][] = [
    ["text-ink/85", "ink", 0.85],
    ["text-ink/80", "ink", 0.8],
    ["text-ink/75", "ink", 0.75],
  ];

  describe.each(THEMES)("%s", (theme) => {
    const t = tokensFor(theme, "encyclopedia");
    it.each(TEXT_ALPHAS)("%s clears AA on paper-raised", (_label, token, alpha) => {
      expect(ratio(t[token], t.paperRaised, alpha)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});

describe("regression guards for the 2026-07-28 audit failures", () => {
  it("the old light sage failed as a button fill; the shipped one passes", () => {
    // Measured 3.36:1 for bg-accent + text-paper-raised.
    expect(contrastRatio(parseHex("#fbf7ef"), parseHex("#6f8f74"))).toBeLessThan(AA_TEXT);
    expect(
      contrastRatio(parseHex("#fbf7ef"), parseHex(tokensFor("light", "encyclopedia").accent)),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the old gallery accent fell below even the 3:1 non-text floor", () => {
    // Measured 2.99:1 on paper.
    expect(contrastRatio(parseHex("#b97d59"), parseHex("#f5efe4"))).toBeLessThan(
      AA_NON_TEXT,
    );
    expect(
      contrastRatio(parseHex(tokensFor("light", "gallery").accent), parseHex("#f5efe4")),
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
