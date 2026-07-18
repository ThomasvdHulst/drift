import { describe, it, expect } from "vitest";
import { focusFromParams, focusToParams, describeFocus, type Focus } from "./focus";

const p = (qs: string) => new URLSearchParams(qs);

describe("focusFromParams", () => {
  it("parses a valid field focus and resolves the friendly label", () => {
    expect(focusFromParams(p("focus=field&bucket=mathematics&seed=Mathematics"))).toEqual({
      kind: "field",
      bucket: "mathematics",
      label: "Mathematics",
    });
  });

  it("rejects an unknown / injected field bucket (returns null)", () => {
    expect(focusFromParams(p("focus=field&bucket=notatopic"))).toBeNull();
    expect(focusFromParams(p("focus=field&bucket=morelike:Foo"))).toBeNull();
    expect(focusFromParams(p("focus=field"))).toBeNull();
  });

  it("parses an orbit focus from title, defaulting the label to the title", () => {
    expect(focusFromParams(p("focus=orbit&title=Category%20theory"))).toEqual({
      kind: "orbit",
      seedTitle: "Category theory",
      seedLabel: "Category theory",
    });
  });

  it("uses seed as the orbit title when title is absent", () => {
    expect(focusFromParams(p("focus=orbit&seed=Bauhaus"))).toEqual({
      kind: "orbit",
      seedTitle: "Bauhaus",
      seedLabel: "Bauhaus",
    });
  });

  it("returns null when no focus is present or the orbit has no seed", () => {
    expect(focusFromParams(p("realm=encyclopedia"))).toBeNull();
    expect(focusFromParams(p("focus=orbit"))).toBeNull();
  });
});

describe("focusToParams → focusFromParams round-trip", () => {
  it("survives a round-trip for a field focus", () => {
    const focus: Focus = { kind: "field", bucket: "mathematics", label: "Mathematics" };
    expect(focusFromParams(new URLSearchParams(focusToParams(focus)))).toEqual(focus);
  });

  it("survives a round-trip for an orbit focus", () => {
    const focus: Focus = {
      kind: "orbit",
      seedTitle: "Category theory",
      seedLabel: "Category theory",
    };
    expect(focusFromParams(new URLSearchParams(focusToParams(focus)))).toEqual(focus);
  });
});

describe("describeFocus", () => {
  it("labels a field and an orbit", () => {
    expect(describeFocus({ kind: "field", bucket: "mathematics", label: "Mathematics" })).toBe(
      "Within Mathematics",
    );
    expect(
      describeFocus({ kind: "orbit", seedTitle: "Bauhaus", seedLabel: "Bauhaus" }),
    ).toBe("Orbiting Bauhaus");
  });
});
