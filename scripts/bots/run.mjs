// ---------------------------------------------------------------------------
// Drift · load-test harness — the runner.
//
//   npm run bots:run -- --bots 25 --minutes 20
//   npm run bots:run -- --bots 3 --minutes 2 --browser 1     (a smoke run)
//   npm run bots:run -- --bots 50 --minutes 30 --gallery 0.1 --instances 4
//
// Starts the rig, signs the bots in, turns them loose, and writes the report.
//
// ⚠️ THE `--base` GUARD IS NOT A FORMALITY. Vercel permits load testing only on
// Enterprise plans, and states that without prior notice "the IP addresses being
// used to perform the load test will be blocked shortly after starting due to
// abnormal traffic patterns". So a non-localhost target needs an explicit flag
// and is capped at 5 bots — which is a handful of friends reading, not a load
// test. The guard lives in code rather than in a comment because a comment is
// not there at 1am when somebody wants a "real" number.
// ---------------------------------------------------------------------------

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startRig } from "./rig.mjs";
import { startEdge } from "./edge.mjs";
import { runHttpBot } from "./bot-http.mjs";
import { runBrowserBot } from "./bot-browser.mjs";
import { loadAccounts } from "./seed-accounts.mjs";
import {
  makeRng,
  drawSpeed,
  startDelayMs,
  assignRealms,
} from "./behaviour.mjs";
import { summarise, renderMarkdown } from "./report.mjs";

const green = (m) => `\x1b[32m${m}\x1b[0m`;
const red = (m) => `\x1b[31m${m}\x1b[0m`;
const yellow = (m) => `\x1b[33m${m}\x1b[0m`;
const dim = (m) => `\x1b[2m${m}\x1b[0m`;

/**
 * How many bots may point at the museum at once.
 *
 * The Met's edge throttles at roughly 80 requests per 30 seconds and, per
 * CLAUDE.md §4, repeated tripping shrinks that budget hard — down to six
 * requests after a day of heavy use. A cold Gallery room alone costs 21
 * requests. This is the number that keeps a rehearsal from costing the museum's
 * goodwill for a day, so it is a constant, not an option.
 */
const GALLERY_CAP = 10;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => {
  const v = Number(arg(name, fallback));
  return Number.isFinite(v) ? v : fallback;
};

