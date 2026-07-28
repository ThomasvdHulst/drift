import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  elementEnd,
  htmlToText,
  replaceMath,
  cleanArticleHtml,
  htmlTable,
  infoboxFacts,
  htmlBlocks,
  takeBlocks,
  blocksToText,
  type Block,
} from "./wikihtml";
import { hasMath, splitMath, MATH_OPEN } from "./mathtext";
import {
  MOHS_TABLE,
  AMBOX,
  NAVBOX,
  BROOKLYN_LEAD,
  TAXOBOX,
  EULER_LEAD,
  SECTION_WITH_TABLE,
} from "./wikihtml.fixtures";

describe("decodeEntities", () => {
  it("decodes the numeric entities MediaWiki emits", () => {
    // Faithfully, so `&#160;` really is a non-breaking space here. Written as an
    // escape because an invisible character in a test is a trap.
    expect(decodeEntities("Chemical&#160;formula")).toBe("Chemical formula");
    expect(decodeEntities("CaSO4&#183;2H2O")).toBe("CaSO4·2H2O");
    expect(decodeEntities("&#x03C0;")).toBe("π");
  });

  it("leaves normalizing that non-breaking space to htmlToText", () => {
    expect(htmlToText("Chemical&#160;formula")).toBe("Chemical formula");
  });

  it("decodes the named ones it knows and leaves unknown ones alone", () => {
    expect(decodeEntities("a &amp; b &ndash; c")).toBe("a & b – c");
    expect(decodeEntities("&notanentity;")).toBe("&notanentity;");
  });
});

describe("elementEnd", () => {
  it("finds the matching close tag through nesting", () => {
    const html = "<table>a<table>b</table>c</table>tail";
    expect(html.slice(0, elementEnd(html, 0, "table"))).toBe(
      "<table>a<table>b</table>c</table>",
    );
  });

  it("does not confuse a tag with one that merely starts the same way", () => {
    const html = "<p>text</p><pre>code</pre>";
    expect(html.slice(0, elementEnd(html, 0, "p"))).toBe("<p>text</p>");
  });

  it("returns the end of the string on unbalanced markup, so callers advance", () => {
    const html = "<div>never closed";
    expect(elementEnd(html, 0, "div")).toBe(html.length);
  });
});

describe("htmlToText", () => {
  it("unwraps links and bold, turns <br> into a space, collapses whitespace", () => {
    expect(htmlToText('<b>1</b> <a href="/wiki/Talc" title="Talc">Talc</a><br />x')).toBe(
      "1 Talc x",
    );
  });

  it("keeps punctuation tight after a stripped tag", () => {
    expect(htmlToText("<p>Manhattan and <a>Brooklyn</a> .</p>")).toBe(
      "Manhattan and Brooklyn.",
    );
  });
});

describe("cleanArticleHtml", () => {
  // The one that matters most: TemplateStyles CSS lives INSIDE table cells, so a
  // parser that strips tags without removing <style> first pours CSS into the card.
  it("removes inline TemplateStyles CSS rather than reading it as text", () => {
    const clean = cleanArticleHtml(MOHS_TABLE);
    expect(clean).not.toContain("mw-parser-output");
    expect(htmlToText(clean)).not.toContain("font-size");
  });

  it("removes reference footnotes, so no stray [13] lands in the prose", () => {
    expect(htmlToText(cleanArticleHtml(BROOKLYN_LEAD))).not.toMatch(/\[\d+\]/);
    expect(htmlToText(cleanArticleHtml(MOHS_TABLE))).not.toContain("13");
  });

  it("removes hatnotes and the hidden short description", () => {
    const text = htmlToText(cleanArticleHtml(BROOKLYN_LEAD));
    expect(text).not.toContain("For other uses");
    expect(text).not.toContain("Bridge in New York City");
  });

  it("removes every <img>: a file in an article may be non-free", () => {
    expect(cleanArticleHtml(MOHS_TABLE)).not.toContain("<img");
    expect(cleanArticleHtml(BROOKLYN_LEAD)).not.toContain("upload.wikimedia.org");
  });
});

