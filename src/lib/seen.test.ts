import { describe, it, expect } from "vitest";
import { pushSeen } from "./seen";

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
