// WCAG 2.2 AA contrast audit of the running app.
//
//   npm run audit:contrast                  # against http://localhost:3111
//   BASE=http://localhost:3000 npm run audit:contrast
//   npm run audit:contrast -- --theme dark  # one theme only
//
// Why this exists, given `contrast.test.ts` already guards the palette: the unit
// test knows what the TOKENS are, but not what actually ends up on top of what.
// Opacity modifiers, `color-mix`, tinted tiles, stacked translucent layers and
// per-realm accent rebinding all compose at render time. This walks the real
// rendered DOM and measures what a person would actually see.
//
// Deliberately NOT part of `npm test`, which stays pure vitest (no browser, no
// server). This needs a dev server running — see CLAUDE.md §7 for launching an
// ungated one when the cloud env is present.

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3111";
const args = process.argv.slice(2);
const themeArg = args.includes("--theme") ? args[args.indexOf("--theme") + 1] : null;
const THEMES = themeArg ? [themeArg] : ["light", "dark"];

// Every route, plus the realm-switched variants of the feed so the gallery and
// papers accent rebindings get measured too.
//
// `keepModal` measures a page with the first-run welcome dialog still OPEN. That
// dialog is real UI on a new user's very first screen, and dismissing it (which
// every other row does, so the page underneath is measurable at all) would leave
// it permanently unaudited.
//
// Papers is behind NEXT_PUBLIC_REALM_PAPERS, so its realm tab and generated
// covers only render when the dev server was started with that flag set. The
// run prints a warning if it looks absent rather than quietly passing.
// `expand` taps "Read more" first and waits for the body to arrive. Without it a
// whole class of text is never audited, because it only exists once expanded:
// Phase 26's tables (caption band, header row, zebra rows, the "showing 10 of 84
// rows" footer) and the infobox rows in the Details disclosure. The Mohs scale is
// pinned as the expanded page because it reliably carries a real data table.
const ROUTES = [
  { path: "/", keepModal: true },
  { path: "/" },
  { path: "/about" },
  // The public reading section. All plain prose, but prose is exactly what the
  // 4.5:1 rule is about, and these are the pages a stranger is most likely to
  // land on cold, so they are audited like everything else. One note stands in
  // for all four: they share a single shell and a single set of tokens.
  { path: "/how-it-works" },
  { path: "/principles" },
  { path: "/sources" },
  { path: "/faq" },
  { path: "/notes" },
  { path: "/notes/why-drift-exists" },
  { path: "/colophon" },
  { path: "/privacy" },
  // The Terms carry a lot of text in a shape no other page uses (the `**lead**`
  // spans inside bullets), and /contact now has a second, conditional form mode.
  { path: "/terms" },
  // The imprint. Mostly a definition list, which no other page uses.
  { path: "/legal" },
  { path: "/install" },
  { path: "/contact" },
  // The DSA Article 16 branch of the contact form: extra fields, a checkbox and
  // its label, and the anonymity note. None of it renders in the default mode,
  // so without this row it would never be measured.
  { path: "/contact", selectReport: true },
  { path: "/drift" },
  { path: "/drift?title=Mohs%20scale&seed=Mohs%20scale", expand: true },
  { path: "/drift?realm=gallery" },
  { path: "/drift?realm=papers" },
  { path: "/trails" },
  { path: "/atlas" },
  { path: "/interests" },
  { path: "/account" },
  { path: "/friends" },
  { path: "/inbox" },
  { path: "/auth/confirm" },
  // A public share page (Phase 27). It needs a real token, because the page is a
  // database row rather than a static route, so it is opt-in:
  //
  //   AUDIT_SHARE_TOKEN=<token> npm run audit:contrast
  //
  // Worth the extra step. Signed out it is the ONLY page in Drift a stranger
  // reaches with real content on it, it renders a card and a trail map outside
  // the feed's own layout, and the trial section is copy that exists nowhere
  // else. A run prints a warning when the token is absent, so this cannot go
  // quietly unmeasured.
  ...(process.env.AUDIT_SHARE_TOKEN
    ? [{ path: `/s/${process.env.AUDIT_SHARE_TOKEN}` }]
    : []),
];

