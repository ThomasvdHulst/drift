import { describe, it, expect } from "vitest";
import { TERMS, TERMS_EFFECTIVE, TERMS_INTRO } from "./terms";
import { parseInline } from "./inline";
import { PUBLIC_CONTENT_ROUTES, isPublicRoute } from "./site";

/** Every string of prose in the document, flattened. */
const prose = TERMS.flatMap((s) =>
  s.blocks.flatMap((b) => ("bullets" in b ? b.bullets : [b.p])),
);

describe("terms — shape", () => {
  it("has a stable, unique anchor per section", () => {
    const ids = TERMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("has no empty section, heading or block", () => {
    for (const s of TERMS) {
      expect(s.heading.trim(), s.id).not.toBe("");
      expect(s.blocks.length, s.id).toBeGreaterThan(0);
    }
    for (const p of prose) expect(p.trim()).not.toBe("");
  });

  it("is reachable signed out and listed for search engines", () => {
    expect(isPublicRoute("/terms")).toBe(true);
    expect([...PUBLIC_CONTENT_ROUTES]).toContain("/terms");
  });

  it("states an effective date, which DSA Article 14(2) changes hang off", () => {
    expect(TERMS_EFFECTIVE).toMatch(/\d{4}/);
    expect(TERMS_INTRO.trim()).not.toBe("");
  });
});

describe("terms — copy rules", () => {
  // A standing owner preference, enforced the same way the other copy
  // registries enforce it. Compound hyphens are fine; em and en dashes are not.
  it("uses no em or en dashes", () => {
    for (const p of [TERMS_INTRO, ...TERMS.map((s) => s.heading), ...prose]) {
      expect(p, p.slice(0, 60)).not.toMatch(/[—–]/);
    }
  });

  it("has no unparseable inline markup", () => {
    for (const p of prose) {
      // A `**` or a `](` left over after parsing means a delimiter did not pair
      // up, which would render as literal asterisks on the page.
      const literal = parseInline(p)
        .filter((s) => s.kind === "text")
        .map((s) => s.text)
        .join("");
      expect(literal, p.slice(0, 60)).not.toMatch(/\*\*|\]\(/);
    }
  });

  it("links only to routes that exist", () => {
    const known = new Set<string>([
      ...PUBLIC_CONTENT_ROUTES,
      "/account",
      "/terms.md",
    ]);
    for (const p of prose) {
      for (const seg of parseInline(p)) {
        if (seg.kind !== "link") continue;
        if (seg.href.startsWith("http")) continue;
        expect(known.has(seg.href), `${seg.href} in "${p.slice(0, 40)}"`).toBe(
          true,
        );
      }
    }
  });
});

describe("terms — the content DSA Article 14 and the audit require", () => {
  const all = prose.join("\n").toLowerCase();

  // The trap the audit flags at M-5: CC BY-SA 4.0 §2(a)(5)(C) forbids imposing
  // additional terms that restrict what a recipient may do with the licensed
  // material. A boilerplate "you may not copy or redistribute content from this
  // service" clause would be a licence breach caused by the compliance document
  // itself, so the carve-out is asserted rather than merely implied.
  it("carves the source content out instead of restricting it", () => {
    const section = TERMS.find((s) => s.id === "content");
    expect(section).toBeDefined();
    const text = section!.blocks
      .flatMap((b) => ("bullets" in b ? b.bullets : [b.p]))
      .join(" ")
      .toLowerCase();
    expect(text).toContain("claims no rights");
    expect(text).toContain("adds no conditions");
    expect(text).toMatch(/stays available to you under its own licence/);
  });

  it("never tells the reader they may not redistribute the source content", () => {
    expect(all).not.toMatch(
      /(may|must) not (copy|redistribute|reproduce|share).{0,40}(content|material|text|article)/,
    );
  });

  it("covers each Article 14(1) item", () => {
    expect(all).toContain("illegal"); // restrictions imposed
    expect(all).toContain("impersonat");
    expect(all).toContain("harass");
    expect(all).toMatch(/does not monitor|nothing is scanned/); // moderation policy
    expect(all).toMatch(/never removes anything|does not moderate/); // algorithmic role
    expect(all).toMatch(/decided by a person|operator reads it and decides/); // human review
  });

  it("describes the Article 16, 17 and 18 procedures", () => {
    expect(TERMS.some((s) => s.id === "reporting")).toBe(true);
    expect(TERMS.some((s) => s.id === "consequences")).toBe(true);
    expect(TERMS.some((s) => s.id === "safety")).toBe(true);
    // Anonymity for the Directive 2011/93/EU offences is the one carve-out in
    // Article 16(2)(c), and it has to be offered, not merely allowed.
    expect(all).toContain("2011/93");
    expect(all).toMatch(/anonym/);
    expect(all).toContain("statement of reasons");
  });

  // Drift is a hosting service but NOT an online platform (the sharing
  // restriction is enforced in the database), so Articles 20 and 21 do not
  // apply. Promising an internal complaint system or an out-of-court dispute
  // body would be describing something that does not exist, which is exactly
  // the failure the audit found on /privacy at B-3.
  it("does not promise an appeals body it does not have", () => {
    expect(all).not.toMatch(/out-of-court dispute settlement body will/);
    expect(all).toContain("do not apply to it");
  });

  it("states the eligibility age, the governing law and the consumer carve-out", () => {
    expect(all).toContain("at least 16 years old");
    expect(all).toContain("dutch law");
    expect(all).toMatch(/mandatory consumer rules|consumer/);
  });
});
