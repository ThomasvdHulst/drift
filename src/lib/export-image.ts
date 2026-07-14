import { toPng } from "html-to-image";

// Browser-only: rasterize a trail-map DOM node to a PNG and trigger a download.
// Wikimedia thumbnails send `Access-Control-Allow-Origin: *` and our <img>s set
// crossOrigin="anonymous", so the canvas isn't tainted. Kept out of export.ts so
// the pure `trailToText` stays importable in unit tests without html-to-image.
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
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