async function main() {
  const remote = arg("base", null);
  let bots = Math.max(1, Math.round(num("bots", 10)));
  const minutes = Math.max(0.5, num("minutes", 10));
  const galleryShare = Math.min(1, Math.max(0, num("gallery", 0.25)));
  const instances = Math.max(1, Math.round(num("instances", 3)));
  const seed = Math.round(num("seed", Date.now() % 100000));
  let browserBots = Math.max(0, Math.round(num("browser", Math.min(3, bots))));

  // ----- the fair-use guard -----
  if (remote && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(remote)) {
    if (!flag("i-know-vercel-fair-use")) {
      console.error(red("\nRefusing to point bots at a non-local target.\n"));
      console.error(
        "Vercel permits load testing on Enterprise plans only, and blocks the source IP\n" +
          "of an unannounced one. If you have a specific reason to run a handful of readers\n" +
          "against the real site, re-run with --i-know-vercel-fair-use (capped at 5 bots).\n",
      );
      process.exit(2);
    }
    if (bots > 5) {
      console.log(yellow(`\n  ⚠ remote target: capping ${bots} bots at 5.\n`));
      bots = 5;
    }
    browserBots = Math.min(browserBots, bots);
  }
  browserBots = Math.min(browserBots, bots);

  // ----- accounts -----
  const accounts = await loadAccounts();
  if (accounts.length < bots) {
    console.error(
      red(`\nOnly ${accounts.length} bot account(s) available, ${bots} needed.`),
    );
    console.error(`Run:  npm run bots:seed -- --count ${bots}\n`);
    process.exit(2);
  }

  const supabase = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };

  const rng = makeRng(seed);
  const { realms, gallery, capped } = assignRealms(bots, galleryShare, GALLERY_CAP);
  if (capped) {
    console.log(
      yellow(
        `\n  ⚠ Gallery share reduced to ${gallery} bots (cap ${GALLERY_CAP}).\n` +
          `    The museum throttles at ~80 requests per 30s and stays cross for a day.\n`,
      ),
    );
  }

  console.log(`\nDrift load rehearsal ${dim(`seed ${seed}`)}\n`);

  // ----- the rig -----
  const requests = [];
  const onRequest = (r) => requests.push(r);

  let rig;
  if (remote) {
    // A remote target has its own CDN; we still put the emulator in front so the
    // request log and the report are produced the same way, but it will report
    // BYPASS/MISS against whatever the origin says.
    const edge = await startEdge({ port: 3100, targets: [remote], onRequest });
    rig = {
      base: "http://127.0.0.1:3100",
      instances: 0,
      throttles: () => ({ byHost: {}, byStatus: {}, gaveUp: 0, total: 0 }),
      edgeStats: edge.stats,
      close: edge.close,
    };
    console.log(`  ${green("✓")} proxying to ${remote}`);
  } else {
    rig = await startRig({
      instances,
      build: !flag("no-build"),
      onRequest,
    });
  }

  // ----- sign the bots in -----
  // Staggered: Supabase's IP-limited endpoints use a token bucket with a
  // capacity of 30, and a 50-bot swarm authenticating in one burst would spend
  // it and start the run with half its accounts unusable.
  const sessions = [];
  process.stdout.write(dim(`  signing in ${bots} bot(s) `));
  for (let i = 0; i < bots; i++) {
    sessions.push(await signIn(supabase, accounts[i]));
    if (i % 5 === 4) process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 120));
  }
  const signedIn = sessions.filter(Boolean).length;
  process.stdout.write("\n");
  console.log(
    `  ${signedIn === bots ? green("✓") : yellow("⚠")} ${signedIn}/${bots} signed in ` +
      dim("(a bot without a session still reads; only its meter writes are lost)"),
  );

  const browser = browserBots > 0 ? await chromium.launch() : null;
  if (browser) console.log(`  ${green("✓")} chromium ${browser.version()}`);

  // ----- run -----
  const startedAt = Date.now();
  const deadline = startedAt + minutes * 60000;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);

  console.log(
    `\n  ${bots} bots (${browserBots} browser, ${bots - browserBots} HTTP) · ` +
      `${gallery} Gallery / ${bots - gallery} Encyclopedia · ${minutes} min\n`,
  );

  // Only paint progress on a real terminal. Piped to a file or a pipeline, `\r`
  // does not return the carriage and every tick becomes another line of noise
  // wrapped around the report.
  const timer = !process.stdout.isTTY ? null : setInterval(() => {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    const cacheable = requests.filter((r) => r.cache !== "BYPASS" && r.cache !== "ERROR");
    const hits = cacheable.filter((r) => r.cache === "HIT" || r.cache === "STALE").length;
    process.stdout.write(
      `\r  ${dim(`${left}s left · ${requests.length} reqs · ` +
        `${cacheable.length ? Math.round((hits / cacheable.length) * 100) : 0}% cached · ` +
        `${rig.throttles().total} throttles`)}   `,
    );
  }, 2000);

  const results = await Promise.all(
    Array.from({ length: bots }, (_, i) => {
      // Each bot gets its own PRNG stream, seeded from the run seed, so one
      // bot's draws cannot shift another's — which is what makes `--seed`
      // actually reproduce a run rather than merely start it the same way.
      const botRng = makeRng(seed + i * 7919);
      const speed = drawSpeed(botRng);
      const delay = startDelayMs(rng, i, bots, Math.min(60000, minutes * 60000 * 0.15));
      const common = {
        id: `bot-${String(i).padStart(3, "0")}`,
        realm: realms[i],
        base: rig.base,
        rng: botRng,
        speed,
        deadline,
        signal: controller.signal,
      };
      return (async () => {
        await new Promise((r) => setTimeout(r, delay));
        if (controller.signal.aborted) {
          return idleStats(common, "run ended before it started");
        }
        try {
          return i < browserBots
            ? await runBrowserBot({ ...common, browser, account: accounts[i] })
            : await runHttpBot({ ...common, session: sessions[i], supabase });
        } catch (err) {
          return idleStats(common, `crashed: ${String(err?.message ?? err).slice(0, 120)}`);
        }
      })();
    }),
  );

  if (timer) clearInterval(timer);
  if (process.stdout.isTTY) process.stdout.write("\r" + " ".repeat(90) + "\r");
  const endedAt = Date.now();

  await browser?.close().catch(() => {});
  const throttles = rig.throttles();
  const edge = rig.edgeStats();
  await rig.close();

  // ----- report -----
  const config = {
    base: remote ?? rig.base,
    bots,
    browserBots,
    minutes,
    instances: remote ? 0 : instances,
    gallery,
    capped,
    seed,
  };
  const summary = summarise({ requests, bots: results, throttles, edge, config, startedAt, endedAt });
  const md = renderMarkdown(summary, results);

  const dir = new URL(
    `../../reports/loadtest/${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}/`,
    import.meta.url,
  );
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("summary.md", dir), `${md}\n`, "utf8");
  await writeFile(new URL("run.json", dir), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(
    new URL("bots.jsonl", dir),
    `${results.map((r) => JSON.stringify(r)).join("\n")}\n`,
    "utf8",
  );
  await writeFile(
    new URL("requests.jsonl", dir),
    `${requests.map((r) => JSON.stringify(r)).join("\n")}\n`,
    "utf8",
  );

  console.log(md.split("## Routes")[0]);
  console.log(dim(`  full report → ${new URL("summary.md", dir).pathname}\n`));

  // A failed request or an upstream throttle is information, not a crash; the
  // report says so and the exit code stays 0. A bot that never got a card is a
  // broken harness, and that is worth failing on.
  if (results.every((r) => r.cards === 0)) process.exit(1);
}

/** Password grant, straight to Supabase — the same call supabase-js makes. */
async function signIn(supabase, account) {
  if (!supabase.url || !supabase.key) return null;
  try {
    const res = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabase.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => null);
    return body?.access_token ? body : null;
  } catch {
    return null;
  }
}

function idleStats(common, why) {
  return {
    id: common.id,
    driver: "http",
    realm: common.realm,
    speed: Number(common.speed.toFixed(2)),
    cards: 0,
    drifts: 0,
    threads: 0,
    backs: 0,
    readMores: 0,
    refills: 0,
    retries: 0,
    requests: 0,
    errors: [why],
    startedAt: Date.now(),
    timeToFirstCardMs: null,
    cardLatencies: [],
    endedAt: Date.now(),
    endedBecause: why,
  };
}

await main();
