// ---------------------------------------------------------------------------
// "Download your data": one JSON file with everything Drift holds about you.
//
// WHY IT EXISTS. GDPR Article 20 gives you the right to receive the personal
// data you provided "in a structured, commonly used and machine-readable
// format", and Article 15 gives you the right to a copy of what is held. Neither
// requires a self-service button; both require the request to be FULFILLED
// within a month (Article 12(3)). A button is a couple of hours, removes the
// month, and removes the standing task of writing a query by hand each time,
// which is the sort of task that is never actually done (compliance audit Mi-3).
//
// SCOPE. Article 20 covers data you PROVIDED. The derived interest weightings
// are arguably inferred rather than provided, and inferred data falls outside
// Article 20 on the Article 29 Working Party's reading. They are included
// anyway: it is easier than arguing about it, and a person asking what Drift
// knows about them deserves the honest answer rather than the minimum one.
//
// The builder is pure so the shape can be tested without a browser or a
// database; account/page.tsx does the gathering and the download.
// ---------------------------------------------------------------------------

import type { Trail, SessionStats } from "./types";
import type { Interest, Reaction } from "./interest";

/** Everything the export can carry. Cloud-only sections are absent, not empty,
 *  when signed out or when the social feature is off, so a reader can tell
 *  "there is none of this" from "this was not looked at". */
export interface DataExportParts {
  account?: { id: string; email?: string; createdAt?: string };
  trails?: Trail[];
  reactions?: Record<string, Reaction>;
  interests?: Interest;
  settings?: unknown;
  seen?: string[];
  sessions?: SessionStats[];
  profile?: unknown;
  friends?: unknown;
  shares?: unknown;
  /** Public share links (Phase 27), including ones already withdrawn. Revoking
   *  is a timestamp rather than a delete precisely so that "I shared this once
   *  and stopped" is answerable, and an export that hid withdrawn links would
   *  be a less complete answer than the database can give. */
  shareLinks?: unknown;
}

export interface DataExport extends DataExportParts {
  drift: {
    export: "personal-data";
    version: 1;
    exportedAt: string;
    /** Plain English, in the file, because the file may be read years later by
     *  someone who has never seen this app. */
    about: string;
    rights: string;
  };
}

export const EXPORT_ABOUT =
  "This file is a copy of the personal data Drift holds about one account. It was produced by that account's own owner from the account page.";

export const EXPORT_RIGHTS =
  "It is provided under Articles 15 and 20 of the GDPR (the rights of access and of data portability). Sections that are absent were not held: an absent section is not the same as an empty one. See https://www.usedrift.org/privacy.";

/**
 * Assemble the export. `now` is injected so the test does not depend on a clock.
 *
 * Undefined sections are dropped rather than serialised as `null`, so the file
 * says only what is true. `JSON.stringify` would drop them anyway; doing it here
 * means the object handed to the test is the object written to the file.
 */
export function buildDataExport(
  parts: DataExportParts,
  now: Date = new Date(),
): DataExport {
  const held = Object.fromEntries(
    Object.entries(parts).filter(([, value]) => value !== undefined),
  ) as DataExportParts;
  return {
    drift: {
      export: "personal-data",
      version: 1,
      exportedAt: now.toISOString(),
      about: EXPORT_ABOUT,
      rights: EXPORT_RIGHTS,
    },
    ...held,
  };
}

/** The filename, dated so two exports do not overwrite each other in a downloads
 *  folder. `YYYY-MM-DD`, which sorts. */
export function dataExportFilename(now: Date = new Date()): string {
  return `drift-data-${now.toISOString().slice(0, 10)}.json`;
}
