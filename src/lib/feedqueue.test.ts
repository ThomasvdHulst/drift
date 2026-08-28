import { describe, it, expect } from "vitest";
import {
  COMMIT_RATIO,
  COMMIT_SETTLE_MS,
  QUEUE_AHEAD,
  appendTerminus,
  commitDecision,
  hasTerminus,
  insertAfterLike,
  invalidateQueue,
  isCandidate,
  isQueued,
  pendingIds,
  queueCapacity,
  queuedCount,
  queuedItem,
  terminusReason,
  trimToCapacity,
  type FeedItem,
} from "./feedqueue";
import { cardId } from "./card";
import type { ArrivedVia, Card } from "./types";
import type { SourceId } from "./realms/types";

function card(pageTitle: string, source: SourceId = "wikipedia"): Card {
  return { pageTitle, displayTitle: pageTitle, extract: "…", source } as Card;
}
const via: ArrivedVia = { type: "drift" };
const q = (title: string, source: SourceId = "wikipedia") =>
  queuedItem(card(title, source), via);

describe("commitDecision", () => {
  it("commits at the threshold once it has settled", () => {
    expect(
      commitDecision({ ratio: COMMIT_RATIO, visibleMs: COMMIT_SETTLE_MS, committed: false }),
    ).toBe(true);
  });

  it("does not commit a card that is only partly on screen", () => {
    expect(
      commitDecision({ ratio: 0.74, visibleMs: 5000, committed: false }),
    ).toBe(false);
  });

  // The rule that stops one fling recording six stops: scroll-snap-stop: always
  // halts at every card, so visibility alone would count each of them.
  it("does not commit a card that was only glimpsed", () => {
    expect(commitDecision({ ratio: 1, visibleMs: 200, committed: false })).toBe(false);
    expect(
      commitDecision({ ratio: 1, visibleMs: COMMIT_SETTLE_MS - 1, committed: false }),
    ).toBe(false);
  });

  // A card is committed exactly once, ever: scrolling back up to a stop must not
  // record it, meter it or add it to the trail a second time.
  it("never commits twice", () => {
    expect(commitDecision({ ratio: 1, visibleMs: 99999, committed: true })).toBe(false);
  });

  it("treats a missing ratio as not visible rather than as visible", () => {
    expect(commitDecision({ ratio: NaN, visibleMs: 5000, committed: false })).toBe(false);
  });
});

describe("queueCapacity", () => {
  it("is the configured depth for an unmetered reader", () => {
    expect(queueCapacity({ stopsRemaining: null })).toBe(QUEUE_AHEAD);
    expect(queueCapacity({ ahead: 5, stopsRemaining: null })).toBe(5);
  });

  // The meter FAILS OPEN everywhere (CLAUDE.md §4), and this is the queue's half
  // of that promise: "we could not look" must never mean "you get nothing".
  it("fails open on an unusable remaining count", () => {
    expect(queueCapacity({ stopsRemaining: Infinity })).toBe(QUEUE_AHEAD);
    expect(queueCapacity({ stopsRemaining: NaN })).toBe(QUEUE_AHEAD);
  });

  // Without this the feed fetches cards the reader cannot reach: upstream budget
  // spent on nothing, and content dangled behind a limit.
  it("never queues more than the day has left", () => {
    expect(queueCapacity({ stopsRemaining: 2 })).toBe(2);
    expect(queueCapacity({ stopsRemaining: 0 })).toBe(0);
    expect(queueCapacity({ stopsRemaining: 99 })).toBe(QUEUE_AHEAD);
  });

  it("cannot go negative", () => {
    expect(queueCapacity({ stopsRemaining: -4 })).toBe(0);
    expect(queueCapacity({ ahead: -1, stopsRemaining: null })).toBe(0);
  });
});

describe("pendingIds", () => {
  it("names exactly the queued cards", () => {
    const queue: FeedItem[] = [
      { kind: "step", index: 0 },
      q("A"),
      { kind: "ad" },
      q("B"),
      { kind: "terminus", reason: "pool-dry" },
    ];
    expect([...pendingIds(queue)].sort()).toEqual(
      [cardId(card("A")), cardId(card("B"))].sort(),
    );
  });

  // The invariant that makes a separate pending set unnecessary, and with it the
  // leak-or-duplicate bug that a separate set invites.
  it("releases an id the moment its item leaves the queue", () => {
    const queue: FeedItem[] = [q("A"), q("B")];
    const { queue: after } = invalidateQueue(queue);
    expect(pendingIds(after).size).toBe(0);
  });
});

describe("isCandidate", () => {
  const seen = new Set<string>();
  const pending = new Set([cardId(card("Queued"))]);

  it("accepts an unseen, unqueued card from the realm being read", () => {
    expect(isCandidate(card("Fresh"), seen, pending, "encyclopedia")).toBe(true);
  });

  it("rejects a card already spoken for by the queue", () => {
    expect(isCandidate(card("Queued"), seen, pending, "encyclopedia")).toBe(false);
  });

  // Delegated to lookahead.isServable, so the discrete buffer and the queue can
  // never disagree about what a servable card is.
  it("still rejects what the buffer would reject", () => {
    expect(
      isCandidate(card("Read"), new Set([cardId(card("Read"))]), pending, "encyclopedia"),
    ).toBe(false);
    expect(isCandidate(card("Vase", "met"), seen, pending, "encyclopedia")).toBe(false);
    expect(isCandidate(undefined, seen, pending, "encyclopedia")).toBe(false);
  });
});

