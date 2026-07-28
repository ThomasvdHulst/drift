// Reads the REAL colour tokens out of `src/app/globals.css`.
//
// Test-only, like `tile-contrast.testkit.ts` — not a test file itself (vitest
// only collects `*.test.ts`) and never imported by the app.
//
// Why parse the stylesheet instead of copying the hexes into the test: a copy is
// a second source of truth, and a second source of truth silently rots. Someone
// retunes `--accent` in globals.css, forgets the test, and the suite stays green
// while the shipped app fails AA. Parsing means the contract is bound to the
// file that actually renders.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ThemeName = "light" | "dark";

export interface PaletteTokens {
  paper: string;
  paperRaised: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentStrong: string;
  line: string;
  lineStrong: string;
}

const CSS_PATH = join(process.cwd(), "src/app/globals.css");

/** Every flat `selector { … }` block, in source order. globals.css has no
 *  nested at-rules, so a non-greedy scan is sufficient and dependency-free.
 *
 *  Comments are stripped first, and only the text after the last `;` is taken
 *  as the selector: otherwise the run between two blocks drags in the preceding
 *  comment and any top-level statement (`@import "tailwindcss";`). */
function blocks(css: string): { selector: string; body: string }[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].split(";").pop()!.trim().replace(/\s+/g, " ");
    out.push({ selector, body: m[2] });
  }
  return out;
}

/** The custom properties declared in one block. */
function decls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/\s*\/\*.*$/, "").trim();
  }
  return out;
}

const CSS = readFileSync(CSS_PATH, "utf8");
const BLOCKS = blocks(CSS);

function blockFor(selector: string): Record<string, string> {
  const hit = BLOCKS.filter((b) => b.selector === selector);
  if (hit.length === 0) throw new Error(`globals.css has no block for: ${selector}`);
  // Later declarations win, same as the cascade.
  return Object.assign({}, ...hit.map((b) => decls(b.body)));
}

const SELECTORS: Record<ThemeName, { base: string; realm: (r: string) => string }> = {
  light: {
    base: ":root",
    realm: (r) => `[data-realm="${r}"]`,
  },
  dark: {
    base: ':root[data-theme="dark"]',
    realm: (r) => `:root[data-theme="dark"] [data-realm="${r}"]`,
  },
};

/** The realms that rebind the accent, discovered from the stylesheet so a new
 *  realm is covered automatically instead of being silently untested. */
export function realmsInStylesheet(): string[] {
  const found = new Set<string>();
  for (const b of BLOCKS) {
    const m = b.selector.match(/^\[data-realm="([\w-]+)"\]$/);
    if (m) found.add(m[1]);
  }
  return [...found].sort();
}

const REQUIRED: [keyof PaletteTokens, string][] = [
  ["paper", "--paper"],
  ["paperRaised", "--paper-raised"],
  ["ink", "--ink"],
  ["inkSoft", "--ink-soft"],
  ["accent", "--accent"],
  ["accentStrong", "--accent-strong"],
  ["line", "--line"],
  ["lineStrong", "--line-strong"],
];

/**
 * The tokens in effect for one theme + realm, resolved the way the cascade
 * resolves them: the theme's base block, with the realm's accent rebinding
 * layered on top.
 */
export function tokensFor(theme: ThemeName, realm: string): PaletteTokens {
  const merged = {
    ...blockFor(SELECTORS[theme].base),
    ...blockFor(SELECTORS[theme].realm(realm)),
  };
  const out = {} as PaletteTokens;
  for (const [key, prop] of REQUIRED) {
    const v = merged[prop];
    if (!v) throw new Error(`globals.css: ${theme}/${realm} is missing ${prop}`);
    if (!/^#[0-9a-fA-F]{3,8}$/.test(v))
      throw new Error(`globals.css: ${prop} is "${v}", expected a hex colour`);
    out[key] = v;
  }
  return out;
}
