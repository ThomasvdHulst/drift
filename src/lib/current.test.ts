import { describe, it, expect } from "vitest";
import {
  CURRENT_SECTIONS,
  sectionById,
  sectionIdForHeading,
  dayPageTitles,
  parseCurrentEvents,
  rankCurrent,
  freshnessWord,
} from "./current";
import {
  PAPERS,
  deltaE,
  neighbourPairs,
  MIN_NEIGHBOUR_DELTA_E,
} from "./tile-contrast.testkit";

// A trimmed but otherwise verbatim slice of Portal:Current events wikitext,
// keeping every shape the parser has to survive: story-subject bullets at
// several nesting depths, prose bullets with an external ref, a File: link, a
// piped link, a section we don't track, and a bullet with no links at all.
const WIKITEXT = `{{Current events|year=2026|month=07|day=21|content=

<!-- All news items below this line -->
'''Armed conflicts and attacks'''
*[[Middle Eastern crisis (2023–present)|Middle Eastern crisis]]
**[[2026 Iran war]]
***The [[Islamic Revolutionary Guard Corps]] says that they have launched strikes on [[Amazon (company)|Amazon]]'s data center in [[Bahrain]]. [https://www.cnbc.com/2026/07/21/iran.html (CNBC)]

'''Sports'''
*[[2026 FIFA World Cup]]
**[[2026 FIFA World Cup final]]
***In [[association football]], [[Spain national football team|Spain]] beat [[Argentina national football team|Argentina]]. [https://example.com (Reuters)]
*[[File:Flag.svg]]
* A bullet with no links at all.

'''Weather and climate'''
*[[Hurricane Imelda]]
}}`;

