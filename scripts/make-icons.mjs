// Derives Drift's in-app logos + installable-icon assets from the brand masters
// in `logos/png/`. Run after updating the brand art: `node scripts/make-icons.mjs`.
//
// Why PNGs (not the SVGs): the brand SVGs render the "Drift" wordmark / "D" with
// live Fraunces <text>, which an <img>/favicon context can't load — it'd fall back
// to a generic serif. The PNGs have the glyphs baked into pixels, so they render
// correctly everywhere.
//
// Outputs:
//   public/brand/drift-logo.png / -reversed / drift-monogram.png / -reversed
//                               — UI wordmark + monogram (ink for light, cream for dark)
//   src/app/icon.png            — favicon (dark "D + dot" squircle; Next auto-links)
//   src/app/apple-icon.png      — 180×180 iOS home-screen icon (Next auto-links)
//   public/icon-192.png         — PWA manifest icon (any)
//   public/icon-512.png         — PWA manifest icon (any)
//   public/icon-maskable-512.png— PWA manifest icon (maskable; centered on a dark
//                                 square so an aggressive OS mask can't clip it)

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = (p) => join(ROOT, "logos/png", p);
const P = (p) => join(ROOT, "public", p);
const A = (p) => join(ROOT, "src/app", p);

// 1. UI logos (wordmark + monogram, ink + reversed) → public/brand/.
await mkdir(P("brand"), { recursive: true });
for (const f of [
  "drift-logo.png",
  "drift-logo-reversed.png",
  "drift-monogram.png",
  "drift-monogram-reversed.png",
])
  await copyFile(L(f), P(join("brand", f)));

// 2. Favicon + Apple touch icon (baked-in font).
await copyFile(L("favicon-512.png"), A("icon.png"));
await copyFile(L("apple-touch-icon-180.png"), A("apple-icon.png"));

// 3. PWA manifest icons from the "D + dot" master squircle.
const master = (await readFile(L("drift-icon-master-1024.png"))).toString("base64");
const dataUri = `data:image/png;base64,${master}`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(size, { maskable = false } = {}) {
  const scale = maskable ? 0.8 : 1; // maskable: keep the mark inside the safe zone
  const bg = maskable ? "#2a2723" : "transparent"; // brand ink fills the mask area
  const inner = Math.round(size * scale);
  const html = `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">
      <img src="${dataUri}" style="width:${inner}px;height:${inner}px"/>
    </div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(50);
  return page.screenshot({
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: !maskable,
  });
}

await writeFile(P("icon-192.png"), await shot(192));
await writeFile(P("icon-512.png"), await shot(512));
await writeFile(P("icon-maskable-512.png"), await shot(512, { maskable: true }));

await browser.close();
console.log(
  "brand assets written: public/brand/* logos, src/app/icon.png + apple-icon.png, public/icon-192/512 + maskable",
);
