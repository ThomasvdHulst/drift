import { NextResponse } from "next/server";
import { wikiQuery, CARD_PROPS } from "@/lib/wiki-server";
import { firstPage, actionPageToCard } from "@/lib/wiki";
import { topParagraphs } from "@/lib/extract";

export const dynamic = "force-dynamic";

// GET /api/wiki/summary?title=Octopus → a Card for a specific page. Used for seed
// entry and any time we need canonical data for an exact title.
//
// ?full=1     drops the sentence cap so the extract is the whole intro.
// ?extended=1 returns the first several BODY paragraphs for "Read more":
//             `{ extract, hasMore }`. The API's exchars/exsentences caps can't
//             exceed the lead, so we pull the full plaintext (no exintro,
//             exsectionformat=wiki) and slice it server-side (see lib/extract).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const full = url.searchParams.get("full") === "1";
  const extended = url.searchParams.get("extended") === "1";
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  try {
    if (extended) {
      const raw = await wikiQuery({
        titles: title,
        redirects: "1",
        prop: "extracts",
        explaintext: "1",
        exsectionformat: "wiki",
        format: "json",
        formatversion: "2",
      });
      const page = firstPage(raw);
      if (!page || page.missing) {
        return NextResponse.json({ error: "page not found" }, { status: 404 });
      }
      const { text, hasMore } = topParagraphs(page.extract ?? "");
      return NextResponse.json({ extract: text, hasMore });
    }

    const props = { ...CARD_PROPS };
    if (full) delete (props as Record<string, string>).exsentences;
    const raw = await wikiQuery({ titles: title, redirects: "1", ...props });
    const page = firstPage(raw);
    if (!page || page.missing || !page.title) {
      return NextResponse.json({ error: "page not found" }, { status: 404 });
    }
    return NextResponse.json(actionPageToCard(page));
  } catch (err) {
    console.error("[api/wiki/summary]", err);
    return NextResponse.json({ error: "page not found" }, { status: 404 });
  }
}
