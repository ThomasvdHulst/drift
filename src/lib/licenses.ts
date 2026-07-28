// ---------------------------------------------------------------------------
// The licence each source's content is under, and where its text lives.
//
// Why this exists as a module rather than as words in three page files: reusing
// Wikipedia text carries TWO obligations, and they are easy to conflate.
//
//   1. ATTRIBUTION. The WMF Terms of Use §7 accept "a hyperlink (where possible)
//      or URL to the article to which you contributed", because each article's
//      history page lists its authors. Every card already links to its article,
//      so this is satisfied, and the same link covers a table or an infobox taken
//      from that page: they are the same article text.
//
//   2. A LICENCE NOTICE. The same section requires "a licensing notice stating
//      which license the work is released under, along with either a hyperlink or
//      URL to the text of the license or a copy of the license itself"
//      (echoed by en.wikipedia.org/wiki/Wikipedia:Copyrights). Naming the licence
//      is not enough on its own: the notice has to reach the licence text.
//
// So the licence is named AND linked, on the card where the content is actually
// read, not only in the footer of the public pages.
//
// Only sources whose licence Drift can state precisely appear here: Wikipedia
// text (CC BY-SA 4.0 per the Terms of Use) and the Art Institute's open-access
// images (CC0, and the Gallery only ever serves `is_public_domain` works). Papers
// deliberately has no entry: arXiv abstracts are not ours to label, so the card
// links to the paper and claims nothing.
//
// Non-free media is a separate matter and stays OUT of Drift by construction:
// WP:Copyrights notes fair-use files are "not under the CC BY-SA or GFDL license
// as such", so `prop=pageimages` is pinned to `pilicense=free` (see
// lib/wiki-server.ts) and the table parser drops <img> entirely.
// ---------------------------------------------------------------------------

import type { SourceId } from "./realms/types";

export interface ContentLicense {
  /** Short human name, shown as the notice. */
  label: string;
  /** The licence text itself, which the notice has to link. */
  url: string;
}

export const CC_BY_SA_4: ContentLicense = {
  label: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export const CC0_1: ContentLicense = {
  label: "CC0 1.0",
  url: "https://creativecommons.org/publicdomain/zero/1.0/",
};

/** The licence notice for a card's source, or null when Drift has no precise
 *  claim to make (in which case the card links to the source and says nothing). */
export function licenseFor(source?: SourceId): ContentLicense | null {
  // A card with no `source` is a Wikipedia card (the field arrived with realms;
  // older saved trails omit it) — see types.ts.
  if (!source || source === "wikipedia") return CC_BY_SA_4;
  if (source === "artic") return CC0_1;
  return null;
}
