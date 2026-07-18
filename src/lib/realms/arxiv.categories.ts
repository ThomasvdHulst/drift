// Browseable arXiv buckets + the "field" styling map (Papers realm, Phase 17).
// The Papers analog of artic.buckets.ts. Pure data — no network, no React — so
// the discover route and the card cover both read from one source of truth.
//
// A *bucket* is a homepage tile / discover theme (one arXiv category). A *field
// group* is the broad discipline a paper's PRIMARY category belongs to; it drives
// the card's generated cover (hue + motif), so a card is themed by the paper's
// real field, not just the bucket it was discovered through.

export type FieldGroup =
  | "cs"
  | "physics"
  | "math"
  | "bio"
  | "stats"
  | "econ"
  | "eess"
  | "qfin"
  | "other";

/** The motif drawn (faintly) on a paper's cover, one per field group. */
export type MotifId =
  | "graph" // cs — nodes + edges
  | "orbits" // physics — concentric orbits + particles
  | "grid" // math — lattice of dots/lines
  | "cells" // bio — hex cells
  | "curve" // stats — a distribution bell
  | "trend" // econ — rising trend lines
  | "wave" // eess — a waveform
  | "bars"; // qfin — bars / flow

export interface FieldStyle {
  label: string; // human name of the discipline
  hue: string; // base hue (hex) for the cover gradient + motif; muted, warm
  motif: MotifId;
}

// Muted, quiet-reading-room hues (no neon). Each group is visually distinct but
// all sit in the same calm register; the cover layers them at low alpha over the
// paper/ink base, so they read in both light and dark themes.
export const FIELD_STYLES: Record<FieldGroup, FieldStyle> = {
  cs: { label: "Computer Science", hue: "#6b74a6", motif: "graph" },
  physics: { label: "Physics", hue: "#7d6a9c", motif: "orbits" },
  math: { label: "Mathematics", hue: "#4f8a86", motif: "grid" },
  bio: { label: "Quantitative Biology", hue: "#6d8a5a", motif: "cells" },
  stats: { label: "Statistics", hue: "#b0894f", motif: "curve" },
  econ: { label: "Economics", hue: "#a9736b", motif: "trend" },
  eess: { label: "Electrical Engineering", hue: "#5f8296", motif: "wave" },
  qfin: { label: "Quantitative Finance", hue: "#8a7d4a", motif: "bars" },
  other: { label: "Research", hue: "#6f83a6", motif: "grid" },
};

/** Map an arXiv category string (e.g. "cs.LG", "astro-ph.GA", "q-bio.PE") to the
 *  broad field group that themes the card. Order matters (check specific
 *  prefixes before the physics catch-alls). Unknown ⇒ "other". */
export function categoryGroupOf(category: string | undefined): FieldGroup {
  const c = (category ?? "").toLowerCase().trim();
  if (!c) return "other";
  if (c.startsWith("cs.")) return "cs";
  if (c.startsWith("q-bio")) return "bio";
  if (c.startsWith("q-fin")) return "qfin";
  if (c.startsWith("stat.")) return "stats";
  if (c.startsWith("econ.")) return "econ";
  if (c.startsWith("eess.")) return "eess";
  if (c.startsWith("math.") || c === "math-ph" || c.startsWith("math-ph"))
    return c.startsWith("math-ph") ? "physics" : "math";
  // Physics umbrella: astro-ph, cond-mat, gr-qc, hep-*, nucl-*, quant-ph,
  // nlin.*, physics.*, and bare "physics".
  if (
    c.startsWith("astro-ph") ||
    c.startsWith("cond-mat") ||
    c.startsWith("gr-qc") ||
    c.startsWith("hep-") ||
    c.startsWith("nucl-") ||
    c.startsWith("quant-ph") ||
    c.startsWith("nlin") ||
    c.startsWith("physics")
  )
    return "physics";
  return "other";
}

export interface ArxivBucket {
  id: string; // stable bucket id (also the discover `bucket` value)
  label: string; // homepage tile + "why this card" label
  glyph: string; // small mark on the tile
  tint: string; // soft background tint for the homepage tile
  blurb: string; // one-line description under the tile
  group: FieldGroup; // themes the tile + the default cover for the bucket
  query: string; // arXiv `search_query` fragment (never user input → injection-safe)
}

// ~12 recognizable, interesting buckets spread across the disciplines. `query` is
// a fixed arXiv category filter; it is NEVER built from user input, so the route's
// allowlist (arxivBucketById) is the injection guard.
export const ARXIV_BUCKETS: ArxivBucket[] = [
  { id: "ml", label: "Machine Learning", glyph: "◇", tint: "#e2e4f0", blurb: "How machines learn from data", group: "cs", query: "cat:cs.LG" },
  { id: "ai", label: "Artificial Intelligence", glyph: "◈", tint: "#e4e3ef", blurb: "Reasoning, agents, and planning", group: "cs", query: "cat:cs.AI" },
  { id: "nlp", label: "Language & NLP", glyph: "❝", tint: "#e6e2ee", blurb: "Teaching computers to read and write", group: "cs", query: "cat:cs.CL" },
  { id: "astro", label: "Astrophysics", glyph: "✦", tint: "#e7e1ef", blurb: "Galaxies, stars, and the cosmos", group: "physics", query: "cat:astro-ph.GA" },
  { id: "quantum", label: "Quantum Physics", glyph: "◐", tint: "#e8e1ee", blurb: "The strange rules of the very small", group: "physics", query: "cat:quant-ph" },
  { id: "number-theory", label: "Number Theory", glyph: "∑", tint: "#dceceb", blurb: "The deep structure of numbers", group: "math", query: "cat:math.NT" },
  { id: "combinatorics", label: "Combinatorics", glyph: "◫", tint: "#dcebe9", blurb: "Counting, graphs, and arrangements", group: "math", query: "cat:math.CO" },
  { id: "evolution", label: "Evolution & Ecology", glyph: "❦", tint: "#e2ecda", blurb: "Populations, species, and change", group: "bio", query: "cat:q-bio.PE" },
  { id: "statistics", label: "Statistics", glyph: "◔", tint: "#efe6d4", blurb: "Making sense of uncertainty", group: "stats", query: "cat:stat.ME" },
  { id: "economics", label: "Economics", glyph: "◇", tint: "#efe0dd", blurb: "Markets, incentives, and behavior", group: "econ", query: "cat:econ.GN" },
  { id: "signal", label: "Signal Processing", glyph: "∿", tint: "#dee7ec", blurb: "Sound, images, and data streams", group: "eess", query: "cat:eess.SP" },
  { id: "finance", label: "Math Finance", glyph: "▤", tint: "#eae6d3", blurb: "The mathematics of markets", group: "qfin", query: "cat:q-fin.MF" },
];

/** The bucket for an id, or undefined (the discover route's injection guard). */
export function arxivBucketById(id: string): ArxivBucket | undefined {
  return ARXIV_BUCKETS.find((b) => b.id === id);
}
