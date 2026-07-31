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
