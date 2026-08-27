// ---------------------------------------------------------------------------
// Drift · load-test harness — the edge emulator.
//
// A caching reverse proxy that stands where Vercel's CDN stands, in front of N
// local `next start` instances.
//
// WHY THIS IS NOT OPTIONAL. Without it, a local run is not a smaller version of
// production, it is a DIFFERENT SYSTEM. In production the shared edge collapses
// overlapping requests — five readers on the same page cost one upstream fetch,
// not five — and that is the app's main scaling lever (docs/beta-readiness.md
// Q3; verified live: x-vercel-cache MISS 985ms then HIT 64ms). A local run
// without a cache sends every bot's every request to Wikipedia and the museum,
// so it would measure an app nobody deploys and would blame the app for load the
// CDN actually absorbs.
//
// It deliberately knows NOTHING about which route is which. It reads the
// `Cache-Control` the app itself emits, which is exactly the contract
// src/lib/cache-headers.ts writes: a public s-maxage on a real answer, `no-store`
// on every error, empty or degraded one. So the emulator cannot drift from the
// app's caching policy, because it has no policy of its own.
//
// The one rule it does encode is the shared-cache guard from that same file
// (`carriesUserSession`, compliance audit M-10): a request carrying an
// Authorization header or a Supabase auth cookie is passed straight through and
// never cached, never stored. If this proxy ever cached one, it would be
// reproducing the exact personal-data leak that guard exists to prevent — in a
// test harness, where nobody would be looking.
// ---------------------------------------------------------------------------

import http from "node:http";

/** Cookie shape that means a Supabase session — mirrors lib/cache-headers.ts. */
const SESSION_COOKIE = /(^|;\s*)sb-[a-z0-9-]+-auth-token(\.\d+)?=/i;

/** Don't hold a single huge response; artwork originals are the only big ones. */
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
/** Total cache ceiling. Past this the oldest entries go, LRU-ish by insertion. */
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * Parse the directives we care about out of a Cache-Control value.
 * Returns null when the response must not be stored.
 */
export function parseCacheControl(value) {
  const v = (value ?? "").toLowerCase();
  if (!v || v.includes("no-store") || v.includes("private")) return null;
  const s = v.match(/s-maxage=(\d+)/);
  if (!s) return null; // no shared-cache lifetime ⇒ the edge would not hold it
  const swr = v.match(/stale-while-revalidate=(\d+)/);
  return { sMaxAge: Number(s[1]), swr: swr ? Number(swr[1]) : 0 };
}

/** True when this request identifies a signed-in user (never cache those). */
export function carriesUserSession(headers) {
  if (headers.authorization) return true;
  const cookie = headers.cookie;
  return !!cookie && SESSION_COOKIE.test(cookie);
}

/**
 * Start the proxy.
 *
 * `targets` are the app instances (round-robined, like Vercel spreading requests
 * over several function instances — which matters because each instance has its
 * OWN request-spacing gate in lib/upstream.ts, and one shared gate would
 * serialise the whole swarm in a way production never does).
 *
 * `onRequest` receives one record per proxied request; run.mjs turns those into
 * the latency and cache-ratio numbers in the report.
 */
