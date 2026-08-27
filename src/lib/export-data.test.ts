import { describe, it, expect } from "vitest";
import {
  buildDataExport,
  dataExportFilename,
  EXPORT_ABOUT,
  EXPORT_RIGHTS,
} from "./export-data";

const AT = new Date("2026-07-31T09:15:00.000Z");

describe("buildDataExport", () => {
  it("stamps a self-describing header", () => {
    const out = buildDataExport({}, AT);
    expect(out.drift).toEqual({
      export: "personal-data",
      version: 1,
      exportedAt: "2026-07-31T09:15:00.000Z",
      about: EXPORT_ABOUT,
      rights: EXPORT_RIGHTS,
    });
  });

  it("carries every section it was given", () => {
    const out = buildDataExport(
      {
        account: { id: "u1", email: "ada@example.com" },
        trails: [],
        reactions: {},
        interests: { topics: {} } as never,
        settings: { theme: "dark" },
        seen: ["Ukiyo-e"],
        sessions: [],
        profile: { handle: "ada" },
        friends: [],
        shares: [],
      },
      AT,
    );
    expect(out.account).toEqual({ id: "u1", email: "ada@example.com" });
    expect(out.seen).toEqual(["Ukiyo-e"]);
    expect(out.profile).toEqual({ handle: "ada" });
  });

  // An absent section means "not held / not looked at"; an empty one means "held,
  // and there is none". Serialising undefined as null would collapse the two,
  // and the file says so in its own `rights` line, so it has to be true.
  it("omits sections that were not supplied rather than nulling them", () => {
    const out = buildDataExport({ trails: [], seen: undefined }, AT);
    expect("trails" in out).toBe(true);
    expect("seen" in out).toBe(false);
    expect("profile" in out).toBe(false);
  });

  it("round-trips through JSON unchanged", () => {
    const out = buildDataExport({ account: { id: "u1" }, seen: ["A", "B"] }, AT);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("names the rights it is provided under, in the file", () => {
    // The file may be read years later by someone who has never seen the app,
    // so it has to explain itself without the page it came from.
    expect(EXPORT_RIGHTS).toContain("15");
    expect(EXPORT_RIGHTS).toContain("20");
    expect(EXPORT_ABOUT).toMatch(/personal data/i);
  });
});

describe("dataExportFilename", () => {
  it("is dated, so two exports do not overwrite each other", () => {
    expect(dataExportFilename(AT)).toBe("drift-data-2026-07-31.json");
  });
});

describe("the present / empty / absent contract", () => {
  // The regression: sections used to be written as `...(xs.length ? { xs } : {})`,
  // which makes "you have none" and "we could not look" produce the identical
  // file, while EXPORT_RIGHTS told the reader an absent section "was not held".
  // A failed read therefore became a positive claim that the reader had nothing.
  it("keeps an empty section that was actually looked at", () => {
    const out = buildDataExport({ shareLinks: [], readingDays: [] }, AT);
    expect(out).toHaveProperty("shareLinks");
    expect(out.shareLinks).toEqual([]);
    expect(out).toHaveProperty("readingDays");
  });

  it("drops a section that was not looked at", () => {
    const out = buildDataExport({ shareLinks: undefined }, AT);
    expect(out).not.toHaveProperty("shareLinks");
  });

  // A reader who never bought the unlock has a REAL answer (null), which is not
  // the same as the row being unreadable.
  it("distinguishes 'never bought' from 'could not look'", () => {
    const neverBought = buildDataExport({ supporter: null }, AT);
    expect(neverBought).toHaveProperty("supporter");
    expect(neverBought.supporter).toBeNull();

    const couldNotLook = buildDataExport({}, AT);
    expect(couldNotLook).not.toHaveProperty("supporter");
  });

  it("carries the purchase record and the reading counter when held", () => {
    const out = buildDataExport(
      {
        supporter: { source: "purchase", refund_count: 1 },
        readingDays: [{ day: "2026-08-27", stops: 12 }],
      },
      AT,
    );
    expect(out.supporter).toEqual({ source: "purchase", refund_count: 1 });
    expect(out.readingDays).toEqual([{ day: "2026-08-27", stops: 12 }]);
  });

  it("explains the distinction to whoever opens the file years later", () => {
    expect(EXPORT_RIGHTS).toMatch(/present but empty/i);
    expect(EXPORT_RIGHTS).toMatch(/missing entirely/i);
  });
});

