// Generates Drift's app icons from a single on-brand SVG "trail meander" mark
// (sage thread + nodes on warm cream — the trail-map motif). Rendered to PNG via
// Playwright (already a dev dep) so the build needs no image toolchain; the PNGs
// are committed. Run: `node scripts/make-icons.mjs`.
//
// Outputs:
//   src/app/icon.svg            — crisp scalable browser-tab favicon (Next auto-links)
//   src/app/apple-icon.png      — 180×180 opaque iOS home-screen icon (Next auto-links)
//   public/icon-192.png         — PWA manifest icon (any)
//   public/icon-512.png         — PWA manifest icon (any)
//   public/icon-maskable-512.png— PWA manifest icon (maskable; content in safe zone)
// (No favicon.ico — app/icon.svg is the favicon; the phone home screen uses the
//  Apple/manifest PNGs above.)

import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAPER = "#f5efe4";
const SAGE = "#6f8f74";

// The mark, drawn in a 512 viewBox. `scale` shrinks the artwork toward center
// (used for the maskable safe zone); the cream ground always fills the square.
function svg(scale = 1) {
  const g = `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <path d="M 196 128 C 360 190, 152 300, 316 384"
            fill="none" stroke="${SAGE}" stroke-width="22"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="196" cy="128" r="24" fill="${SAGE}"/>
      <circle cx="256" cy="248" r="22" fill="${PAPER}" stroke="${SAGE}" stroke-width="14"/>
      <circle cx="316" cy="384" r="34" fill="${SAGE}"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${PAPER}"/>${g}
</svg>`;
}

async function renderPng(page, markup, size) {
  const html = `<!doctype html><html><body style="margin:0;padding:0">
    <div style="width:${size}px;height:${size}px">${markup
      .replace('viewBox="0 0 512 512"', `width="${size}" height="${size}" viewBox="0 0 512 512"`)}</div>
  </body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: "networkidle" });
  return page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
}

const browser = await chromium.launch();
const page = await browser.newPage();

// Scalable favicon.
await writeFile(join(ROOT, "src/app/icon.svg"), svg(1) + "\n");

// Raster icons.
await writeFile(join(ROOT, "public/icon-192.png"), await renderPng(page, svg(1), 192));
await writeFile(join(ROOT, "public/icon-512.png"), await renderPng(page, svg(1), 512));
await writeFile(join(ROOT, "public/icon-maskable-512.png"), await renderPng(page, svg(0.72), 512));
await writeFile(join(ROOT, "src/app/apple-icon.png"), await renderPng(page, svg(1), 180));

await browser.close();
console.log("icons written: icon.svg, apple-icon.png (180), icon-192/512, icon-maskable-512");
