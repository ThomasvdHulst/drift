import { describe, it, expect } from "vitest";
import {
  isServable,
  firstServableIndex,
  peekServable,
  takeServable,
  servableCount,
} from "./lookahead";
import type { Card } from "./types";
import { cardId } from "./card";
import type { SourceId } from "./realms/types";

function card(pageTitle: string, source: SourceId = "wikipedia"): Card {
  return {
    pageTitle,
    displayTitle: pageTitle,
    extract: "…",
    source,
  } as Card;
}

const entry = (title: string, source: SourceId = "wikipedia") => ({
  card: card(title, source),
});

describe("isServable", () => {
  it("accepts an unseen card from the realm being read", () => {
    expect(isServable(entry("Octopus"), new Set(), "encyclopedia")).toBe(true);
  });

  it("rejects a card already seen", () => {
    const seen = new Set([cardId(card("Octopus"))]);
    expect(isServable(entry("Octopus"), seen, "encyclopedia")).toBe(false);
  });

  // The buffer legitimately holds the other realm's cards after a crossing
  // (crossRealm seeds it with the destination batch), so this is the condition
  // that stops a Gallery card appearing mid-Encyclopedia-drift.
  it("rejects a card from the other realm", () => {
    expect(isServable(entry("Vase", "met"), new Set(), "encyclopedia")).toBe(false);
    expect(isServable(entry("Vase", "met"), new Set(), "gallery")).toBe(true);
  });

  it("rejects malformed entries rather than throwing", () => {
    expect(isServable(undefined, new Set(), "encyclopedia")).toBe(false);
    expect(isServable({}, new Set(), "encyclopedia")).toBe(false);
    expect(
      isServable({ card: { pageTitle: "" } as Card }, new Set(), "encyclopedia"),
    ).toBe(false);
  });
});

describe("firstServableIndex", () => {
  it("skips unservable entries", () => {
    const seen = new Set([cardId(card("A"))]);
    const items = [entry("A"), entry("B", "met"), entry("C")];
    expect(firstServableIndex(items, seen, "encyclopedia")).toBe(2);
  });

  it("is -1 when nothing can be served", () => {
    expect(firstServableIndex([entry("A", "met")], new Set(), "encyclopedia")).toBe(-1);
    expect(firstServableIndex([], new Set(), "encyclopedia")).toBe(-1);
  });
});

describe("peekServable", () => {
  it("returns the entry a take would return, without consuming anything", () => {
    const items = [entry("A", "met"), entry("B"), entry("C")];
    const before = items.length;
    const peeked = peekServable(items, new Set(), "encyclopedia");
    expect(peeked?.card?.pageTitle).toBe("B");
    expect(items.length).toBe(before);
  });

  // The whole point of the module: warm what will actually be shown.
  it("agrees with takeServable", () => {
    const seen = new Set([cardId(card("A"))]);
    const items = [entry("A"), entry("B", "met"), entry("C"), entry("D")];
    const peeked = peekServable(items, seen, "encyclopedia");
    const taken = takeServable([...items], seen, "encyclopedia");
    expect(peeked?.card?.pageTitle).toBe(taken?.card?.pageTitle);
  });

  it("is null when nothing can be served", () => {
    expect(peekServable([entry("A", "met")], new Set(), "encyclopedia")).toBeNull();
  });
});

describe("takeServable", () => {
  it("returns the first servable entry and consumes it", () => {
    const items = [entry("A"), entry("B")];
    expect(takeServable(items, new Set(), "encyclopedia")?.card?.pageTitle).toBe("A");
    expect(items.map((i) => i.card?.pageTitle)).toEqual(["B"]);
  });

  // Matches the shift-loop it replaces: entries passed over can never become
  // servable again, so they are dropped rather than walked past forever.
  it("discards everything it passed over", () => {
    const seen = new Set([cardId(card("A"))]);
    const items = [entry("A"), entry("B", "met"), entry("C"), entry("D")];
    expect(takeServable(items, seen, "encyclopedia")?.card?.pageTitle).toBe("C");
    expect(items.map((i) => i.card?.pageTitle)).toEqual(["D"]);
  });

  it("drains the buffer and returns null when nothing is servable", () => {
    const items = [entry("A", "met"), entry("B", "met")];
    expect(takeServable(items, new Set(), "encyclopedia")).toBeNull();
    expect(items).toEqual([]);
  });

  it("is safe on an empty buffer", () => {
    const items: { card?: Card }[] = [];
    expect(takeServable(items, new Set(), "encyclopedia")).toBeNull();
    expect(items).toEqual([]);
  });
});

describe("servableCount", () => {
  // A buffer of twelve already-read cards is an empty buffer. Counting `length`
  // instead would let the feed run itself dry while believing it was full.
  it("counts only what could actually be served", () => {
    const seen = new Set([cardId(card("A"))]);
    const items = [entry("A"), entry("B", "met"), entry("C"), entry("D")];
    expect(servableCount(items, seen, "encyclopedia")).toBe(2);
    expect(servableCount(items, seen, "gallery")).toBe(1);
    expect(servableCount([], seen, "encyclopedia")).toBe(0);
  });
});
