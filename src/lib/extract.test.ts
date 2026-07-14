import { describe, it, expect } from "vitest";
import { topParagraphs } from "./extract";

// A realistic full-plaintext extract (exsectionformat=wiki): a lead, then
// section headings interleaved with body paragraphs.
const SAMPLE = [
  "Lead paragraph one.",
  "Lead paragraph two.",
  "",
  "== Etymology ==",
  "Etymology paragraph.",
  "",
  "== History ==",
  "History paragraph one.",
  "History paragraph two.",
  "=== A subsection ===",
  "Subsection paragraph.",
].join("\n");

describe("topParagraphs", () => {
  it("drops == heading == markup and blank lines, keeps prose in order", () => {
    const { text } = topParagraphs(SAMPLE, { maxParagraphs: 10 });
    const paras = text.split("\n\n");
    expect(paras).toEqual([
      "Lead paragraph one.",
      "Lead paragraph two.",
      "Etymology paragraph.",
      "History paragraph one.",
      "History paragraph two.",
      "Subsection paragraph.",
    ]);
    expect(text).not.toContain("==");
  });

  it("caps at maxParagraphs and reports hasMore", () => {
    const { text, hasMore } = topParagraphs(SAMPLE, { maxParagraphs: 3 });
    expect(text.split("\n\n")).toHaveLength(3);
    expect(hasMore).toBe(true);
  });

  it("caps at maxChars (whole paragraphs) and reports hasMore", () => {
    const big = ["a".repeat(200), "b".repeat(200), "c".repeat(200)].join("\n");
    const { text, hasMore } = topParagraphs(big, {
      maxParagraphs: 10,
      maxChars: 250,
    });
    // First paragraph (200) fits; adding a second would start past the cap.
    expect(text.split("\n\n")).toHaveLength(2);
    expect(hasMore).toBe(true);
  });

  it("returns everything with hasMore=false when nothing is left", () => {
    const { text, hasMore } = topParagraphs(SAMPLE, { maxParagraphs: 50 });
    expect(text.split("\n\n")).toHaveLength(6);
    expect(hasMore).toBe(false);
  });

  it("handles a stub (single short paragraph)", () => {
    const { text, hasMore } = topParagraphs("Just one line.");
    expect(text).toBe("Just one line.");
    expect(hasMore).toBe(false);
  });

  it("handles empty / heading-only input", () => {
    expect(topParagraphs("")).toEqual({ text: "", hasMore: false });
    expect(topParagraphs("== Only a heading ==\n\n")).toEqual({
      text: "",
      hasMore: false,
    });
  });

  it("strips stray RS/US control chars if present", () => {
    const { text } = topParagraphs("\x1e2\x1fEtymology\nBody paragraph.");
    // The control-char line collapses to 'Etymology' text (harmless), body kept.
    expect(text).toContain("Body paragraph.");
    expect(text).not.toMatch(/[\x1e\x1f]/);
  });
});
