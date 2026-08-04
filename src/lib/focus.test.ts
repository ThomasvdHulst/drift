import { describe, it, expect } from "vitest";
import {
  focusFromParams,
  focusToParams,
  focusBucket,
  focusRealm,
  focusForRealm,
  focusUnder,
  focusName,
  bannerFocus,
  pushFocus,
  releaseFocusIn,
  focusStackFromParams,
  focusStackToParams,
  writeFocusParams,
  describeFocus,
  sessionKey,
  SESSION_PARAMS,
  FOCUS_PARAMS,
  type Focus,
} from "./focus";

const p = (qs: string) => new URLSearchParams(qs);

const FIELD: Focus = { kind: "field", bucket: "mathematics", label: "Mathematics" };
const ORBIT: Focus = { kind: "orbit", seedTitle: "Category theory", seedLabel: "Category theory" };
const NEWS: Focus = { kind: "current", section: "sports", label: "Sports" };
const ARTIST: Focus = { kind: "artist", artistId: "40610", label: "Vincent van Gogh" };
const ORBIT_OCTOPUS: Focus = { kind: "orbit", seedTitle: "Octopus", seedLabel: "Octopus" };

// The key /drift compares each render to decide "are these params still the
// session I am showing?". It exists because reading the params once per MOUNT
// silently ignores a new field / orbit whenever the page is reused instead of
// remounted: the drift carries on as if you had not picked anything, until the
// app is reloaded. That is the bug it guards.
describe("sessionKey", () => {
  it("changes when the reader asks for a different session", () => {
    const free = sessionKey(p("realm=encyclopedia"));
    expect(sessionKey(p("realm=encyclopedia&focus=field&bucket=physics&seed=Physics"))).not.toBe(free);
    expect(sessionKey(p("realm=encyclopedia&focus=orbit&title=Octopus&seed=Octopus"))).not.toBe(free);
    // one field to another
    expect(sessionKey(p("focus=field&bucket=physics"))).not.toBe(
      sessionKey(p("focus=field&bucket=music")),
    );
    // and a realm change, or a continued trail
    expect(sessionKey(p("realm=gallery"))).not.toBe(sessionKey(p("realm=encyclopedia")));
    expect(sessionKey(p("continue=abc"))).not.toBe(sessionKey(p("")));
  });

  it("is stable for the same request, whatever the param order", () => {
    expect(sessionKey(p("focus=field&bucket=physics&seed=Physics&realm=encyclopedia"))).toBe(
      sessionKey(p("realm=encyclopedia&seed=Physics&focus=field&bucket=physics")),
    );
  });

  it("ignores params that have nothing to do with which session this is", () => {
    const base = sessionKey(p("realm=encyclopedia&focus=field&bucket=physics"));
    expect(sessionKey(p("realm=encyclopedia&focus=field&bucket=physics&utm_source=x"))).toBe(base);
  });

  it("covers every param a focus is spelled with", () => {
    // focusToParams is the writer; sessionKey is the reader. If a future focus
    // kind adds a param and forgets to list it here, two different sessions
    // would share a key and the second one would never start.
    const focuses: Focus[] = [
      { kind: "field", bucket: "physics", label: "Physics" },
      { kind: "orbit", seedTitle: "Octopus", seedLabel: "Octopus" },
      { kind: "current", section: "sport", label: "Sport" },
      { kind: "form", form: "painting", era: "all", label: "Paintings" },
      { kind: "artist", artistId: "123", label: "Someone", works: 8 },
    ];
    for (const f of focuses) {
      for (const key of Object.keys(focusToParams(f))) {
        expect(SESSION_PARAMS, `${f.kind} writes ${key}`).toContain(key);
      }
    }
  });
});

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

// ---------------------------------------------------------------------------
// The focus stack. Two reader-reported bugs live here, and both were the same
// missing idea: a focus is a promise about ONE realm's drift, and a broad one
// can hold a narrow one inside it.
// ---------------------------------------------------------------------------

describe("focusRealm", () => {
  it("puts a field, an orbit and a news drift in the Encyclopedia", () => {
    expect(focusRealm(FIELD)).toBe("encyclopedia");
    expect(focusRealm(ORBIT)).toBe("encyclopedia");
    expect(focusRealm(NEWS)).toBe("encyclopedia");
  });

  it("puts a form slice and an artist in the Gallery", () => {
    expect(focusRealm(ARTIST)).toBe("gallery");
    expect(
      focusRealm({ kind: "form", form: "painting", era: "all", label: "Paintings" }),
    ).toBe("gallery");
  });
});