describe("replaceMath", () => {
  it("keeps the TeX annotation and drops the flattened MathML", () => {
    const out = replaceMath(EULER_LEAD);
    expect(hasMath(out)).toBe(true);
    expect(out).not.toContain("<annotation");
    expect(out).not.toContain("MJX-TeXAtom-ORD");
  });

  it("yields math segments <MathText> can render", () => {
    const text = htmlToText(cleanArticleHtml(EULER_LEAD));
    const segs = splitMath(text);
    const math = segs.filter((s) => s.type === "math").map((s) => s.value);
    expect(math).toContain("e^{i\\pi }+1=0");
    expect(math).toContain("e");
    // The prose around the formulae survives intact.
    expect(text).toContain("Euler's identity");
    expect(text).toContain("base of natural logarithms");
  });
});

describe("htmlTable", () => {
  const mohs = htmlTable(MOHS_TABLE)!;

  it("reads a wikitable into a header row plus data rows", () => {
    expect(mohs).not.toBeNull();
    expect(mohs.headerRow).toBe(true);
    expect(mohs.rows[0].every((c) => c.header)).toBe(true);
    expect(mohs.rows[0].map((c) => c.text)).toEqual([
      "Mohs hardness",
      "Reference mineral",
      "Chemical formula",
      "Absolute hardness",
    ]);
    expect(mohs.rows[1].map((c) => c.text)).toEqual([
      "1",
      "Talc",
      "Mg3Si4O10(OH)2",
      "1",
    ]);
    expect(mohs.totalRows).toBe(3);
  });

  it("drops the image-only column, since images are never reused", () => {
    for (const row of mohs.rows) expect(row).toHaveLength(4);
    expect(JSON.stringify(mohs.rows)).not.toContain("Example image");
  });

  // `totalCols` is what the card's footer will admit to cutting, so it counts the
  // columns a reader could actually have read: 4, not the 5 the markup had before
  // the image column was emptied by our own no-images rule.
  it("does not count a column it emptied itself as one it is hiding", () => {
    expect(mohs.totalCols).toBe(4);
  });

  // …but it does SAY the images are missing, because the prose above this very
  // table promises "images of the reference minerals in the rightmost column".
  it("flags that the table had images, so the card can admit it", () => {
    expect(mohs.imagesOmitted).toBe(true);
    const noImages = htmlTable(
      `<table class="wikitable"><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>`,
    )!;
    expect(noImages.imagesOmitted).toBeUndefined();
  });

  it("keeps the image marker out of the text it renders", () => {
    for (const row of mohs.rows) {
      for (const cell of row) expect(cell.text).not.toContain("");
    }
    expect(JSON.stringify(mohs.rows)).not.toContain("hadImage");
  });

  it("refuses maintenance banners and navboxes, which are tables too", () => {
    expect(htmlTable(AMBOX)).toBeNull();
    expect(htmlTable(NAVBOX)).toBeNull();
  });

  it("refuses an infobox (the Details disclosure shows that instead)", () => {
    expect(htmlTable(TAXOBOX)).toBeNull();
  });

  it("refuses a table that only holds another table (a layout wrapper)", () => {
    expect(
      htmlTable(
        `<table class="wikitable"><tbody><tr><td><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></td></tr></tbody></table>`,
      ),
    ).toBeNull();
  });

  it("refuses an unclassed table with no header cell (almost always layout)", () => {
    const layout = `<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>`;
    expect(htmlTable(layout)).toBeNull();
    const data = layout.replace("<td>a</td>", "<th>a</th>").replace("<td>b</td>", "<th>b</th>");
    expect(htmlTable(data)).not.toBeNull();
  });

  it("caps rows and reports the true total, so the card can say what it cut", () => {
    const row = (n: number) => `<tr><td>${n}</td><td>row ${n}</td></tr>`;
    const big = `<table class="wikitable"><tbody><tr><th>n</th><th>name</th></tr>${Array.from(
      { length: 40 },
      (_, i) => row(i),
    ).join("")}</tbody></table>`;
    const t = htmlTable(big)!;
    expect(t.totalRows).toBe(40);
    expect(t.rows).toHaveLength(11); // header + 10 data rows
  });

  it("caps very long cell text with an ellipsis", () => {
    const long = "x".repeat(400);
    const t = htmlTable(
      `<table class="wikitable"><tbody><tr><th>a</th><th>b</th></tr><tr><td>${long}</td><td>2</td></tr></tbody></table>`,
    )!;
    expect(t.rows[1][0].text.length).toBeLessThanOrEqual(140);
    expect(t.rows[1][0].text.endsWith("…")).toBe(true);
  });

  it("keeps colspan/rowspan, clamped, and leaves a spanned grid uncut", () => {
    const t = htmlTable(
      `<table class="wikitable"><tbody><tr><th colspan="2">pair</th><th rowspan="99">deep</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>`,
    )!;
    expect(t.rows[0][0].colSpan).toBe(2);
    expect(t.rows[0][1].rowSpan).toBe(8); // clamped from 99
    expect(t.rows[1]).toHaveLength(3);
  });

  // Live check finding: the periodic table's own grid parses as a 19-column
  // spanned table. Columns cannot be capped safely once cells span, so a card
  // refuses it rather than carrying a grid it cannot lay out.
  it("refuses a very wide spanned table", () => {
    const wide = (n: number) =>
      `<table class="wikitable"><tbody><tr><th colspan="2">Group</th>${Array.from(
        { length: n },
        (_, i) => `<th>${i + 1}</th>`,
      ).join("")}</tr><tr><td>a</td><td>b</td>${Array.from(
        { length: n },
        (_, i) => `<td>${i}</td>`,
      ).join("")}</tr></tbody></table>`;
    expect(htmlTable(wide(18))).toBeNull();
    expect(htmlTable(wide(4))).not.toBeNull(); // 6 columns: fine
  });

  it("uses the section as the caption when the table has none", () => {
    expect(htmlTable(MOHS_TABLE, "Scale")!.caption).toBe("Scale");
    const captioned = MOHS_TABLE.replace(
      /^<table([^>]*)>/,
      "<table$1><caption>Hardness of minerals</caption>",
    );
    expect(htmlTable(captioned, "Scale")!.caption).toBe("Hardness of minerals");
  });
});

