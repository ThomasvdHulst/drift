import { describe, it, expect } from "vitest";
import { countWord, sentenceList } from "./text";

describe("sentenceList", () => {
  it("reads a list the way a sentence says it", () => {
    expect(sentenceList(["A", "B", "C"])).toBe("A, B and C");
    expect(sentenceList(["A", "B"])).toBe("A and B");
    expect(sentenceList(["A"])).toBe("A");
  });

  it("says nothing about nothing", () => {
    expect(sentenceList([])).toBe("");
  });
});

describe("countWord", () => {
  it("spells small counts", () => {
    expect(countWord(2)).toBe("two");
    expect(countWord(10)).toBe("ten");
  });

  it("leaves larger ones as numerals", () => {
    expect(countWord(11)).toBe("11");
    expect(countWord(42)).toBe("42");
  });
});