describe("current — section registry", () => {
  it("offers every Portal:Current events section, lighter ones first", () => {
    expect(CURRENT_SECTIONS).toHaveLength(10);
    expect(CURRENT_SECTIONS[0].id).toBe("sports");
    // A calm app must not open with war (§2), but nothing is hidden either.
    expect(CURRENT_SECTIONS[CURRENT_SECTIONS.length - 1].id).toBe("armed-conflicts");
  });

  it("has unique ids, labels, glyphs, tints and headings", () => {
    for (const key of ["id", "label", "glyph", "tint"] as const) {
      const vs = CURRENT_SECTIONS.map((s) => s[key]);
      expect(new Set(vs).size, `duplicate ${key}`).toBe(vs.length);
    }
    const headings = CURRENT_SECTIONS.flatMap((s) => s.headings);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("gives every section a card face", () => {
    for (const s of CURRENT_SECTIONS) {
      expect(s.blurb.trim().length, s.label).toBeGreaterThan(0);
      expect(s.tint, s.label).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.headings.length, s.label).toBeGreaterThan(0);
      // Symbols, not emoji — the same rule the field tiles follow.
      expect([...s.glyph].length, s.label).toBe(1);
      expect(s.glyph, s.label).not.toMatch(/\p{Emoji_Presentation}/u);
      expect(s.blurb, s.label).not.toMatch(/[—–]/);
    }
  });

  it("no section card looks like any neighbour in the grid", () => {
    for (const paper of Object.values(PAPERS)) {
      for (const [a, b, gap] of neighbourPairs(CURRENT_SECTIONS)) {
        expect(
          deltaE(a.tint, b.tint, paper),
          `${a.label} vs ${b.label} (${gap} apart, ${paper})`,
        ).toBeGreaterThan(MIN_NEIGHBOUR_DELTA_E);
      }
    }
  });

  it("resolves a section by slug and rejects anything else", () => {
    expect(sectionById("sports")?.label).toBe("Sports");
    expect(sectionById("not-a-section")).toBeUndefined();
    expect(sectionById(null)).toBeUndefined();
    expect(sectionById("")).toBeUndefined();
  });

  it("matches headings loosely, and drops ones it does not track", () => {
    expect(sectionIdForHeading("Sports")).toBe("sports");
    expect(sectionIdForHeading("  ARMED CONFLICTS AND ATTACKS ")).toBe("armed-conflicts");
    // An older spelling editors used, and a punctuation variant.
    expect(sectionIdForHeading("Attacks and armed conflicts")).toBe("armed-conflicts");
    expect(sectionIdForHeading("Business & economy")).toBe("business-and-economy");
    expect(sectionIdForHeading("Weather and climate")).toBeUndefined();
  });
});

describe("current — day pages", () => {
  it("names the window most recent first, with no zero padding", () => {
    const titles = dayPageTitles(new Date("2026-07-03T09:00:00Z"), 4);
    expect(titles).toEqual([
      "Portal:Current events/2026 July 3",
      "Portal:Current events/2026 July 2",
      "Portal:Current events/2026 July 1",
      "Portal:Current events/2026 June 30",
    ]);
  });

  it("crosses a year boundary", () => {
    const titles = dayPageTitles(new Date("2026-01-01T00:30:00Z"), 2);
    expect(titles).toEqual([
      "Portal:Current events/2026 January 1",
      "Portal:Current events/2025 December 31",
    ]);
  });
});

describe("current — parsing a day page", () => {
  const entries = parseCurrentEvents(WIKITEXT, 2);

  it("keeps only links under a tracked section", () => {
    expect(new Set(entries.map((e) => e.sectionId))).toEqual(
      new Set(["armed-conflicts", "sports"]),
    );
    // "Weather and climate" is not a section we offer, so its links are dropped
    // rather than guessed into a neighbouring one.
    expect(entries.some((e) => e.title === "Hurricane Imelda")).toBe(false);
  });

  it("marks a bullet that is only a link as the story's subject", () => {
    const header = (t: string) => entries.find((e) => e.title === t)?.header;
    expect(header("2026 FIFA World Cup")).toBe(true);
    expect(header("2026 FIFA World Cup final")).toBe(true);
    expect(header("2026 Iran war")).toBe(true);
    // A piped link alone on its line is still a subject.
    expect(header("Middle Eastern crisis (2023–present)")).toBe(true);
  });

  it("marks links inside a sentence as prose, ignoring the external ref", () => {
    const header = (t: string) => entries.find((e) => e.title === t)?.header;
    expect(header("association football")).toBe(false);
    expect(header("Spain national football team")).toBe(false);
    expect(header("Islamic Revolutionary Guard Corps")).toBe(false);
    expect(header("Bahrain")).toBe(false);
  });

  it("resolves piped links to their target, not their display text", () => {
    expect(entries.some((e) => e.title === "Amazon (company)")).toBe(true);
    expect(entries.some((e) => e.title === "Amazon")).toBe(false);
  });

  it("skips File: links and bullets with no links", () => {
    expect(entries.some((e) => e.title.startsWith("File:"))).toBe(false);
    expect(entries.some((e) => /bullet with no links/.test(e.title))).toBe(false);
  });

  it("stamps every entry with the day's age", () => {
    expect(entries.every((e) => e.daysAgo === 2)).toBe(true);
  });

  it("returns nothing for wikitext with no tracked sections", () => {
    expect(parseCurrentEvents("''' Nonsense '''\n*[[Thing]]", 0)).toEqual([]);
    expect(parseCurrentEvents("", 0)).toEqual([]);
  });
});

describe("current — ranking a section's pool", () => {
  it("puts story subjects above passing mentions", () => {
    const ranked = rankCurrent(parseCurrentEvents(WIKITEXT, 0), "sports");
    expect(ranked[0].title).toBe("2026 FIFA World Cup");
    const titles = ranked.map((r) => r.title);
    expect(titles.indexOf("2026 FIFA World Cup final")).toBeLessThan(
      titles.indexOf("association football"),
    );
  });

  it("only returns the section asked for", () => {
    const all = parseCurrentEvents(WIKITEXT, 0);
    expect(rankCurrent(all, "sports").some((r) => r.title === "Bahrain")).toBe(false);
    expect(rankCurrent(all, "armed-conflicts").some((r) => r.title === "Bahrain")).toBe(
      true,
    );
    expect(rankCurrent(all, "not-a-section")).toEqual([]);
  });

  it("deduplicates across days and keeps the freshest sighting", () => {
    const entries = [
      { sectionId: "sports", title: "Ajax", header: true, daysAgo: 9 },
      { sectionId: "sports", title: "Ajax", header: false, daysAgo: 4 },
    ];
    const ranked = rankCurrent(entries, "sports");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].daysAgo).toBe(4);
  });

  it("favours a story that stayed in the news over a one-day blip", () => {
    const entries = [
      ...[0, 1, 2].map((d) => ({
        sectionId: "sports",
        title: "Running story",
        header: false,
        daysAgo: d,
      })),
      { sectionId: "sports", title: "Blip", header: false, daysAgo: 0 },
    ];
    expect(rankCurrent(entries, "sports")[0].title).toBe("Running story");
  });

  it("favours today over a month ago for otherwise equal mentions", () => {
    const entries = [
      { sectionId: "sports", title: "Stale", header: true, daysAgo: 30 },
      { sectionId: "sports", title: "Fresh", header: true, daysAgo: 0 },
    ];
    expect(rankCurrent(entries, "sports")[0].title).toBe("Fresh");
  });

  it("is stable: equal scores break on title, not on input order", () => {
    const mk = (title: string) => ({ sectionId: "s", title, header: true, daysAgo: 1 });
    const a = rankCurrent([mk("Beta"), mk("Alpha")], "s").map((r) => r.title);
    const b = rankCurrent([mk("Alpha"), mk("Beta")], "s").map((r) => r.title);
    expect(a).toEqual(b);
    expect(a).toEqual(["Alpha", "Beta"]);
  });
});

describe("current — freshness wording", () => {
  it("reads naturally and never uses a dash", () => {
    expect(freshnessWord(0)).toBe("today");
    expect(freshnessWord(1)).toBe("yesterday");
    expect(freshnessWord(5)).toBe("5 days ago");
    for (const d of [0, 1, 2, 30]) expect(freshnessWord(d)).not.toMatch(/[—–]/);
  });
});
