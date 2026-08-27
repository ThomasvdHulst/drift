// ---------------------------------------------------------------------------
// Drift · load-test harness — the local rig.
//
// K production-mode app instances behind the edge emulator, so that a run on one
// laptop resembles the deployment rather than a different system.
//
// WHY K INSTANCES AND NOT ONE. lib/upstream.ts paces requests through a
// module-level gate (300ms for Wikimedia, 50ms for the museum). That gate is per
// PROCESS. On Vercel several function instances run concurrently and each paces
// independently — which is precisely why docs/beta-readiness.md notes the
// aggregate can exceed the limit while every instance behaves. With a single
// local process the gate becomes a global serialiser: all fifty bots queue
// behind one 300ms tick, total Wikimedia throughput is pinned at 200/min no
// matter how many bots there are, and the run measures the harness instead of
// the app. Verified: several `next start` share one build directory happily.
//
// WHY `next start` AND NEVER `next dev`. Turbopack compiles on demand, so a dev
// server would be measuring the bundler. The build is also the type-check gate
// (CLAUDE.md §8.1), so doing it here means a run cannot start against code that
// does not compile.
//
// The instances inherit the real .env, so the auth gate, the meter and cloud
// sync are all live against the real Supabase project. That is the point: those
// are part of what is being tested.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { startEdge } from "./edge.mjs";

const dim = (m) => `\x1b[2m${m}\x1b[0m`;
const green = (m) => `\x1b[32m${m}\x1b[0m`;

/**
 * Lines lib/upstream.ts already writes when an upstream throttles us.
 *
 * Nothing is instrumented for this: the app logs it because the decision to
 * raise our quota should be made on evidence ("[upstream] 429 from …"). The rig
 * just reads its own children's stdout, which is why a run can report throttling
 * without a single change inside src/.
 */
const THROTTLE_RE = /^\[upstream\] (\d{3}) from (\S+)/;
const GAVE_UP_RE = /^\[upstream\] (\S+) asked for (\d+)s; not retrying/;
/** The circuit breaker opening is the single most important thing that can
 *  happen to an upstream during a run — it means we stopped asking entirely —
 *  and none of the patterns above match its log line. Without this the report
 *  would show throttles falling and give no hint of the reason. */
const BREAKER_RE = /^\[upstream\] circuit OPEN after (\d+)/;

/** Poll until an instance answers, so bots never race a half-started server. */
async function waitReady(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Build (unless told not to), start the instances and the proxy.
 *
 * Returns the base URL the bots should use, a live view of the throttle counts,
 * and a close() that leaves no orphan processes behind.
 */
export async function startRig({
  instances = 3,
  basePort = 3101,
  edgePort = 3100,
  build = true,
  onRequest = () => {},
  log = console.log,
}) {
  if (build) {
    log(dim("  building (this is also the type-check gate) …"));
    await new Promise((resolve, reject) => {
      const b = spawn("npx", ["next", "build"], { stdio: ["ignore", "pipe", "pipe"] });
      let tail = "";
      b.stdout.on("data", (d) => (tail = `${tail}${d}`.slice(-4000)));
      b.stderr.on("data", (d) => (tail = `${tail}${d}`.slice(-4000)));
      b.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`next build failed:\n${tail}`)),
      );
    });
    log(`  ${green("✓")} build clean`);
  }

  // Statuses are kept PER HOST, not globally. The two upstreams say "slow down"
  // in different words — the museum answers a burst with 403 and Wikimedia with
  // 429 — so one shared histogram made every host's row in the report show every
  // host's statuses, which read as though Wikipedia had been 403ing us 1,470
  // times. Same totals, badly wrong story.
  const throttles = { byHost: {}, byStatus: {}, gaveUp: 0, breakerOpened: 0, total: 0 };
  const children = [];
  const targets = [];

  for (let i = 0; i < instances; i++) {
    const port = basePort + i;
    const child = spawn("npx", ["next", "start", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    children.push(child);
    targets.push(`http://127.0.0.1:${port}`);

    const scan = (buf) => {
      for (const line of String(buf).split("\n")) {
        const t = line.match(THROTTLE_RE);
        if (t) {
          const [, status, host] = t;
          throttles.total++;
          throttles.byStatus[status] = (throttles.byStatus[status] ?? 0) + 1;
          const h = (throttles.byHost[host] ??= { total: 0, statuses: {} });
          h.total++;
          h.statuses[status] = (h.statuses[status] ?? 0) + 1;
          continue;
        }
        if (BREAKER_RE.test(line)) {
          throttles.breakerOpened++;
          continue;
        }
        if (GAVE_UP_RE.test(line)) throttles.gaveUp++;
      }
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
  }

  const ready = await Promise.all(
    targets.map((t) => waitReady(`${t}/api/wiki/topics?title=Octopus`)),
  );
  if (ready.some((r) => !r)) {
    for (const c of children) c.kill("SIGTERM");
    throw new Error("an app instance never became ready");
  }
  log(`  ${green("✓")} ${instances} app instance(s) ready on ${basePort}-${basePort + instances - 1}`);

  const edge = await startEdge({ port: edgePort, targets, onRequest });
  log(`  ${green("✓")} edge emulator on ${edgePort} ${dim(`→ ${instances} instance(s)`)}`);

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await edge.close();
    for (const c of children) c.kill("SIGTERM");
    // Give them a moment to go quietly, then insist.
    await new Promise((r) => setTimeout(r, 800));
    for (const c of children) if (!c.killed) c.kill("SIGKILL");
  }

  // A run interrupted with Ctrl-C must not leave three `next start` processes
  // holding ports 3101-3103 for the rest of the day.
  const onExit = () => void close();
  process.once("SIGINT", onExit);
  process.once("SIGTERM", onExit);
  process.once("exit", onExit);

  return {
    base: `http://127.0.0.1:${edgePort}`,
    instances,
    throttles: () => ({
      ...throttles,
      byHost: Object.fromEntries(
        Object.entries(throttles.byHost).map(([h, v]) => [
          h,
          { total: v.total, statuses: { ...v.statuses } },
        ]),
      ),
      byStatus: { ...throttles.byStatus },
    }),
    edgeStats: edge.stats,
    close,
  };
}
