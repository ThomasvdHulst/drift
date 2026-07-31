import { toPng } from "html-to-image";

// Browser-only: rasterize a trail-map DOM node to a PNG and trigger a download.
// Kept out of export.ts so the pure `trailToText` stays importable in unit tests
// without html-to-image.
//
// IMAGES ARE EXCLUDED FROM THE EXPORT, deliberately. On screen the trail map
// shows each stop's picture, and that is fine: it is a display alongside the
// card's own credit. The exported PNG is different in kind, because it is the one
// artefact designed to leave Drift and travel — into a chat, onto social media —
// carrying no credit with it.
//
// The legal reasoning (compliance audit B-5): taking several third-party images
// and arranging them into a new composite graphic, with a layout, a path and
// typography, is arrangement and transformation rather than mere reproduction. On
// the better reading that makes the PNG **Adapted Material** under CC BY-SA 4.0,
// which triggers §3(b) ShareAlike on top of §3(a) attribution. Titles alone do
// not: a title is too short to carry protected expression, and the export already
// names the source and the licence. Dropping the images removes the trigger
// entirely, rather than trying to satisfy it with a credit block that would have
// to be correct for every image in every trail, including trails saved before
// per-image credits existed.
//
// `filter` is how html-to-image is told to skip nodes. Marking them in the DOM
// with `data-export-omit` keeps the decision next to the markup that renders them.
export async function exportTrailPng(
  node: HTMLElement,
  filename = "drift-trail.png",
): Promise<void> {
  const bg =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--paper-raised")
      .trim() || "#fbf7ef";
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: bg,
    filter: (el) => {
      // `filter` also receives text nodes, which have no `getAttribute`.
      if (!(el instanceof Element)) return true;
      if (el.tagName === "IMG") return false;
      return !el.hasAttribute("data-export-omit");
    },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
