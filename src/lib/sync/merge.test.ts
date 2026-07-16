import { describe, it, expect } from "vitest";
import {
  mergeCollection,
  indexBy,
  mergeSessions,
  type RemoteRecord,
} from "./merge";

type Doc = { id: string; v: string };
const EPOCH = "1970-01-01T00:00:00.000Z";
const rec = (
  id: string,
  v: string,
  updatedAt: string,
  deleted = false,
): RemoteRecord<Doc> => ({ id, data: { id, v }, updatedAt, deleted });

describe("mergeCollection", () => {
  it("adds a remote record missing locally", () => {
    const r = mergeCollection<Doc>(
      {},
      [rec("a", "1", "2026-01-01T00:00:00Z")],
      new Set(),
      EPOCH,
    );
    expect(r.next).toEqual({ a: { id: "a", v: "1" } });
    expect(r.changedIds).toEqual(["a"]);
    expect(r.pulledAt).toBe("2026-01-01T00:00:00Z");
  });

  it("updates a locally-present record when remote differs", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "old" } },
      [rec("a", "new", "2026-01-02T00:00:00Z")],
      new Set(),
      EPOCH,
    );
    expect(r.next.a.v).toBe("new");
    expect(r.changedIds).toEqual(["a"]);
  });

  it("is a no-op (no change, no event) when remote equals local", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "same" } },
      [rec("a", "same", "2026-01-02T00:00:00Z")],
      new Set(),
      EPOCH,
    );
    expect(r.changedIds).toEqual([]);
    // cursor still advances even when data is unchanged
    expect(r.pulledAt).toBe("2026-01-02T00:00:00Z");
  });

  it("removes a local record when the remote row is a tombstone", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "1" }, b: { id: "b", v: "2" } },
      [rec("a", "", "2026-01-03T00:00:00Z", true)],
      new Set(),
      EPOCH,
    );
    expect(r.next).toEqual({ b: { id: "b", v: "2" } });
    expect(r.changedIds).toEqual(["a"]);
  });

  it("ignores a tombstone for a record we don't have (no spurious change)", () => {
    const r = mergeCollection<Doc>(
      {},
      [rec("gone", "", "2026-01-03T00:00:00Z", true)],
      new Set(),
      EPOCH,
    );
    expect(r.next).toEqual({});
    expect(r.changedIds).toEqual([]);
  });

  it("never overwrites a dirty local record (local edit wins)", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "local-edit" } },
      [rec("a", "server", "2999-01-01T00:00:00Z")],
      new Set(["a"]),
      EPOCH,
    );
    expect(r.next.a.v).toBe("local-edit");
    expect(r.changedIds).toEqual([]);
    // cursor still advances so we don't re-pull this row forever
    expect(r.pulledAt).toBe("2999-01-01T00:00:00Z");
  });

  it("never deletes a dirty local record via a remote tombstone", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "revived" } },
      [rec("a", "", "2999-01-01T00:00:00Z", true)],
      new Set(["a"]),
      EPOCH,
    );
    expect(r.next.a).toEqual({ id: "a", v: "revived" });
    expect(r.changedIds).toEqual([]);
  });

  it("advances the cursor to the newest updatedAt across many rows", () => {
    const r = mergeCollection<Doc>(
      {},
      [
        rec("a", "1", "2026-01-01T00:00:00Z"),
        rec("c", "3", "2026-03-01T00:00:00Z"),
        rec("b", "2", "2026-02-01T00:00:00Z"),
      ],
      new Set(),
      EPOCH,
    );
    expect(r.pulledAt).toBe("2026-03-01T00:00:00Z");
    expect(Object.keys(r.next).sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps the prior cursor when remote is empty", () => {
    const r = mergeCollection<Doc>(
      { a: { id: "a", v: "1" } },
      [],
      new Set(),
      "2026-05-05T00:00:00Z",
    );
    expect(r.pulledAt).toBe("2026-05-05T00:00:00Z");
    expect(r.changedIds).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const local = { a: { id: "a", v: "1" } };
    mergeCollection<Doc>(
      local,
      [rec("a", "2", "2026-01-02T00:00:00Z")],
      new Set(),
      EPOCH,
    );
    expect(local.a.v).toBe("1");
  });
});

describe("indexBy", () => {
  it("indexes an array by a key selector", () => {
    expect(indexBy([{ id: "x", v: "1" }], (d) => d.id)).toEqual({
      x: { id: "x", v: "1" },
    });
  });
});

describe("mergeSessions", () => {
  it("unions two lists by id (no data lost across devices)", () => {
    const merged = mergeSessions(
      [{ id: "a", n: 1 }],
      [{ id: "b", n: 2 }],
    );
    expect(merged.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("keeps the local record on an id collision", () => {
    const merged = mergeSessions(
      [{ id: "a", n: 99 }],
      [{ id: "a", n: 1 }],
    );
    expect(merged).toEqual([{ id: "a", n: 99 }]);
  });

  it("handles empty sides", () => {
    expect(mergeSessions([], [{ id: "a", n: 1 }])).toEqual([{ id: "a", n: 1 }]);
    expect(mergeSessions([{ id: "a", n: 1 }], [])).toEqual([{ id: "a", n: 1 }]);
  });
});
