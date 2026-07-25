import { describe, it, expect } from "vitest";
import {
  focusFromParams,
  focusToParams,
  focusBucket,
  describeFocus,
  type Focus,
} from "./focus";

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

  it("survives a round-trip for a current-events focus", () => {
    const focus: Focus = { kind: "current", section: "sports", label: "Sports" };
    expect(focusFromParams(new URLSearchParams(focusToParams(focus)))).toEqual(focus);
  });
});

describe("a current-events focus (Phase 23)", () => {
  const p = (qs: string) => new URLSearchParams(qs);

  it("parses a known news section", () => {
    expect(focusFromParams(p("focus=current&section=sports&seed=Sports"))).toEqual({
      kind: "current",
      section: "sports",
      label: "Sports",
    });
  });

  it("takes the label from the registry, never from the URL", () => {
    // The seed param is display text a link could carry anything in; the banner
    // must show what the section actually is.
    const focus = focusFromParams(p("focus=current&section=sports&seed=Anything"));
    expect(focus).toEqual({ kind: "current", section: "sports", label: "Sports" });
  });

  it("rejects an unknown or injected section", () => {
    expect(focusFromParams(p("focus=current&section=lizards"))).toBeNull();
    expect(focusFromParams(p("focus=current"))).toBeNull();
    expect(
      focusFromParams(p("focus=current&section=" + encodeURIComponent("../../etc"))),
    ).toBeNull();
  });
});

describe("a Gallery form focus (Phase 24)", () => {
  const focus: Focus = {
    kind: "form",
    form: "painting",
    era: "1850-1899",
    label: "Paintings, 1850 to 1899",
  };

  it("parses a form and a period, taking the label from the registry", () => {
    expect(
      focusFromParams(p("focus=form&form=painting&era=1850-1899&seed=Anything")),
    ).toEqual(focus);
  });

  it("defaults to all periods when no era is given", () => {
    expect(focusFromParams(p("focus=form&form=print"))).toEqual({
      kind: "form",
      form: "print",
      era: "all",
      label: "Prints",
    });
  });

  it("survives a round-trip", () => {
    expect(focusFromParams(p(new URLSearchParams(focusToParams(focus)).toString()))).toEqual(
      focus,
    );
  });

  it("carries the discover bucket so the feed never spells a slice itself", () => {
    expect(focusBucket(focus)).toBe("form:painting:1850-1899");
    expect(
      focusBucket({ kind: "field", bucket: "mathematics", label: "Mathematics" }),
    ).toBe("mathematics");
    // Kinds that serve their own pool, not a discover bucket.
    expect(focusBucket({ kind: "orbit", seedTitle: "X", seedLabel: "X" })).toBeNull();
    expect(focusBucket({ kind: "current", section: "sports", label: "Sports" })).toBeNull();
  });

  it("also emits the bucket param, so /drift can seed the first card", () => {
    expect(focusToParams(focus).bucket).toBe("form:painting:1850-1899");
  });

  it("rejects an unknown form, an unknown era, and an injected one", () => {
    expect(focusFromParams(p("focus=form&form=sonnets&era=all"))).toBeNull();
    expect(focusFromParams(p("focus=form&form=painting&era=1750s"))).toBeNull();
    expect(focusFromParams(p("focus=form"))).toBeNull();
    expect(
      focusFromParams(
        p("focus=form&form=" + encodeURIComponent('painting") OR 1=1')),
      ),
    ).toBeNull();
  });

  // The registry knows AIC holds no 17th-century photographs, so a hand-edited
  // URL for that slice must not start a drift that can never fill.
  it("rejects a period the form is too thin for", () => {
    expect(focusFromParams(p("focus=form&form=photograph&era=1600s"))).toBeNull();
    expect(
      focusFromParams(p("focus=form&form=photograph&era=1850-1899")),
    ).not.toBeNull();
  });
});

describe("a Gallery artist focus (Phase 24)", () => {
  const focus: Focus = {
    kind: "artist",
    artistId: "40610",
    label: "Vincent van Gogh",
    works: 18,
  };

  it("parses an artist, a label and a count", () => {
    expect(
      focusFromParams(p("focus=artist&artist=40610&seed=Vincent+van+Gogh&works=18")),
    ).toEqual(focus);
  });

  it("survives a round-trip", () => {
    expect(
      focusFromParams(p(new URLSearchParams(focusToParams(focus)).toString())),
    ).toEqual(focus);
  });

  it("starts every artist drift at ring 0, and widens by swapping the bucket", () => {
    expect(focusToParams(focus).bucket).toBe("artist:40610:0");
    expect(focusBucket(focus)).toBe("artist:40610:0");
    expect(focusBucket(focus, 1)).toBe("artist:40610:1");
    expect(focusBucket(focus, 2)).toBe("artist:40610:2");
  });

  // The id reaches a numeric term query upstream, so it is the one field that
  // must be strictly validated here.
  it("rejects a non-numeric or injected artist id", () => {
    expect(focusFromParams(p("focus=artist&artist=abc"))).toBeNull();
    expect(focusFromParams(p("focus=artist"))).toBeNull();
    expect(
      focusFromParams(p("focus=artist&artist=" + encodeURIComponent('40610") OR 1=1'))),
    ).toBeNull();
  });

  it("survives a missing label or count rather than voiding the drift", () => {
    expect(focusFromParams(p("focus=artist&artist=40610"))).toEqual({
      kind: "artist",
      artistId: "40610",
      label: "This artist",
    });
    expect(
      focusFromParams(p("focus=artist&artist=40610&seed=X&works=nonsense")),
    ).toEqual({ kind: "artist", artistId: "40610", label: "X" });
  });
});

describe("describeFocus", () => {
  it("labels an artist drift with the artist's name alone", () => {
    expect(
      describeFocus({
        kind: "artist",
        artistId: "40610",
        label: "Vincent van Gogh",
      }),
    ).toBe("Vincent van Gogh");
  });

  it("labels a form slice as a complete phrase, with no framing word", () => {
    expect(
      describeFocus({
        kind: "form",
        form: "painting",
        era: "1850-1899",
        label: "Paintings, 1850 to 1899",
      }),
    ).toBe("Paintings, 1850 to 1899");
  });

  it("labels a field, an orbit and a current-events drift", () => {
    expect(describeFocus({ kind: "field", bucket: "mathematics", label: "Mathematics" })).toBe(
      "Within Mathematics",
    );
    expect(
      describeFocus({ kind: "orbit", seedTitle: "Bauhaus", seedLabel: "Bauhaus" }),
    ).toBe("Orbiting Bauhaus");
    expect(describeFocus({ kind: "current", section: "sports", label: "Sports" })).toBe(
      "In the news: Sports",
    );
  });
});
