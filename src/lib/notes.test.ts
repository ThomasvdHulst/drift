import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NOTES, noteBySlug, formatNoteDate } from "./notes";

const NOTES_DIR = join(process.cwd(), "src", "app", "(app)", "notes");

describe("notes registry — identity", () => {
  it("has notes, each with every field filled", () => {
    expect(NOTES.length).toBeGreaterThan(0);
    for (const n of NOTES) {
      expect(n.slug, "slug").toBeTruthy();
      expect(n.title, n.slug).toBeTruthy();
      expect(n.description, n.slug).toBeTruthy();
      expect(n.excerpt, n.slug).toBeTruthy();
    }
  });

  it("has unique, URL-safe slugs", () => {
    const seen = new Set<string>();
    for (const n of NOTES) {
      expect(n.slug, `duplicate slug ${n.slug}`).not.toBe(
        seen.has(n.slug) ? n.slug : "",
      );
      seen.add(n.slug);
      // Lowercase, hyphen-separated, no leading/trailing/double hyphen: the slug
      // IS the URL, so a stray character would ship a broken canonical link.
      expect(n.slug, n.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(seen.size).toBe(NOTES.length);
  });

  it("has plain ISO dates, newest first", () => {
    for (const n of NOTES) expect(n.date, n.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = NOTES.map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("keeps descriptions inside the length a search result shows", () => {
    // Google truncates around 160 characters; past that the tail is invisible
    // and the page reads as if it trails off.
    for (const n of NOTES) {
      expect(n.description.length, `${n.slug} description`).toBeLessThanOrEqual(200);
      expect(n.description.length, `${n.slug} description`).toBeGreaterThan(50);
    }
  });
});

describe("notes registry — copy rules", () => {
  // The standing house rule for reader-facing copy: no em or en dashes, the same
  // check the topic and news registries carry.
  it("uses no em or en dashes", () => {
    for (const n of NOTES) {
      expect(n.title, n.slug).not.toMatch(/[—–]/);
      expect(n.description, n.slug).not.toMatch(/[—–]/);
      expect(n.excerpt, n.slug).not.toMatch(/[—–]/);
    }
  });
});

describe("notes registry — every note has a page", () => {
  // The registry feeds the index AND the sitemap, so a slug with no route would
  // submit a 404 to Google and show a dead card on /notes. The two live in
  // different files by necessity (a body is JSX, src/lib is React-free), so this
  // is the seam that keeps them honest, in both directions.
  it("resolves each slug to a real page file", () => {
    for (const n of NOTES) {
      const page = join(NOTES_DIR, n.slug, "page.tsx");
      expect(existsSync(page), `missing route for ${n.slug}: ${page}`).toBe(true);
    }
  });

  it("has no orphan page without a registry entry", async () => {
    const { readdirSync } = await import("node:fs");
    const dirs = readdirSync(NOTES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const slugs = new Set(NOTES.map((n) => n.slug));
    for (const d of dirs) {
      expect(slugs.has(d), `orphan note route /notes/${d} is in no registry`).toBe(
        true,
      );
    }
  });
});

describe("noteBySlug", () => {
  it("finds a note and returns null for an unknown slug", () => {
    expect(noteBySlug(NOTES[0].slug)?.title).toBe(NOTES[0].title);
    expect(noteBySlug("not-a-note")).toBeNull();
    expect(noteBySlug("")).toBeNull();
  });
});

describe("formatNoteDate", () => {
  it("renders a plain, locale-free date", () => {
    expect(formatNoteDate("2026-07-28")).toBe("28 July 2026");
    expect(formatNoteDate("2026-01-01")).toBe("1 January 2026");
    expect(formatNoteDate("2026-12-31")).toBe("31 December 2026");
  });

  it("passes anything that is not a plain ISO date straight through", () => {
    expect(formatNoteDate("soon")).toBe("soon");
    expect(formatNoteDate("2026-13-01")).toBe("2026-13-01"); // no month 13
  });
});