describe("infoboxFacts", () => {
  it("reads a modern infobox into label/value rows", () => {
    const facts = infoboxFacts(BROOKLYN_LEAD);
    expect(facts).toEqual([
      // The `<br>` between the two things it carries reads as a comma: an infobox
      // value is a list, not a sentence.
      { label: "Carries", value: "5 lanes of roadway, bicycles and pedestrians" },
      { label: "Crosses", value: "East River" },
      { label: "Total length", value: "6,016 ft (1,833.7 m)" },
      { label: "Opened", value: "May 24, 1883" },
    ]);
  });

  it("skips the title, the image and the caption rows", () => {
    const labels = infoboxFacts(BROOKLYN_LEAD).map((f) => f.label);
    expect(labels).not.toContain("Brooklyn Bridge");
    expect(JSON.stringify(infoboxFacts(BROOKLYN_LEAD))).not.toContain("in 2009");
  });

  it("reads a taxobox, whose labels are plain cells ending in a colon", () => {
    expect(infoboxFacts(TAXOBOX)).toEqual([
      { label: "Domain", value: "Eukaryota" },
      { label: "Kingdom", value: "Animalia" },
      { label: "Phylum", value: "Mollusca" },
      { label: "Class", value: "Cephalopoda" },
    ]);
  });

  // Live check finding, with the markup copied verbatim from Brooklyn Bridge: a
  // coordinate ships THREE spellings of itself, two of them hidden (the DMS form
  // by TemplateStyles' `.geo-nondefault{display:none}`, the machine form by an
  // inline `display:none`). Without this the card read
  // "40.7057°N 73.9964°W / 40.7057; -73.9964".
  it("keeps only the visible form of a coordinate", () => {
    const geo = `<table class="infobox"><tbody><tr><th scope="row" class="infobox-label">Coordinates</th><td class="infobox-data"><span class="geo-inline"><span class="plainlinks nourlexpansion"><a class="external text" href="https://geohack.toolforge.org/geohack.php"><span class="geo-nondefault"><span class="geo-dms"><span class="latitude">40°42′21″N</span> <span class="longitude">73°59′47″W</span></span></span><span class="geo-multi-punct">&#xfeff; / &#xfeff;</span><span class="geo-default"><span class="geo-dec">40.7057°N 73.9964°W</span><span style="display:none">&#xfeff; / <span class="geo">40.7057; -73.9964</span></span></span></a></span></span></td></tr><tr><th scope="row" class="infobox-label">Opened</th><td class="infobox-data">1883</td></tr></tbody></table>`;
    expect(infoboxFacts(geo)).toEqual([
      { label: "Coordinates", value: "40.7057°N 73.9964°W" },
      { label: "Opened", value: "1883" },
    ]);
  });

  it("returns nothing when the page has no infobox", () => {
    expect(infoboxFacts(EULER_LEAD)).toEqual([]);
    expect(infoboxFacts(MOHS_TABLE)).toEqual([]);
  });

  it("never repeats a label (CardView keys its facts rows by label)", () => {
    const twice = TAXOBOX.replace(
      "<tr><td>Class:</td>",
      "<tr><td>Kingdom:</td><td>Duplicate</td></tr><tr><td>Class:</td>",
    );
    const labels = infoboxFacts(twice).map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.filter((l) => l === "Kingdom")).toHaveLength(1);
  });
});

