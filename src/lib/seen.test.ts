import { describe, it, expect } from "vitest";
import { pushSeen, unionSeen } from "./seen";

describe("pushSeen", () => {
  it("appends a new title as most-recent", () => {
    expect(pushSeen(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("moves an existing title to the end (dedupe)", () => {
    expect(pushSeen(["a", "b", "c"], "a")).toEqual(["b", "c", "a"]);
  });

  it("drops the oldest once the cap is exceeded", () => {
    expect(pushSeen(["a", "b", "c"], "d", 3)).toEqual(["b", "c", "d"]);
  });

  it("ignores an empty title", () => {
    expect(pushSeen(["a"], "")).toEqual(["a"]);
  });

  it("keeps the list within the cap over many pushes", () => {
    let list: string[] = [];
    for (let i = 0; i < 1000; i++) list = pushSeen(list, `p${i}`, 500);
    expect(list).toHaveLength(500);
    expect(list[0]).toBe("p500"); // oldest survivor
    expect(list[list.length - 1]).toBe("p999");
  });
});

describe("unionSeen (cross-device merge)", () => {
  it("appends only titles this device hasn't seen", () => {
    expect(unionSeen(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("preserves LOCAL recency order (a remote entry never gets promoted)", () => {
    // "a" is this device's oldest; the other device seeing it again must not
    // make it the newest here, or the cap would decay genuinely-recent titles.
    expect(unionSeen(["a", "b", "c"], ["a"])).toEqual(["a", "b", "c"]);
  });

  it("de-dupes within the remote list too", () => {
    expect(unionSeen(["a"], ["b", "b", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("drops the oldest once the cap is exceeded", () => {
    expect(unionSeen(["a", "b"], ["c", "d"], 3)).toEqual(["b", "c", "d"]);
  });

  it("ignores empty entries and handles empty inputs", () => {
    expect(unionSeen(["a"], ["", "b"])).toEqual(["a", "b"]);
    expect(unionSeen([], ["a"])).toEqual(["a"]);
    expect(unionSeen(["a"], [])).toEqual(["a"]);
    expect(unionSeen([], [])).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const local = ["a"];
    const remote = ["b"];
    unionSeen(local, remote);
    expect(local).toEqual(["a"]);
    expect(remote).toEqual(["b"]);
  });
});
