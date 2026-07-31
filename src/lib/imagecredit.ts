// ---------------------------------------------------------------------------
// Per-image credit for Wikipedia card images.
//
// WHY THIS EXISTS. A Wikipedia article's text is CC BY-SA 4.0, and linking to the
// article satisfies attribution for it, because the article's history page lists
// its authors. An image on that article is a SEPARATE WORK: a different creator,
// its own licence, and its own file description page. Drift used to show the
// article's licence next to the image and link only to the article, which asserts
// CC BY-SA over files that may be CC BY, CC0, GFDL or public domain, and credits
// the wrong people or nobody (compliance audit B-4).
//
// `pilicense=free` is still right and still set: it excludes files a wiki hosts
// under a non-free Exemption Doctrine Policy, i.e. fair use. But "free" there
// means "not tagged non-free", NOT "no attribution required". So each file's own
// licence and creator have to be read from the file itself, which is what this
// module parses.
//
// FAIL CLOSED. Two rules, and both drop the IMAGE rather than the card:
//   1. `AttributionRequired` is true and no usable creator ⇒ do not display.
//   2. `Restrictions` is non-empty ⇒ do not display. That field flags trademark
//      and personality-rights encumbrances: files that are copyright-free but not
//      use-free.
// A card without a picture is a small loss. An uncredited CC BY-SA photograph is
// a licence breach, and under §6(a) it terminates our rights automatically.
//
// Pure and React-free: the network call lives in `wiki-server.ts`.
// ---------------------------------------------------------------------------

/** What Drift needs in order to display one image lawfully. */
export interface ImageCredit {
  /** Creator as designated by the licensor, plain text. */
  artist?: string;
  /** The licensor's own requested credit string, if it supplied one. Takes
   *  precedence over `artist`: CC BY-SA 4.0 §3(a)(1)(A)(i) says attribution must
   *  be given "in any reasonable manner requested by the Licensor". */
  attribution?: string;
  /** Short licence name, e.g. "CC BY-SA 4.0" or "Public domain". */
  licenseShortName?: string;
  /** URL of the licence text, for the hyperlink the notice must carry. */
  licenseUrl?: string;
  /** The file's own title, e.g. "The Great Wave off Kanagawa". */
  objectName?: string;
  /** The file description page: the §3(a)(2) "resource that includes the
   *  required information". */
  fileUrl?: string;
  /** Whether the licence requires attribution at all. */
  attributionRequired: boolean;
  /** Non-empty when the file carries trademark / personality-rights flags. */
  restrictions?: string;
}

/**
 * One key for a file, whichever spelling it arrived in.
 *
 * `piprop=name` returns "Claude_Monet_1899_Nadar_crop.jpg" with underscores,
 * while the `titles` of an `imageinfo` response come back normalised to spaces
 * ("File:Claude Monet 1899 Nadar crop.jpg"). Looking one up with the other silently
 * found nothing, and because the credit is fail-closed that turned into "no card
 * shows a picture". Found by testing against the live API, not by reading the code.
 */
export function fileKey(name: string): string {
  return name.replace(/^File:/i, "").replace(/_/g, " ").trim();
}

/** One `extmetadata` entry as the API returns it. */
interface ExtValue {
  value?: unknown;
}
type ExtMetadata = Record<string, ExtValue | undefined>;

/** Strip the HTML Wikimedia embeds in `Artist` and `Credit` (they routinely carry
 *  `<a>`, `<span>` and `<bdi>`), decode the handful of entities that survive, and
 *  collapse whitespace. Returns "" for anything that reduces to nothing. */
export function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function field(meta: ExtMetadata, key: string): string {
  return plainText(meta[key]?.value);
}

/**
 * Build an ImageCredit from an `imageinfo` entry.
 *
 * `attributionRequired` defaults to TRUE when the field is absent. That is the
 * safe direction: a missing flag means we do not know, and not knowing must not
 * silently become "no credit needed". Only an explicit false, or a licence we
 * recognise as public domain, turns it off.
 */
export function parseImageCredit(
  extmetadata: unknown,
  descriptionurl?: unknown,
): ImageCredit {
  const meta = (extmetadata ?? {}) as ExtMetadata;
  const licenseShortName = field(meta, "LicenseShortName");
  const raw = meta["AttributionRequired"]?.value;
  const explicitlyNotRequired =
    typeof raw === "string" ? /^(false|0|no)$/i.test(raw.trim()) : raw === false;

  return {
    artist: field(meta, "Artist") || undefined,
    attribution: field(meta, "Attribution") || undefined,
    licenseShortName: licenseShortName || undefined,
    licenseUrl: field(meta, "LicenseUrl") || undefined,
    objectName: field(meta, "ObjectName") || undefined,
    fileUrl: typeof descriptionurl === "string" ? descriptionurl : undefined,
    attributionRequired:
      !explicitlyNotRequired && !isPublicDomainLicense(licenseShortName),
    restrictions: field(meta, "Restrictions") || undefined,
  };
}

/** Licence names that carry no attribution condition. Matched loosely because
 *  `LicenseShortName` is free text set per-file on the wiki: "CC0", "CC0 1.0",
 *  "Public domain", "PD-US", "No restrictions" all occur. */
export function isPublicDomainLicense(shortName?: string): boolean {
  if (!shortName) return false;
  return /\b(cc0|public\s*domain|pd(-|\b)|no\s+restrictions)/i.test(shortName);
}

/**
 * The credit line a card renders, or null when there is nothing to say (a public
 * domain file with no named creator). Never returns a partial credit: if a
 * creator is required and missing, `mayDisplayImage` has already refused the
 * image, so this is only ever called for a displayable one.
 */
export function creditLine(credit: ImageCredit): string | null {
  const who = credit.attribution || credit.artist;
  const parts: string[] = [];
  if (who) parts.push(who);
  if (credit.licenseShortName) parts.push(credit.licenseShortName);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Whether an image may be shown at all. This is the fail-closed gate.
 *
 * Unknown credit (no `imageinfo` yet, or the lookup failed) returns false: a card
 * saved before this existed, or fetched during an upstream hiccup, shows no
 * picture rather than an uncredited one. Callers that want a picture must fetch
 * the credit first.
 */
export function mayDisplayImage(credit?: ImageCredit | null): boolean {
  if (!credit) return false;
  // Trademark / personality rights: copyright-free is not use-free.
  if (credit.restrictions) return false;
  if (!credit.attributionRequired) return true;
  return !!(credit.attribution || credit.artist);
}
