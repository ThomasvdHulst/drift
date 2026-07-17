import type { MetadataRoute } from "next";

// Web app manifest (Phase 13) — makes Drift installable to a phone home screen and
// launchable standalone (no browser chrome). Next serves this at /manifest.webmanifest
// and auto-links it. Colors mirror the "quiet reading room" palette in globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drift: pull a thread, see where it goes",
    short_name: "Drift",
    description:
      "A calm feed of knowledge cards where you are the algorithm. Pull threads to steer your own rabbit hole.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe4",
    theme_color: "#6f8f74",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
