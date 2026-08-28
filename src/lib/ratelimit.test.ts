import { describe, it, expect } from "vitest";
import { makeRateLimiter, linksLimiter, imageLimiter } from "./ratelimit";

// Time is injected everywhere, so none of this sleeps.
const T0 = 1_700_000_000_000;

describe("makeRateLimiter", () => {
  it("lets a cold caller spend the whole burst", () => {
    const rl = makeRateLimiter({ burst: 5, perMinute: 5 });
    for (let i = 0; i < 5; i++) {
      expect(rl.take("a", T0).ok, `request ${i + 1}`).toBe(true);
    }
    expect(rl.take("a", T0).ok).toBe(false);
  });

  it("refills at the stated rate", () => {
    const rl = makeRateLimiter({ burst: 6, perMinute: 60 }); // one per second
    for (let i = 0; i < 6; i++) rl.take("a", T0);
    expect(rl.take("a", T0).ok).toBe(false);
    expect(rl.take("a", T0 + 999).ok).toBe(false);
    expect(rl.take("a", T0 + 1_000).ok).toBe(true);
    // And it does not refill past the burst, however long it idles.
    for (let i = 0; i < 6; i++) {
      expect(rl.take("a", T0 + 3_600_000).ok, `post-idle ${i + 1}`).toBe(true);
    }
    expect(rl.take("a", T0 + 3_600_000).ok).toBe(false);
  });

  it("reports a Retry-After a caller can actually use", () => {
    const rl = makeRateLimiter({ burst: 2, perMinute: 60 });
    rl.take("a", T0);
    rl.take("a", T0);
    const v = rl.take("a", T0);
    expect(v.ok).toBe(false);
    // One token per second, none left, so about a second. Never zero: a
    // Retry-After of 0 invites an immediate retry that is certain to fail.
    expect(v.retryAfterSec).toBe(1);
    expect(v.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("keeps callers separate", () => {
    const rl = makeRateLimiter({ burst: 2, perMinute: 2 });
    rl.take("a", T0);
    rl.take("a", T0);
    expect(rl.take("a", T0).ok).toBe(false);
    expect(rl.take("b", T0).ok).toBe(true);
  });

  // ⚠️ The rule that keeps one script from locking the route for a whole
  // population that shares "we have no usable address header".
  it("always allows an empty key, and never stores a bucket for it", () => {
    const rl = makeRateLimiter({ burst: 1, perMinute: 1 });
    for (let i = 0; i < 50; i++) expect(rl.take("", T0).ok).toBe(true);
    expect(rl.size()).toBe(0);
  });

  it("bounds its memory", () => {
    const rl = makeRateLimiter({ burst: 3, perMinute: 60, maxKeys: 20 });
    for (let i = 0; i < 500; i++) rl.take(`ip-${i}`, T0 + i);
    expect(rl.size()).toBeLessThanOrEqual(20);
  });

  it("sweeps idle buckets rather than active ones", () => {
    const rl = makeRateLimiter({ burst: 2, perMinute: 60, maxKeys: 3 });
    // Fill well past the cap, all long idle, then one fresh caller.
    for (let i = 0; i < 50; i++) rl.take(`old-${i}`, T0);
    const fresh = T0 + 3_600_000;
    rl.take("fresh", fresh);
    expect(rl.size()).toBeLessThanOrEqual(3);
    // The fresh caller kept its spent token: it is not silently reset.
    expect(rl.take("fresh", fresh).ok).toBe(true);
    expect(rl.take("fresh", fresh).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The configured buckets, pinned against what the real callers do. These are
// the numbers a future edit is most likely to get wrong, because "make it
// stricter" always looks safe and here it would break a real reader.
// ---------------------------------------------------------------------------

describe("the buckets are sized for the real callers", () => {
  it("wiki/links clears a plausible burst of trail exits", () => {
    // UnopenedPage fires once per exit. Five exits in one minute is already
    // beyond anything a person does, and it must not be refused.
    for (let i = 0; i < 5; i++) {
      expect(linksLimiter.take("reader", T0 + i * 1_000).ok, `exit ${i + 1}`).toBe(
        true,
      );
    }
  });

  it("wiki/links still refuses a sustained loop", () => {
    // A different key, so the case above is untouched.
    let refused = 0;
    for (let i = 0; i < 60; i++) {
      if (!linksLimiter.take("looper", T0 + i * 100).ok) refused++;
    }
    expect(refused).toBeGreaterThan(40);
  });

  it("the image proxy clears several trail maps in a row", () => {
    // A map is a dozen-plus thumbnails at once, so this is roughly six maps back
    // to back with no CDN in front, from one address. It must not be refused:
    // the failure mode of a wrong limit here is a visibly broken card.
    for (let i = 0; i < 96; i++) {
      expect(imageLimiter.take("viewer", T0 + i * 50).ok, `image ${i + 1}`).toBe(
        true,
      );
    }
  });

  it("the image proxy still refuses an endless loop", () => {
    let refused = 0;
    for (let i = 0; i < 400; i++) {
      if (!imageLimiter.take("image-looper", T0 + i * 10).ok) refused++;
    }
    expect(refused).toBeGreaterThan(200);
  });

  it("every bucket starts full, so a reader is never refused cold", () => {
    // The first request from an address it has never seen must always pass,
    // whichever bucket it lands in.
    expect(linksLimiter.take(`cold-${T0}`).ok).toBe(true);
    expect(imageLimiter.take(`cold-${T0}`).ok).toBe(true);
  });
});
