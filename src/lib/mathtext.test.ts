import { describe, it, expect } from "vitest";
import {
  preprocessMath,
  splitMath,
  hasMath,
  stripMathMarkers,
  MATH_OPEN,
  MATH_CLOSE,
} from "./mathtext";

const wrap = (latex: string) => `${MATH_OPEN}${latex}${MATH_CLOSE}`;

// Mirrors the real Action-API `explaintext` shape: indented flattened-MathML
// tokens immediately followed by the `{\displaystyle …}` TeX annotation.
const euler =
  "is the equality\n\n  \n    e\n    i\n    +\n    1\n    =\n    0\n    {\\displaystyle e^{i\\pi }+1=0}\n  \n\nwhere\n\n    e\n    {\\displaystyle e}\n  \n is Euler's number.";

// Adjacent inline formulae with prose connectors between them, wrapped in the
// invisible word-joiner (U+2060) MediaWiki emits.
const coeff =
  "coefficients ⁠\n  \n    a\n    {\\displaystyle a}\n  \n⁠, and ⁠\n  \n    c\n    {\\displaystyle c}\n  \n representing";

describe("preprocessMath", () => {
  it("returns non-math text unchanged (fast path)", () => {
    const t = "The octopus is a marine cephalopod. It has eight limbs.";
    expect(preprocessMath(t)).toBe(t);
  });

  it("strips the flattened-MathML garble and keeps the LaTeX in markers", () => {
    const out = preprocessMath(euler);
    expect(out).not.toContain("displaystyle");
    expect(out).not.toMatch(/\n {2,}/); // no indented garble lines survive
    expect(out).toContain(wrap("e^{i\\pi }+1=0"));
    expect(out).toContain("is the equality");
    expect(out).toContain("is Euler's number.");
  });

  it("preserves prose connectors between adjacent inline formulae", () => {
    const out = preprocessMath(coeff);
    expect(out).not.toContain("⁠"); // word-joiners stripped
    expect(out).toContain(wrap("a"));
    expect(out).toContain(wrap("c"));
    expect(out).toContain(", and"); // the connector is NOT eaten as garble
    expect(out).toContain("representing");
  });

  it("keeps balanced braces inside the LaTeX", () => {
    const out = preprocessMath("x is \n    {\\displaystyle {\\frac {a}{b}}} here");
    expect(out).toContain(wrap("{\\frac {a}{b}}"));
  });

  it("bails safely on an unbalanced annotation", () => {
    const t = "start {\\displaystyle a+b oops no close";
    expect(() => preprocessMath(t)).not.toThrow();
  });
});

describe("splitMath", () => {
  it("splits marked text into text + math segments in order", () => {
    const segs = splitMath(`before ${wrap("x^2")} after`);
    expect(segs).toEqual([
      { type: "text", value: "before " },
      { type: "math", value: "x^2" },
      { type: "text", value: " after" },
    ]);
  });

  it("returns a single text segment when there's no math", () => {
    expect(splitMath("plain text")).toEqual([{ type: "text", value: "plain text" }]);
  });

  it("round-trips the Euler example into readable segments", () => {
    const segs = splitMath(preprocessMath(euler));
    const maths = segs.filter((s) => s.type === "math").map((s) => s.value);
    expect(maths).toContain("e^{i\\pi }+1=0");
    expect(maths).toContain("e");
  });
});

describe("hasMath", () => {
  it("detects marker presence", () => {
    expect(hasMath(preprocessMath(euler))).toBe(true);
    expect(hasMath("no math here")).toBe(false);
  });
});

describe("stripMathMarkers", () => {
  it("removes the invisible markers, leaving the LaTeX source inline", () => {
    const s = `a ${wrap("x^2")} b`;
    expect(stripMathMarkers(s)).toBe("a x^2 b");
    expect(hasMath(stripMathMarkers(s))).toBe(false);
  });
});
