// Static example content for the logged-out landing page (see the landing plan).
// Everything here is bundled + hand-authored — the marketing page never makes a
// live Wikipedia/AIC call (respects §2 and avoids rate limits). The demo graph is
// a small, fully-connected "rabbit hole" so a visitor can keep pulling threads and
// always land on a real card. It's a true wander — The Great Wave → Ukiyo-e →
// Impressionism → Monet (ukiyo-e genuinely shaped the Impressionists) — and each
// card is illustrated by a CC0 public-domain artwork from the Art Institute of
// Chicago (the Gallery realm's own source), so there's no attribution baggage.

import type { ThreadKind, TrailStep } from "@/lib/types";

export type DemoThread = {
  kind: ThreadKind;
  label: string;
  to: string; // id of the DemoCard this thread pulls you to (always in the graph)
};

export type DemoCard = {
  id: string;
  title: string;
  description: string; // short subtitle, like a card's `description`
  extract: string; // a one or two sentence hook
  image: string; // bundled under /public/landing
  threads: DemoThread[];
};

// The demo rabbit hole. Every thread `to` resolves to another card here — asserted
// by data.test.ts so a typo can never ship a dead-end chip.
export const DEMO_CARDS: DemoCard[] = [
  {
    id: "great-wave",
    title: "The Great Wave off Kanagawa",
    description: "Woodblock print · Hokusai, c. 1831",
    extract:
      "A towering wave curls over three boats while Mount Fuji sits small and calm in the distance.",
    image: "/landing/great-wave.jpg",
    threads: [
      { kind: "zoomout", label: "Ukiyo-e", to: "ukiyo-e" },
      { kind: "tangent", label: "Impressionism", to: "impressionism" },
      { kind: "nearby", label: "Mount Fuji", to: "fuji" },
    ],
  },
  {
    id: "fuji",
    title: "Mount Fuji",
    description: "Volcano · Honshū, Japan",
    extract:
      "Japan's highest peak, a sacred and active volcano painted and printed for centuries.",
    image: "/landing/fuji.jpg",
    threads: [
      { kind: "nearby", label: "The Great Wave", to: "great-wave" },
      { kind: "tangent", label: "Ukiyo-e", to: "ukiyo-e" },
    ],
  },
  {
    id: "ukiyo-e",
    title: "Ukiyo-e",
    description: "Japanese art · 17th to 19th century",
    extract:
      "Woodblock prints of 'the floating world': actors, courtesans, and the landscapes of Edo Japan.",
    image: "/landing/ukiyo-e.jpg",
    threads: [
      { kind: "deeper", label: "The Great Wave", to: "great-wave" },
      { kind: "tangent", label: "Impressionism", to: "impressionism" },
    ],
  },
  {
    id: "impressionism",
    title: "Impressionism",
    description: "Art movement · Paris, 1870s",
    extract:
      "Loose brushwork chasing light and the fleeting moment. It borrowed boldly from Japanese prints.",
    image: "/landing/impressionism.jpg",
    threads: [
      { kind: "deeper", label: "Claude Monet", to: "monet" },
      { kind: "tangent", label: "Ukiyo-e", to: "ukiyo-e" },
      { kind: "nearby", label: "Paris Street; Rainy Day", to: "rainy-day" },
    ],
  },
  {
    id: "monet",
    title: "Claude Monet",
    description: "Painter · 1840 to 1926",
    extract:
      "The founder of Impressionism, who painted haystacks and water lilies over and over to catch the shifting light.",
    image: "/landing/monet.jpg",
    threads: [
      { kind: "zoomout", label: "Impressionism", to: "impressionism" },
      { kind: "nearby", label: "Paris Street; Rainy Day", to: "rainy-day" },
    ],
  },
  {
    id: "rainy-day",
    title: "Paris Street; Rainy Day",
    description: "Painting · Caillebotte, 1877",
    extract:
      "A wide boulevard of the newly rebuilt Paris under a soft grey drizzle, by Gustave Caillebotte.",
    image: "/landing/rainy-day.jpg",
    threads: [
      { kind: "zoomout", label: "Impressionism", to: "impressionism" },
      { kind: "nearby", label: "Claude Monet", to: "monet" },
    ],
  },
];

export const DEMO_START_ID = "great-wave";

/** Look up a demo card by id. Pure; returns undefined if the id isn't in the graph. */
export function demoCardById(id: string): DemoCard | undefined {
  return DEMO_CARDS.find((c) => c.id === id);
}

/**
 * Resolve where a thread leads. Pure — used by the interactive demo to advance.
 * Returns undefined only if the graph is malformed (guarded against by tests).
 */
export function nextCard(id: string): DemoCard | undefined {
  return demoCardById(id);
}

