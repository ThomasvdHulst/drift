import { describe, it, expect } from "vitest";
import {
  TOKEN_BYTES,
  TRIAL_CARD_LIMIT,
  isValidToken,
  newShareToken,
  parsePublicShare,
  shareDescriptionOf,
  shareMessage,
  shareTitleOf,
  shareUrl,
  type PublicShare,
} from "./link";
import type { Card, TrailStep } from "../types";

const card: Card = {
  pageTitle: "Octopus",
  displayTitle: "Octopus",
  description: "Eight-limbed mollusc",
  extract: "A cephalopod of the order Octopoda.",
  sourceUrl: "https://en.wikipedia.org/wiki/Octopus",
  source: "wikipedia",
};

function step(title: string): TrailStep {
  return {
    card: { ...card, pageTitle: title, displayTitle: title },
    arrivedVia: { type: "seed", seedName: title },
    timestamp: 1,
    expanded: false,
  };
}

const trailShare: PublicShare = {
  kind: "trail",
  payload: { name: "How glass became a lens", steps: [step("Glass"), step("Lens")] },
  createdAt: 1,
};
const cardShare: PublicShare = { kind: "card", payload: card, createdAt: 1 };

describe("tokens", () => {
  // The token is the ONLY access control on a public share, so these are the
  // tests that matter most in this file.
  it("generates a URL-safe token the database's own constraint accepts", () => {
    const token = newShareToken();
    expect(isValidToken(token)).toBe(true);
    // base64url of 16 bytes, unpadded.
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("carries the full 128 bits: every random byte reaches the token", () => {
    // Two inputs differing only in the LAST byte must produce different tokens.
    // A naive implementation that truncated or dropped the tail would pass a
    // length check and silently shrink the keyspace.
    const a = newShareToken(() => new Uint8Array(TOKEN_BYTES).fill(0));
    const b = newShareToken(() => {
      const bytes = new Uint8Array(TOKEN_BYTES).fill(0);
      bytes[TOKEN_BYTES - 1] = 255;
      return bytes;
    });
    expect(a).not.toEqual(b);
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newShareToken()));
    expect(seen.size).toBe(200);
  });

  it("rejects anything that is not a token", () => {
    expect(isValidToken("")).toBe(false);
    expect(isValidToken("short")).toBe(false);
    expect(isValidToken("../../etc/passwd")).toBe(false);
    expect(isValidToken("has spaces in it woo")).toBe(false);
    expect(isValidToken("a".repeat(65))).toBe(false);
    expect(isValidToken(null)).toBe(false);
    expect(isValidToken(123)).toBe(false);
  });

  it("builds an absolute URL, because it is going into a chat message", () => {
    expect(shareUrl("abc123abc123abc123", "https://www.usedrift.org")).toBe(
      "https://www.usedrift.org/s/abc123abc123abc123",
    );
  });
});

describe("titles and descriptions", () => {
  it("names a trail and describes its shape", () => {
    expect(shareTitleOf(trailShare)).toBe("How glass became a lens");
    expect(shareDescriptionOf(trailShare)).toBe("2 stops, from Glass to Lens.");
  });

  it("names a card and uses the source's own description", () => {
    expect(shareTitleOf(cardShare)).toBe("Octopus");
    expect(shareDescriptionOf(cardShare)).toBe("Eight-limbed mollusc");
  });

  it("falls back rather than throwing on a payload with nothing in it", () => {
    const empty: PublicShare = { kind: "trail", payload: { name: "", steps: [] }, createdAt: 0 };
    expect(shareTitleOf(empty)).toBe("A trail on Drift");
    expect(shareDescriptionOf(empty)).toBe("A trail on Drift.");
  });

  it("writes a share message with no marketing voice in it", () => {
    // The sender did not write this sentence, so it must not sound like they
    // are selling something (CLAUDE.md §2, and the owner's standing note on
    // tone). No exclamation marks, no "check out", no dashes.
    for (const s of [trailShare, cardShare]) {
      const msg = shareMessage(s);
      expect(msg).not.toMatch(/[!—–]/);
      expect(msg.toLowerCase()).not.toContain("check out");
      expect(msg).toContain(shareTitleOf(s));
    }
  });
});

describe("parsePublicShare", () => {
  it("accepts what the database function actually returns", () => {
    const parsed = parsePublicShare({
      kind: "card",
      payload: card,
      created_at: "2026-08-01T10:00:00.000Z",
    });
    expect(parsed?.kind).toBe("card");
    expect(parsed?.createdAt).toBe(Date.parse("2026-08-01T10:00:00.000Z"));
  });

  it("treats a malformed row as no share at all", () => {
    // Every one of these must land on the same calm "not available" state as an
    // unknown token, rather than rendering half a card or throwing.
    expect(parsePublicShare(null)).toBeNull();
    expect(parsePublicShare(undefined)).toBeNull();
    expect(parsePublicShare("nope")).toBeNull();
    expect(parsePublicShare({ kind: "trail" })).toBeNull();
    expect(parsePublicShare({ kind: "playlist", payload: {} })).toBeNull();
    expect(parsePublicShare({ kind: "trail", payload: { steps: [] } })).toBeNull();
    expect(parsePublicShare({ kind: "trail", payload: { steps: "no" } })).toBeNull();
    expect(parsePublicShare({ kind: "card", payload: { extract: "no title" } })).toBeNull();
  });

  it("survives a missing or unparseable timestamp", () => {
    const parsed = parsePublicShare({ kind: "card", payload: card, created_at: "not a date" });
    expect(parsed).not.toBeNull();
    expect(parsed?.createdAt).toBe(0);
  });
});

describe("the trial limit", () => {
  it("is small, and is a number the copy can state out loud", () => {
    expect(TRIAL_CARD_LIMIT).toBe(3);
  });
});