/** Runs inside the page. Returns one record per visible text-bearing element. */
function collect() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  /** Any CSS colour → 8-bit rgba, by letting the browser rasterize it. Handles
   *  `color-mix()`, `oklch()`, `color(srgb …)` and named colours uniformly. */
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));

  /**
   * The colour actually behind an element: walk up compositing every
   * translucent background until an opaque one is reached. Returns null if a
   * background-image or gradient is in the stack, since a single ratio cannot
   * describe those honestly.
   */
  const backdropOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.999) break;
      }
    }
    if (!layers.length) return [255, 255, 255];
    let base = layers[layers.length - 1].slice(0, 3);
    for (let i = layers.length - 2; i >= 0; i--) base = over(layers[i], base);
    return base;
  };

  const selector = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const out = [];
  for (const el of document.querySelectorAll("*")) {
    // Only leaf-ish elements that render their own text.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!own) continue;
    if (el.closest("[aria-hidden='true']")) continue;
    // 1.4.3 exempts inactive controls.
    if (el.closest(":disabled, [aria-disabled='true']")) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) < 0.05) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;

    const bg = backdropOf(el);
    if (!bg) continue; // sits on an image or gradient; not measurable as one ratio

    const fg = over(rgba(cs.color), bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);

    out.push({
      text: own.slice(0, 48),
      sel: selector(el),
      size,
      weight,
      large,
      need: large ? 3 : 4.5,
      got: +ratio(fg, bg).toFixed(2),
      fg: `rgb(${fg.map(Math.round).join(",")})`,
      bg: `rgb(${bg.map(Math.round).join(",")})`,
    });
  }
  return out;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let total = 0;
const failures = [];

let sawPapers = false;

for (const { path: route, keepModal, expand, selectReport } of ROUTES) {
  const label = keepModal
    ? `${route} [welcome modal]`
    : expand
      ? `${route} [expanded]`
      : selectReport
        ? `${route} [report]`
        : route;
  for (const theme of THEMES) {
    let res;
    try {
      res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      console.log(`  ?  ${theme.padEnd(5)} ${label}  (timed out, skipped)`);
      continue;
    }
    if (!res || res.status() >= 400) {
      console.log(`  ?  ${theme.padEnd(5)} ${label}  (HTTP ${res?.status()}, skipped)`);
      continue;
    }
    // The first-run welcome modal dims and blurs the page behind it, so unless
    // the modal itself is what we're measuring, dismiss it: otherwise it hides
    // most of the app and skews every backdrop underneath.
    if (!keepModal) {
      const later = page.getByRole("button", { name: /maybe later/i });
      if (await later.count()) await later.first().click().catch(() => {});
    }
    if (route.includes("realm=papers")) {
      sawPapers ||= (await page.getByText(/papers/i).count()) > 0;
    }
    // Reveal the expanded body, so its tables and the infobox Details rows are
    // measured too. Best-effort: a page that fails to expand still audits what is
    // on screen rather than aborting the run.
    if (expand) {
      const readMore = page.getByRole("button", { name: /^Read more$/ });
      if (await readMore.count()) {
        await readMore.first().click().catch(() => {});
        await page
          .locator("figure table")
          .first()
          .waitFor({ timeout: 20000 })
          .catch(() => {});
        const details = page.getByRole("button", { name: /^Details$/ });
        if (await details.count()) await details.first().click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    // Switch the contact form into its DSA Article 16 mode, which reveals the
    // location field, the good-faith checkbox and its label, and the anonymity
    // note. None of that exists in the default mode.
    if (selectReport) {
      await page
        .getByLabel(/what is this about/i)
        .selectOption("report")
        .catch(() => {});
      await page.waitForTimeout(300);
    }

    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
    }, theme);
    await page.waitForTimeout(400);

    const rows = await page.evaluate(collect);
    total += rows.length;
    const bad = rows.filter((r) => r.got < r.need);
    // One line per distinct (selector, ratio) so a repeated component reports once.
    const seen = new Set();
    for (const r of bad) {
      const key = `${label}|${theme}|${r.sel}|${r.got}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({ route: label, theme, ...r });
    }
    const mark = bad.length ? "FAIL" : "ok  ";
    console.log(
      `  ${mark} ${theme.padEnd(5)} ${label.padEnd(28)} ${rows.length} nodes` +
        (bad.length ? `, ${seen.size} distinct failures` : ""),
    );
  }
}

await browser.close();

console.log(`\n${total} text nodes measured across ${ROUTES.length} views x ${THEMES.length} themes.`);
if (!sawPapers) {
  console.log(
    "NOTE: the Papers realm did not render. Re-run the dev server with\n" +
      "      NEXT_PUBLIC_REALM_PAPERS=1 to include its covers in the audit.",
  );
}
if (!process.env.AUDIT_SHARE_TOKEN) {
  console.log(
    "NOTE: no public share page was measured. Make a share link in the app, then\n" +
      "      AUDIT_SHARE_TOKEN=<token> npm run audit:contrast",
  );
}
if (!failures.length) {
  console.log("PASS — every measured text node clears its WCAG 2.2 AA bar.");
  process.exit(0);
}

console.log(`\n${failures.length} failing nodes:\n`);
for (const f of failures) {
  console.log(
    `  ${String(f.got).padStart(5)} < ${f.need}  ${f.theme.padEnd(5)} ${f.route}\n` +
      `        ${f.sel}\n` +
      `        "${f.text}"  ${f.size}px/${f.weight}  fg ${f.fg} on ${f.bg}`,
  );
}
process.exit(1);