describe("focusForRealm", () => {
  // The trap: a thread carried a field drift into the Gallery, where the field
  // could not apply, and crossing back was disabled *because* a focus was set.
  it("steers only its own realm, and goes dormant in the other one", () => {
    const stack = [FIELD];
    expect(focusForRealm(stack, "encyclopedia")).toEqual(FIELD);
    expect(focusForRealm(stack, "gallery")).toBeNull();
  });

  it("lets one realm's focus wait while another's steers", () => {
    const stack = pushFocus([FIELD], ARTIST);
    expect(focusForRealm(stack, "encyclopedia")).toEqual(FIELD);
    expect(focusForRealm(stack, "gallery")).toEqual(ARTIST);
  });

  it("serves the innermost focus a realm has", () => {
    expect(focusForRealm(pushFocus([FIELD], ORBIT), "encyclopedia")).toEqual(ORBIT);
  });

  it("is null for a realm nobody focused, and for an empty stack", () => {
    expect(focusForRealm([], "encyclopedia")).toBeNull();
    expect(focusForRealm([ARTIST], "encyclopedia")).toBeNull();
  });
});

describe("pushFocus", () => {
  it("nests a page orbit inside the field it was found in", () => {
    expect(pushFocus([FIELD], ORBIT)).toEqual([FIELD, ORBIT]);
  });

  it("replaces an orbit with the next orbit, so the stack can't grow forever", () => {
    const second: Focus = { kind: "orbit", seedTitle: "Topos", seedLabel: "Topos" };
    const stack = pushFocus(pushFocus([FIELD], ORBIT), second);
    expect(stack).toEqual([FIELD, second]);
  });

  it("resets its realm when a new BROAD focus is entered", () => {
    // Picking a different field is starting over inside that realm, not
    // burying the old one where releasing would resurface it.
    const other: Focus = { kind: "field", bucket: "physics", label: "Physics" };
    expect(pushFocus(pushFocus([FIELD], ORBIT), other)).toEqual([other]);
  });

  it("leaves the other realm's focus alone", () => {
    expect(pushFocus([ARTIST, FIELD], ORBIT)).toEqual([ARTIST, FIELD, ORBIT]);
  });
});

describe("releaseFocusIn", () => {
  // The second reported bug: drifting in mathematics, circling one page found
  // there, then letting that page go dropped the reader into a free drift
  // instead of back into mathematics.
  it("falls back to the focus the released one was nested inside", () => {
    const stack = releaseFocusIn(pushFocus([FIELD], ORBIT), "encyclopedia");
    expect(stack).toEqual([FIELD]);
    expect(focusForRealm(stack, "encyclopedia")).toEqual(FIELD);
  });

  it("frees the realm once the last focus in it is released", () => {
    expect(releaseFocusIn([FIELD], "encyclopedia")).toEqual([]);
  });

  it("touches nothing when that realm has no focus", () => {
    expect(releaseFocusIn([ARTIST], "encyclopedia")).toEqual([ARTIST]);
    expect(releaseFocusIn([], "gallery")).toEqual([]);
  });

  it("releases the named realm's focus, never the other realm's", () => {
    expect(releaseFocusIn([FIELD, ARTIST], "encyclopedia")).toEqual([ARTIST]);
  });
});

describe("focusUnder", () => {
  it("names what letting go lands you in, or nothing", () => {
    expect(focusUnder(pushFocus([FIELD], ORBIT), "encyclopedia")).toEqual(FIELD);
    expect(focusUnder([FIELD], "encyclopedia")).toBeNull();
    expect(focusUnder([], "encyclopedia")).toBeNull();
  });
});

describe("bannerFocus", () => {
  it("shows the focus steering this realm", () => {
    expect(bannerFocus([FIELD], "encyclopedia")).toEqual({
      focus: FIELD,
      dormant: false,
    });
  });

  // Silence here would be the dishonest option in the other direction: the drift
  // WILL snap back into the field the moment you cross home, so the banner keeps
  // saying it exists and marks it as not currently steering (§2.1).
  it("keeps showing a focus waiting in the other realm, marked dormant", () => {
    expect(bannerFocus([FIELD], "gallery")).toEqual({ focus: FIELD, dormant: true });
  });

  it("shows nothing when no focus is set at all", () => {
    expect(bannerFocus([], "encyclopedia")).toBeNull();
  });
});