describe("invalidateQueue", () => {
  // Nothing has to be undone, because nothing about a queued card was ever
  // written down. That is the whole two-phase model in one test.
  it("empties the queue and hands back the cards", () => {
    const a = q("A");
    const b = q("B");
    const { queue, dropped } = invalidateQueue([
      { kind: "step", index: 0 },
      a,
      b,
    ]);
    expect(queue).toEqual([]);
    expect(dropped).toEqual([a, b]);
  });

  // Those cards cost real upstream requests; the caller returns them to the
  // buffer rather than throwing away three cards of the Met's budget per pull.
  it("hands back only real cards, not ads or endings", () => {
    const { dropped } = invalidateQueue([
      { kind: "ad" },
      q("A"),
      { kind: "terminus", reason: "caught-up" },
    ]);
    expect(dropped.map((d) => d.card.pageTitle)).toEqual(["A"]);
  });

  it("is safe on an empty queue", () => {
    expect(invalidateQueue([])).toEqual({ queue: [], dropped: [] });
  });
});

describe("trimToCapacity", () => {
  // From the END, because the front is what the reader is about to reach: the
  // day closing should run the feed out under the thumb, not in front of it.
  it("drops from the end", () => {
    const [a, b, c] = [q("A"), q("B"), q("C")];
    const { queue, dropped } = trimToCapacity([a, b, c], 1);
    expect(queue).toEqual([a]);
    expect(dropped).toEqual([b, c]);
  });

  it("keeps steps and endings, counting only real cards", () => {
    const a = q("A");
    const b = q("B");
    const queue: FeedItem[] = [{ kind: "step", index: 3 }, a, b];
    const out = trimToCapacity(queue, 1);
    expect(out.queue).toEqual([{ kind: "step", index: 3 }, a]);
    expect(out.dropped).toEqual([b]);
  });

  it("empties at zero capacity and is a no-op above the count", () => {
    expect(trimToCapacity([q("A")], 0).queue).toEqual([]);
    const full: FeedItem[] = [q("A"), q("B")];
    expect(trimToCapacity(full, 9).queue).toEqual(full);
  });
});

describe("insertAfterLike", () => {
  it("inserts without replacing anything", () => {
    const [a, b] = [q("A"), q("B")];
    const liked = q("Liked");
    const out = insertAfterLike([a, b], liked);
    expect(out).toEqual([liked, a, b]);
  });

  // Swapping a card out from under a reader who has begun to see it is exactly
  // the dishonesty §2.1 forbids. Shifting is free; overwriting is not allowed.
  it("never touches an item the reader has begun to reveal", () => {
    const [a, b, c] = [q("A"), q("B"), q("C")];
    const liked = q("Liked");
    const out = insertAfterLike([a, b, c], liked, { firstMutableIndex: 1 });
    expect(out).toEqual([a, liked, b, c]);
    expect(out.length).toBe(4); // inserted, not replaced
  });

  it("appends when the whole queue is already revealed", () => {
    const [a, b] = [q("A"), q("B")];
    const liked = q("Liked");
    expect(insertAfterLike([a, b], liked, { firstMutableIndex: 99 })).toEqual([
      a,
      b,
      liked,
    ]);
  });

  it("does not duplicate a card already queued", () => {
    const a = q("A");
    const again = q("A");
    const out = insertAfterLike([a, q("B")], again);
    expect(queuedCount(out)).toBe(2);
    expect(out[0]).toBe(a);
  });
});

describe("terminusReason", () => {
  // The day always wins: an allowance that ran out inside a news section is the
  // day ending, not the section, and saying otherwise misreports why it stopped.
  it("puts the day above every other ending", () => {
    expect(terminusReason({ focusKind: "current", dayDone: true })).toBe("day-done");
    expect(terminusReason({ focusKind: null, dayDone: true })).toBe("day-done");
  });

  it("distinguishes a read-out news section from a dry pool", () => {
    expect(terminusReason({ focusKind: "current", dayDone: false })).toBe("caught-up");
    expect(terminusReason({ focusKind: "field", dayDone: false })).toBe("pool-dry");
    expect(terminusReason({ focusKind: "artist", dayDone: false })).toBe("pool-dry");
    expect(terminusReason({ dayDone: false })).toBe("pool-dry");
  });
});

describe("appendTerminus", () => {
  // A refill can come back empty several times running; three stacked "you are
  // caught up" cards would be both silly and untrue.
  it("is idempotent", () => {
    const once = appendTerminus([q("A")], "pool-dry");
    const twice = appendTerminus(once, "pool-dry");
    expect(twice).toEqual(once);
    expect(twice.filter((i) => i.kind === "terminus").length).toBe(1);
  });

  it("lets a later ending replace an earlier one", () => {
    const out = appendTerminus(appendTerminus([], "pool-dry"), "day-done");
    expect(out).toEqual([{ kind: "terminus", reason: "day-done" }]);
  });

  it("always sits last, after the cards", () => {
    const out = appendTerminus([q("A"), q("B")], "caught-up");
    expect(out[out.length - 1]).toEqual({ kind: "terminus", reason: "caught-up" });
    expect(hasTerminus(out)).toBe(true);
    expect(hasTerminus([q("A")])).toBe(false);
  });
});

describe("queuedCount", () => {
  it("counts real cards only, since an ad or an ending is not one", () => {
    expect(
      queuedCount([
        { kind: "step", index: 0 },
        q("A"),
        { kind: "ad" },
        q("B"),
        { kind: "terminus", reason: "day-done" },
      ]),
    ).toBe(2);
  });
});

describe("queuedItem", () => {
  it("keys on the card id, the way the rest of the app speaks about cards", () => {
    const item = q("Octopus");
    expect(item.id).toBe(cardId(card("Octopus")));
    expect(isQueued(item)).toBe(true);
  });
});
