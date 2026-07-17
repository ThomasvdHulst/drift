// Static example content for the logged-out landing page (see the landing plan).
// Everything here is bundled + hand-authored — the marketing page never makes a
// live Wikipedia/AIC call (respects §2 and avoids rate limits). The demo graph is
// a small, fully-connected "rabbit hole" so a visitor can keep pulling threads and
// always land on a real card. It's a true wander — The Great Wave → Ukiyo-e →
// Impressionism → Monet (ukiyo-e genuinely shaped the Impressionists) — and each
// card is illustrated by a CC0 public-domain artwork from the Art Institute of
// Chicago (the Gallery realm's own source), so there's no attribution baggage.

import type { Card, ThreadKind, TrailStep } from "@/lib/types";

export type DemoThread = {
  kind: ThreadKind;
  label: string;
  to: string; // id of the DemoCard this thread pulls you to (always in the graph)
};

export type DemoCard = {
  id: string;
  title: string;
  description: string; // short subtitle, like a card's `description`
  extract: string; // a 1–2 sentence hook
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
      "Japan's highest peak — a sacred, active volcano painted and printed for centuries.",
    image: "/landing/fuji.jpg",
    threads: [
      { kind: "nearby", label: "The Great Wave", to: "great-wave" },
      { kind: "tangent", label: "Ukiyo-e", to: "ukiyo-e" },
    ],
  },
  {
    id: "ukiyo-e",
    title: "Ukiyo-e",
    description: "Japanese art · 17th–19th century",
    extract:
      "Woodblock prints of 'the floating world' — actors, courtesans, and the landscapes of Edo-era Japan.",
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
      "Loose brushwork chasing light and the fleeting moment — and it borrowed boldly from Japanese prints.",
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
    description: "Painter · 1840–1926",
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

function demoToCard(d: DemoCard): Card {
  return {
    pageTitle: d.id,
    displayTitle: d.title,
    description: d.description,
    extract: d.extract,
    imageUrl: d.image,
    sourceUrl: "#",
    source: "artic",
  };
}

// A fixed base time so the example is deterministic (no Date.now()). The exact
// value is irrelevant — the trail map doesn't render timestamps.
const T0 = 1_700_000_000_000;

export const EXAMPLE_TRAIL: TrailStep[] = [
  {
    card: demoToCard(DEMO_CARDS[0]), // The Great Wave
    arrivedVia: { type: "seed", seedName: "The Great Wave off Kanagawa" },
    timestamp: T0,
    expanded: false,
  },
  {
    card: demoToCard(DEMO_CARDS[2]), // Ukiyo-e
    arrivedVia: {
      type: "thread",
      label: "Ukiyo-e",
      fromTitle: "great-wave",
      kind: "zoomout",
    },
    timestamp: T0 + 60_000,
    expanded: true,
  },
  {
    card: demoToCard(DEMO_CARDS[3]), // Impressionism
    arrivedVia: {
      type: "thread",
      label: "Impressionism",
      fromTitle: "ukiyo-e",
      kind: "tangent",
    },
    timestamp: T0 + 120_000,
    expanded: false,
  },
  {
    card: demoToCard(DEMO_CARDS[4]), // Claude Monet
    arrivedVia: {
      type: "thread",
      label: "Claude Monet",
      fromTitle: "impressionism",
      kind: "deeper",
    },
    timestamp: T0 + 180_000,
    expanded: false,
  },
  {
    card: demoToCard(DEMO_CARDS[5]), // Paris Street; Rainy Day (a drift)
    arrivedVia: { type: "drift", topic: { id: "art", label: "Art & design" } },
    timestamp: T0 + 240_000,
    expanded: false,
  },
];