// ---------------------------------------------------------------------------
// The example trail map (the "reward" section reuses the real <TrailMap/>). A
// short, hand-authored wander through a subset of the demo cards, with a mix of
// thread-pulls and a drift so the map shows both edge styles (solid sage vs
// dotted grey). Images reuse the same CC0 artworks, so titles + thumbnails match.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Example trails for the "reward" section. Each is a short, hand-authored wander
// the real <TrailMap/> renders. The landing shows a RANDOM one per visit, so the
// page feels a little fresh each time. To add or edit a trail: drop a matching
// CC0/public-domain image in public/landing/, then add a `trail([...])` below.
//
// A stop is `[title, image, via]`. `via` is one of: seed() for the first stop,
// thread(label, kind) for a pulled thread (kind = deeper | zoomout | tangent |
// nearby → sets the edge glyph), or drift() for a wander (a dotted grey edge).
// Only the title + image are drawn, so the rest is kept minimal.
//
// Imagery credits (all publish-safe): art + ancient = the Art Institute of
// Chicago (CC0); nature = Ernst Haeckel plates (public domain); cosmos =
// NASA/ESA/Hubble (public domain).
// ---------------------------------------------------------------------------

type Via = TrailStep["arrivedVia"];
const seed = (title: string): Via => ({ type: "seed", seedName: title });
const thread = (label: string, kind: ThreadKind): Via => ({
  type: "thread",
  label,
  kind,
  fromTitle: "",
});
const drift = (): Via => ({ type: "drift" });

type Stop = [title: string, image: string, via: Via];

// A fixed base time so the examples are deterministic (no Date.now()). The value
// is irrelevant: the trail map never renders timestamps.
const T0 = 1_700_000_000_000;

function trail(stops: Stop[]): TrailStep[] {
  return stops.map(([title, image, via], i) => ({
    card: {
      pageTitle: `${title}#${i}`,
      displayTitle: title,
      extract: "",
      imageUrl: image,
      sourceUrl: "#",
    },
    arrivedVia: via,
    timestamp: T0 + i * 60_000,
    expanded: false,
  }));
}

export const EXAMPLE_TRAILS: TrailStep[][] = [
  // Japanese prints and the Impressionists they inspired.
  trail([
    ["The Great Wave off Kanagawa", "/landing/great-wave.jpg", seed("The Great Wave off Kanagawa")],
    ["Ukiyo-e", "/landing/ukiyo-e.jpg", thread("Ukiyo-e", "zoomout")],
    ["Impressionism", "/landing/impressionism.jpg", thread("Impressionism", "tangent")],
    ["Claude Monet", "/landing/monet.jpg", thread("Claude Monet", "deeper")],
    ["Paris Street; Rainy Day", "/landing/rainy-day.jpg", drift()],
  ]),
  // From a stellar nursery out to a galaxy, then home again.
  trail([
    ["Pillars of Creation", "/landing/cosmos-nebula.jpg", seed("Pillars of Creation")],
    ["The Whirlpool Galaxy", "/landing/cosmos-galaxy.jpg", thread("The Whirlpool Galaxy", "zoomout")],
    ["Saturn", "/landing/cosmos-saturn.jpg", drift()],
    ["Jupiter", "/landing/cosmos-jupiter.jpg", thread("Jupiter", "nearby")],
    ["Earthrise", "/landing/cosmos-earth.jpg", thread("Earthrise", "tangent")],
  ]),
  // A wander through the soft-bodied creatures of the sea (Haeckel plates).
  trail([
    ["Octopus", "/landing/nature-octopus.jpg", seed("Octopus")],
    ["Jellyfish", "/landing/nature-jellyfish.jpg", thread("Jellyfish", "tangent")],
    ["Siphonophores", "/landing/nature-siphonophore.jpg", thread("Siphonophores", "nearby")],
    ["Sea anemones", "/landing/nature-anemone.jpg", drift()],
    ["Nudibranchs", "/landing/nature-slug.jpg", thread("Nudibranchs", "deeper")],
  ]),
  // Across the ancient world, from Greek pottery to imperial Rome.
  trail([
    ["Greek amphora", "/landing/ancient-amphora.jpg", seed("Greek amphora")],
    ["Greek kylix", "/landing/ancient-kylix.jpg", thread("Greek kylix", "deeper")],
    ["Statue of Horus", "/landing/ancient-horus.jpg", thread("Statue of Horus", "tangent")],
    ["Emperor Hadrian", "/landing/ancient-hadrian.jpg", drift()],
    ["Greek funerary stele", "/landing/ancient-stele.jpg", thread("Greek funerary stele", "nearby")],
  ]),
];
