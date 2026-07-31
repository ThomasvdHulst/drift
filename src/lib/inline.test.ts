import { describe, it, expect } from "vitest";
import { parseInline, absolutizeLinks } from "./inline";

describe("parseInline", () => {
  it("returns one text segment for plain prose", () => {
    expect(parseInline("Just words.")).toEqual([
      { kind: "text", text: "Just words." },
    ]);
  });

  it("splits strong and links in order, keeping the surrounding text", () => {
    expect(
      parseInline("You must be **16**. See [sources](/sources) for why."),
    ).toEqual([
      { kind: "text", text: "You must be " },
      { kind: "strong", text: "16" },
      { kind: "text", text: ". See " },
      { kind: "link", text: "sources", href: "/sources" },
      { kind: "text", text: " for why." },
    ]);
  });

  it("handles an absolute href", () => {
    expect(parseInline("[CC0](https://example.org/a?b=c)")).toEqual([
      { kind: "link", text: "CC0", href: "https://example.org/a?b=c" },
    ]);
  });

  // The rule that matters for a legal document: markup that does not parse must
  // survive as literal text rather than vanishing from the rendered clause.
  it("passes unmatched markup through as text", () => {
    for (const raw of [
      "an unclosed **bold",
      "a [label with no target",
      "brackets [like this] on their own",
      "a lone ** in the middle",
    ]) {
      expect(parseInline(raw).map((s) => s.text).join("")).toBe(raw);
    }
  });

  it("never drops a character of the source", () => {
    const source =
      "**Lead.** Text with [a link](/x), **another lead** and a trailing tail.";
    const flat = parseInline(source)
      .map((s) => (s.kind === "text" ? s.text : s.text))
      .join("");
    // Everything but the markup delimiters themselves survives.
    expect(flat).toBe(
      "Lead. Text with a link, another lead and a trailing tail.",
    );
  });
});

describe("absolutizeLinks", () => {
  it("makes app-relative links absolute and leaves external ones alone", () => {
    expect(
      absolutizeLinks(
        "See [contact](/contact) and [CC0](https://creativecommons.org/x).",
        "https://www.usedrift.org",
      ),
    ).toBe(
      "See [contact](https://www.usedrift.org/contact) and [CC0](https://creativecommons.org/x).",
    );
  });

  it("leaves prose with no links untouched", () => {
    expect(absolutizeLinks("Nothing to do.", "https://x.test")).toBe(
      "Nothing to do.",
    );
  });
});
