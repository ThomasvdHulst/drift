import { describe, it, expect } from "vitest";
import { readSiteverify } from "./turnstile";

describe("readSiteverify", () => {
  it("passes only on an explicit success:true", () => {
    expect(readSiteverify({ success: true })).toEqual({ ok: true });
  });

  it("rejects a failure and reports its error codes", () => {
    expect(
      readSiteverify({ success: false, "error-codes": ["invalid-input-response"] }),
    ).toEqual({ ok: false, reason: "invalid-input-response" });
  });

  it("reports a replayed token, the most likely real-world rejection", () => {
    expect(
      readSiteverify({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    ).toEqual({ ok: false, reason: "timeout-or-duplicate" });
  });

  it("rejects a truthy-but-not-true success (no type coercion)", () => {
    // A malformed or spoofed body must not squeak through on "true"/1.
    expect(readSiteverify({ success: "true" }).ok).toBe(false);
    expect(readSiteverify({ success: 1 }).ok).toBe(false);
  });

  it("rejects malformed or empty bodies", () => {
    for (const body of [null, undefined, "nope", 42, []]) {
      expect(readSiteverify(body).ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("falls back to a generic reason when no codes are given", () => {
    expect(readSiteverify({ success: false })).toEqual({ ok: false, reason: "rejected" });
    expect(readSiteverify({ success: false, "error-codes": "oops" })).toEqual({
      ok: false,
      reason: "rejected",
    });
  });
});
