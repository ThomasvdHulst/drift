import { describe, it, expect } from "vitest";
import type { RelatedCandidate } from "./types";
import { toCardId } from "./card";
import {
  initOrbit,
  nextToExpand,
  ingestMorelike,
  takeFromPool,
  proximityWord,
  MAX_PER_PARENT,
} from "./orbit";

const cand = (title: string): RelatedCandidate => ({
  pageTitle: title,
  displayTitle: title,
  extract: `${title} is a thing.`, // non-empty so isJunk keeps it
});
const cands = (...titles: string[]) => titles.map(cand);
const id = (title: string) => toCardId("wikipedia", title);

describe("initOrbit", () => {
  it("starts with the seed on the frontier and nothing pooled", () => {
    const st = initOrbit("Bauhaus", "Bauhaus");
    expect(st.pool).toEqual([]);
    expect(st.frontier).toEqual([{ title: "Bauhaus", ring: 0 }]);
    expect(st.known.has(id("Bauhaus"))).toBe(true);
    expect(st.maxRingServed).toBe(0);
  });

  // Phase 23: an "in the news" drift widens by orbiting ALL the section's news
  // articles at once, so the widening stays near the actual stories.
  it("accepts several seeds, all at ring 0", () => {
    const st = initOrbit(["2026 FIFA World Cup", "FIFA", "Lionel Messi"], "Sports");
    expect(st.frontier).toEqual([
      { title: "2026 FIFA World Cup", ring: 0 },
      { title: "FIFA", ring: 0 },
      { title: "Lionel Messi", ring: 0 },
    ]);
    expect(st.seedLabel).toBe("Sports");
    for (const t of ["2026 FIFA World Cup", "FIFA", "Lionel Messi"]) {
      expect(st.known.has(id(t)), t).toBe(true);
    }
  });

  it("never re-serves a seed as if it were a discovery", () => {
    let st = initOrbit(["Seed A", "Seed B"], "Sports");
    st = ingestMorelike(st, "Seed A", 0, cands("X", "Seed B", "Y", "Z"), new Set());
    expect(st.pool.map((p) => p.card.pageTitle)).not.toContain("Seed B");
  });

  it("ignores empty seeds", () => {
    expect(initOrbit([]).frontier).toEqual([]);
    expect(initOrbit(["", "Real"]).frontier).toEqual([{ title: "Real", ring: 0 }]);
  });
});

describe("nextToExpand", () => {
  it("returns the lowest-ring unexpanded titles, capped at k", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("A", "B", "C", "D"), new Set());
    // frontier is now [B,C,D] at ring 1 (rank-0 "A" dropped); Seed expanded.
    expect(nextToExpand(st, 2).map((f) => f.title)).toEqual(["B", "C"]);
    expect(nextToExpand(st, 10).every((f) => f.ring === 1)).toBe(true);
  });

  it("skips already-expanded titles", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("A", "B", "C", "D"), new Set());
    st = ingestMorelike(st, "B", 1, cands("B", "E", "F", "G"), new Set());
    expect(nextToExpand(st, 5).some((f) => f.title === "B")).toBe(false);
  });
});

describe("ingestMorelike", () => {
  it("adds neighbours at ring+1, drops the rank-0 near-duplicate, marks the parent expanded", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("Dup", "A", "B", "C"), new Set());
    expect(st.pool.map((p) => p.card.pageTitle)).toEqual(["A", "B", "C"]);
    expect(st.pool.every((p) => p.ring === 1)).toBe(true);
    expect(st.expanded.has("Seed")).toBe(true);
    expect(st.frontier.find((f) => f.title === "Seed")).toBeUndefined();
  });

  it("keeps all candidates for a thin page (≤3)", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("A", "B"), new Set());
    expect(st.pool.map((p) => p.card.pageTitle)).toEqual(["A", "B"]);
  });

  it("dedups against known (no re-adding across expansions) and against seen", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("Dup", "A", "B", "C"), new Set());
    // Expanding A returns Z(rank 0, dropped) + A & B (already known) + fresh D +
    // seen E. Only D is new; A/B must NOT be re-added (known-dedup).
    const seen = new Set([id("E")]);
    st = ingestMorelike(st, "A", 1, cands("Z", "A", "B", "D", "E"), seen);
    const titles = st.pool.map((p) => p.card.pageTitle);
    expect(titles).toContain("D");
    expect(titles.filter((t) => t === "A")).toHaveLength(1); // known → not duplicated
    expect(titles.filter((t) => t === "B")).toHaveLength(1); // known → not duplicated
    expect(titles).not.toContain("E"); // seen filtered
    expect(titles).not.toContain("Z"); // rank-0 near-duplicate dropped
  });

  it("caps intake per parent at MAX_PER_PARENT", () => {
    const many = cands(...Array.from({ length: 20 }, (_, i) => `P${i}`));
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, many, new Set());
    expect(st.pool).toHaveLength(MAX_PER_PARENT);
    // rank-0 "P0" dropped; the next MAX_PER_PARENT kept.
    expect(st.pool[0].card.pageTitle).toBe("P1");
  });

  it("filters junk candidates (empty extract / list pages)", () => {
    let st = initOrbit("Seed");
    const mixed: RelatedCandidate[] = [
      cand("Keeper1"),
      { pageTitle: "No Extract", displayTitle: "No Extract" }, // junk: no extract
      { pageTitle: "List of things", displayTitle: "List of things", extract: "x" }, // junk: list
      cand("Keeper2"),
    ];
    st = ingestMorelike(st, "Seed", 0, mixed, new Set());
    // rank 0 (Keeper1) dropped as the near-duplicate; junk removed → only Keeper2.
    expect(st.pool.map((p) => p.card.pageTitle)).toEqual(["Keeper2"]);
  });
});

describe("takeFromPool", () => {
  it("serves lowest ring first and tracks the furthest ring served", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("Dup", "A", "B", "C"), new Set()); // ring 1
    st = ingestMorelike(st, "A", 1, cands("Dup2", "X", "Y"), new Set()); // ring 2
    const seen = new Set<string>();
    const first = takeFromPool(st, seen);
    expect(first.card?.ring).toBe(1);
    expect(first.state.maxRingServed).toBe(1);
  });

  it("drops cards that became seen and returns null when empty", () => {
    let st = initOrbit("Seed");
    st = ingestMorelike(st, "Seed", 0, cands("A", "B"), new Set());
    const seen = new Set([id("A"), id("B")]);
    const res = takeFromPool(st, seen);
    expect(res.card).toBeNull();
    expect(res.state.pool).toEqual([]);
  });
});

describe("proximityWord", () => {
  it("is a short, monotonic distance word", () => {
    expect(proximityWord(1)).toBe("nearby");
    expect(proximityWord(2)).toBe("further out");
    expect(proximityWord(3)).toBe("far out");
    expect(proximityWord(9)).toBe("distant");
  });
});