describe("focusName", () => {
  it("gives a bare name that reads inside a sentence", () => {
    expect(`Back to ${focusName(FIELD)}`).toBe("Back to Mathematics");
    expect(`Back to ${focusName(ORBIT)}`).toBe("Back to Category theory");
    expect(`Back to ${focusName(NEWS)}`).toBe("Back to Sports news");
    expect(`Back to ${focusName(ARTIST)}`).toBe("Back to Vincent van Gogh");
  });
});

describe("the focus stack in the URL", () => {
  it("round-trips a nested stack, so a reload resumes the nesting", () => {
    const stack = pushFocus([FIELD], ORBIT);
    const params = new URLSearchParams(focusStackToParams(stack));
    expect(focusStackFromParams(params)).toEqual(stack);
  });

  it("round-trips a single focus with no `under` at all", () => {
    const params = new URLSearchParams(focusStackToParams([FIELD]));
    expect(params.get("under")).toBeNull();
    expect(focusStackFromParams(params)).toEqual([FIELD]);
  });

  it("is empty when there is no focus", () => {
    expect(focusStackToParams([])).toEqual({});
    expect(focusStackFromParams(p("realm=encyclopedia"))).toEqual([]);
  });

  it("drops an `under` that is junk, oversized, or a nesting that can't happen", () => {
    const junk = p("focus=orbit&title=Octopus&under=" + encodeURIComponent("focus=field&bucket=notatopic"));
    expect(focusStackFromParams(junk)).toEqual([ORBIT_OCTOPUS]);
    const huge = p("focus=orbit&title=Octopus&under=" + "x".repeat(600));
    expect(focusStackFromParams(huge)).toEqual([ORBIT_OCTOPUS]);
    // An orbit claiming to be nested inside another orbit: entering one replaces
    // the other, so the outer claim collapses rather than being honoured.
    const flat = p(
      "focus=orbit&title=Octopus&under=" +
        encodeURIComponent("focus=orbit&title=Topos"),
    );
    expect(focusStackFromParams(flat)).toEqual([ORBIT_OCTOPUS]);
  });

  it("keeps a cross-realm pair, so both realms' focuses survive a reload", () => {
    const stack = pushFocus([FIELD], ARTIST);
    expect(focusStackFromParams(new URLSearchParams(focusStackToParams(stack)))).toEqual(
      stack,
    );
  });

  it("names every param it writes in SESSION_PARAMS and FOCUS_PARAMS", () => {
    // Same guard as the single-focus test above: a param the writer emits but
    // sessionKey ignores means two different sessions share a key, and one a
    // rewrite forgets to clear means a released focus haunts the next one.
    for (const key of Object.keys(focusStackToParams(pushFocus([FIELD], ORBIT)))) {
      expect(SESSION_PARAMS, `stack writes ${key}`).toContain(key);
      expect(FOCUS_PARAMS, `stack writes ${key}`).toContain(key);
    }
  });
});

describe("writeFocusParams", () => {
  it("clears the focus it replaces, keeping everything else", () => {
    const sp = p("realm=encyclopedia&mode=endless&focus=current&section=sports&seed=Sports");
    writeFocusParams(sp, [FIELD]);
    expect(sp.get("section")).toBeNull();
    expect(sp.get("focus")).toBe("field");
    expect(sp.get("bucket")).toBe("mathematics");
    expect(sp.get("realm")).toBe("encyclopedia");
    expect(sp.get("mode")).toBe("endless");
  });

  it("strips every focus param when the last focus is released", () => {
    const sp = p("realm=gallery&continue=abc&focus=orbit&title=Octopus&seed=Octopus&under=focus%3Dfield%26bucket%3Dmathematics");
    writeFocusParams(sp, []);
    for (const key of FOCUS_PARAMS) expect(sp.get(key), key).toBeNull();
    expect(sp.get("continue")).toBe("abc");
    expect(sp.get("realm")).toBe("gallery");
  });

  it("writes a nested stack the parser reads back", () => {
    const sp = p("realm=encyclopedia");
    writeFocusParams(sp, pushFocus([FIELD], ORBIT));
    expect(focusStackFromParams(sp)).toEqual([FIELD, ORBIT]);
  });
});
