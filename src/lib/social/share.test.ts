import { describe, it, expect } from "vitest";
import {
  trailToSharePayload,
  cardToSharePayload,
  sharePayloadToLocalTrail,
  shareTitle,
} from "./share";
import type { Card, Trail, TrailStep } from "@/lib/types";

const card: Card = {
  pageTitle: "Octopus",
  displayTitle: "Octopus",
  extract: "A cephalopod.",
  sourceUrl: "https://en.wikipedia.org/wiki/Octopus",
  source: "wikipedia",
};
const step: TrailStep = {
  card,
  arrivedVia: { type: "seed", seedName: "Octopus" },
  timestamp: 1,
  expanded: false,
};
const trail: Trail = {
  id: "orig-id",
  name: "Octopus → Cephalopod",
  steps: [step],
  createdAt: 111,
  liked: true,
  realm: "encyclopedia",
};

describe("trailToSharePayload", () => {
  it("keeps name/realm/steps, drops local-only fields", () => {
    const p = trailToSharePayload(trail);
    expect(p).toEqual({
      name: "Octopus → Cephalopod",
      realm: "encyclopedia",
      steps: [step],
    });
    expect("id" in p).toBe(false);
    expect("liked" in p).toBe(false);
  });
});

describe("sharePayloadToLocalTrail", () => {
  it("produces a fresh recipient-owned trail with injected id/createdAt", () => {
    const local = sharePayloadToLocalTrail(
      trailToSharePayload(trail),
      "new-id",
      999,
    );
    expect(local.id).toBe("new-id");
    expect(local.createdAt).toBe(999);
    expect(local.liked).toBe(false); // not the sender's like
    expect(local.name).toBe("Octopus → Cephalopod");
    expect(local.steps).toEqual([step]);
    expect(local.realm).toBe("encyclopedia");
  });
  it("falls back to a default name and empty steps", () => {
    const local = sharePayloadToLocalTrail(
      { name: "  ", steps: undefined as unknown as TrailStep[] },
      "id",
      1,
    );
    expect(local.name).toBe("Shared trail");
    expect(local.steps).toEqual([]);
  });
});

describe("cardToSharePayload", () => {
  it("snapshots the card by value", () => {
    const p = cardToSharePayload(card);
    expect(p).toEqual(card);
    expect(p).not.toBe(card);
  });
});

describe("shareTitle", () => {
  it("names a trail by its name and a card by its title", () => {
    expect(shareTitle("trail", { name: "My Trail" })).toBe("My Trail");
    expect(shareTitle("card", card)).toBe("Octopus");
    expect(shareTitle("trail", {})).toBe("Shared trail");
    expect(shareTitle("card", {})).toBe("Shared card");
  });
});