describe("htmlBlocks", () => {
  it("returns paragraphs and tables in reading order", () => {
    const blocks = htmlBlocks(SECTION_WITH_TABLE, { caption: "Scale" });
    expect(blocks.map((b) => b.kind)).toEqual(["p", "table", "p"]);
    // The table sits right after the sentence that promises it. That is the whole
    // point of the phase.
    expect((blocks[0] as { text: string }).text).toContain("as the table below shows");
    expect(blocks[1].kind === "table" && blocks[1].table.caption).toBe("Scale");
  });

  it("skips the infobox and the empty paragraph in a real lead", () => {
    const blocks = htmlBlocks(BROOKLYN_LEAD);
    expect(blocks.every((b) => b.kind === "p")).toBe(true);
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as { text: string }).text).toMatch(/^The Brooklyn Bridge is a/);
  });

  it("does not treat a navbox or a banner as content", () => {
    expect(htmlBlocks(`<div>${AMBOX}${NAVBOX}</div>`)).toEqual([]);
  });

  it("marks math so the paragraph renders with KaTeX", () => {
    const blocks = htmlBlocks(EULER_LEAD);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { text: string }).text).toContain(MATH_OPEN);
  });
});

describe("takeBlocks", () => {
  const p = (text: string): Block => ({ kind: "p", text });
  const table = (): Block => ({
    kind: "table",
    table: { rows: [[{ text: "a" }, { text: "b" }]], headerRow: false, totalRows: 1, totalCols: 2 },
  });

  it("keeps the same paragraph caps as the plaintext path", () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`para ${i}`));
    const out = takeBlocks(many);
    expect(out.blocks).toHaveLength(8);
    expect(out.hasMore).toBe(true);
  });

  it("reports no more when the article fits", () => {
    const out = takeBlocks([p("one"), p("two")]);
    expect(out.hasMore).toBe(false);
  });

  it("stops on the character budget too", () => {
    const out = takeBlocks([p("x".repeat(3600)), p("next")]);
    expect(out.blocks).toHaveLength(1);
    expect(out.hasMore).toBe(true);
  });

  // Tables sit outside the paragraph budget on purpose: a table right after the
  // last affordable paragraph is the one that paragraph just promised.
  it("carries a table that follows the last paragraph across the budget line", () => {
    const blocks = [...Array.from({ length: 8 }, (_, i) => p(`para ${i}`)), table(), p("after")];
    const out = takeBlocks(blocks);
    expect(out.blocks.map((b) => b.kind)).toEqual([
      ...Array(8).fill("p"),
      "table",
    ]);
    expect(out.hasMore).toBe(true);
  });

  it("caps how many tables one card carries, and admits it did", () => {
    const out = takeBlocks([p("a"), table(), table(), table(), table(), p("b")]);
    expect(out.blocks.filter((b) => b.kind === "table")).toHaveLength(3);
    expect(out.hasMore).toBe(true);
  });

  it("joins the kept paragraphs into the plaintext the card falls back on", () => {
    const out = takeBlocks([p("one"), table(), p("two")]);
    expect(blocksToText(out.blocks)).toBe("one\n\ntwo");
  });
});
