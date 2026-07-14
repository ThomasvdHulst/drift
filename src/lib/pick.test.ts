import { describe, it, expect } from "vitest";
import { pickRandom } from "./pick";

describe("pickRandom", () => {
  it("returns undefined for an empty array", () => {
    expect(pickRandom([])).toBeUndefined();
  });
  it("picks by the rng (0 → first)", () => {
    expect(pickRandom(["a", "b", "c"], () => 0)).toBe("a");
  });
  it("picks by the rng (0.9 * 3 = 2.7 → index 2)", () => {
    expect(pickRandom(["a", "b", "c"], () => 0.9)).toBe("c");
  });
  it("clamps rng === 1 to the last element", () => {
    expect(pickRandom(["a", "b", "c"], () => 1)).toBe("c");
  });
});
