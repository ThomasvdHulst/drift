// ---------------------------------------------------------------------------
// Drift · load-test harness — count what we ask of other people's servers.
//
//   NODE_OPTIONS="--import ./scripts/bots/upstream-count.mjs" npx next start -p 3106
//   curl .../api/doorway?realm=encyclopedia&id=Octopus
//   kill -USR2 <pid>          # prints and resets the counts
//
// A preload that wraps global fetch and tallies outbound requests per host.
// Node's fetch is what every server adapter uses, so this sees everything the
// app asks of Wikimedia and the museum, and the app never knows it is there.
//
// WHY THIS IS KEPT. "Reduce the number of API calls per card" is a claim, and a
// claim about request counts cannot be checked by reading the code — the counts
// live in fan-out (a search that becomes five record fetches), in caches, and in
// retries. This is how the Gallery bottleneck was actually found: the Gallery
// looked expensive, and measuring showed that 92.6% of the museum's traffic was
// coming from `/api/doorway` on ENCYCLOPEDIA cards instead.
//
// Reach for it whenever a change is supposed to cost less. Costs nothing when
// not preloaded.
// ---------------------------------------------------------------------------

const counts = new Map();
const original = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  try {
    const { host } = new URL(url);
    counts.set(host, (counts.get(host) ?? 0) + 1);
  } catch {
    /* a relative or malformed URL is not an upstream call */
  }
  return original(input, init);
};

// SIGUSR2 rather than an HTTP endpoint on purpose: an endpoint would be another
// route in the app, and the app must not carry a measurement surface it does not
// need. Resets after printing, so successive actions can be measured separately.
process.on("SIGUSR2", () => {
  const total = [...counts.values()].reduce((n, v) => n + v, 0);
  console.log(`[COUNT] ${JSON.stringify(Object.fromEntries(counts))} total=${total}`);
  counts.clear();
});