export function startEdge({ port, targets, onRequest = () => {} }) {
  const cache = new Map();
  let totalBytes = 0;
  let rr = 0;
  const stats = { hit: 0, miss: 0, stale: 0, bypass: 0, errors: 0 };

  function evictIfNeeded() {
    // Insertion-ordered Map: the first key is the oldest entry.
    while (totalBytes > MAX_TOTAL_BYTES && cache.size) {
      const [k, v] = cache.entries().next().value;
      totalBytes -= v.body.length;
      cache.delete(k);
    }
  }

  function store(key, entry) {
    if (entry.body.length > MAX_ENTRY_BYTES) return;
    const prior = cache.get(key);
    if (prior) totalBytes -= prior.body.length;
    cache.delete(key); // re-insert so it lands at the end of the order
    cache.set(key, entry);
    totalBytes += entry.body.length;
    evictIfNeeded();
  }

  /** One trip to an app instance. Resolves with status, headers and body. */
  function fetchUpstream(req, body) {
    const target = targets[rr++ % targets.length];
    const url = new URL(req.url, target);
    return new Promise((resolve, reject) => {
      // ⚠️ Ask upstream for IDENTITY, always.
      //
      // The proxy buffers a response and re-serves it later, so it must hold
      // bytes it can hand to any client. Forwarding the client's
      // `accept-encoding` meant storing GZIP bytes; serving them on with the
      // `content-encoding` header dropped handed the browser `1f8b08…` labelled
      // as HTML, and a browser bot silently got a blank page and could never
      // find the sign-in form. Keeping the header instead would only move the
      // problem: one cache entry per URL cannot be right for clients that asked
      // for different encodings (a real CDN keys on Vary for exactly this).
      //
      // Asking for identity removes the whole question. Nothing measured here
      // is about wire compression — it is all loopback.
      const headers = { ...req.headers, host: url.host, "accept-encoding": "identity" };
      const up = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: req.method, headers },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
              target,
            }),
          );
        },
      );
      up.on("error", reject);
      if (body?.length) up.write(body);
      up.end();
    });
  }

  const server = http.createServer((req, res) => {
    const started = Date.now();
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const body = Buffer.concat(chunks);
      const key = `${req.method} ${req.url}`;
      const cacheable = req.method === "GET" && !carriesUserSession(req.headers);
      const now = Date.now();

      const finish = (state, status, headers, payload, target) => {
        stats[state === "HIT" ? "hit" : state === "STALE" ? "stale" : state === "BYPASS" ? "bypass" : "miss"]++;
        const out = { ...headers, "x-drift-cache": state };
        delete out["content-encoding"]; // we hold decoded bytes
        delete out["transfer-encoding"];
        out["content-length"] = String(payload.length);
        res.writeHead(status, out);
        res.end(payload);
        onRequest({
          url: req.url,
          path: req.url.split("?")[0],
          method: req.method,
          status,
          cache: state,
          ms: Date.now() - started,
          bytes: payload.length,
          target,
          at: started,
        });
      };

      if (cacheable) {
        const hit = cache.get(key);
        if (hit) {
          const age = (now - hit.storedAt) / 1000;
          if (age <= hit.sMaxAge) {
            finish("HIT", hit.status, hit.headers, hit.body, "cache");
            return;
          }
          if (age <= hit.sMaxAge + hit.swr) {
            // Serve stale, refresh behind the reader's back — the whole point of
            // stale-while-revalidate, and something the app's cache profiles
            // rely on (CACHE_STABLE is 1 day fresh / 7 days stale).
            finish("STALE", hit.status, hit.headers, hit.body, "cache");
            fetchUpstream(req, body)
              .then((up) => {
                const cc = parseCacheControl(up.headers["cache-control"]);
                if (cc && up.status === 200) {
                  store(key, { ...up, ...cc, storedAt: Date.now() });
                }
              })
              .catch(() => {});
            return;
          }
          cache.delete(key);
          totalBytes -= hit.body.length;
        }
      }

      try {
        const up = await fetchUpstream(req, body);
        if (cacheable && up.status === 200) {
          const cc = parseCacheControl(up.headers["cache-control"]);
          if (cc) store(key, { ...up, ...cc, storedAt: Date.now() });
        }
        finish(cacheable ? "MISS" : "BYPASS", up.status, up.headers, up.body, up.target);
      } catch (err) {
        stats.errors++;
        res.writeHead(502, { "content-type": "text/plain", "x-drift-cache": "ERROR" });
        res.end("edge: upstream unreachable");
        onRequest({
          url: req.url,
          path: req.url.split("?")[0],
          method: req.method,
          status: 502,
          cache: "ERROR",
          ms: Date.now() - started,
          bytes: 0,
          error: String(err?.message ?? err),
          at: started,
        });
      }
    });
  });

  // Bots open many short-lived connections; the default 5s keep-alive plus
  // Node's race between "server closes idle socket" and "client reuses it" shows
  // up as spurious ECONNRESETs that would land in the report as app errors.
  server.keepAliveTimeout = 30000;
  server.headersTimeout = 35000;

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        server,
        stats: () => ({ ...stats, entries: cache.size, bytes: totalBytes }),
        close: () => new Promise((r) => server.close(r)),
      }),
    );
  });
}
