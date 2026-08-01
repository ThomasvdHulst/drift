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
    // What happens when a link into Drift is opened and Drift is installed
    // (Phase 27, where the links are share links arriving from a chat app).
    //
    // Chrome CAPTURES in-scope links into an installed PWA by default, so on
    // Android this already worked; `client_mode` only decides which window. The
    // default would open a fresh one each time, which after three shared links
    // leaves three Drift windows. `navigate-existing` reuses the one that is
    // already open and takes it to the link, which is what a reader means by
    // "open it in the app".
    //
    // ⚠️ This does NOTHING on iOS, and no manifest field can. A home-screen web
    // app there cannot claim links: taps in WhatsApp open Safari or an in-app
    // browser, always, and there is no universal-links equivalent without a
    // native app. Worse for a shared link, an iOS PWA's storage is a separate
    // container from Safari's, so a reader signed in inside their installed
    // Drift arrives signed out. /s/<token> is built to be worth reading signed
    // out precisely because of this.
    launch_handler: { client_mode: "navigate-existing" },
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
