// ---------------------------------------------------------------------------
// What a simulated reader does, as pure functions. No network, no timers, no
// state — everything takes an rng and returns a number or a string, which is
// what makes it unit-testable (src/lib/loadbot-behaviour.test.ts) and what keeps
// the drivers free of judgement calls.
//
// THE POINT OF THE DISTRIBUTIONS. Fifty bots that all wait exactly ten seconds
// are not fifty readers; they are one reader amplified fifty times, and they
// produce a synchronised request pattern no real population produces. Every
// number here is therefore drawn from a spread, and each bot draws its own
// persistent speed once so that the population contains genuine skimmers and
// genuine slow readers rather than fifty copies of the average.
// ---------------------------------------------------------------------------

/**
 * mulberry32: a small, fast, seedable PRNG.
 *
 * Seedable matters more than it sounds. A run that cannot be repeated cannot be
 * compared against the run before it, so "did that change help?" becomes
 * unanswerable. `--seed` makes the whole swarm's behaviour reproducible; the
 * only thing left varying between two runs is the app itself.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (Box-Muller). Used only to build the log-normals. */
export function gaussian(rng) {
  // u must be > 0 or log() is -Infinity; rng() can legitimately return 0.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A bot's persistent reading-speed multiplier, drawn once when it starts.
 *
 * Log-normal with median 1: most readers are near the middle, a few are much
 * slower, and the tail is on the slow side rather than the fast side — which is
 * how reading time actually behaves. Clamped so no bot is either a denial of
 * service (0.1x) or asleep (10x).
 */
export function drawSpeed(rng) {
  return clamp(Math.exp(gaussian(rng) * 0.45), 0.4, 3.5);
}

/**
 * How long this bot looks at one card, in milliseconds.
 *
 * Median ~14s before the speed multiplier, so a 0.4x skimmer sits around 6s and
 * a 3.5x reader around 50s. Clamped to [3s, 120s]: below 3s nobody is reading,
 * and above 2 minutes the bot is no longer contributing load, just occupying a
 * slot.
 */
export function dwellMs(rng, speed) {
  const base = 14000 * Math.exp(gaussian(rng) * 0.55);
  return Math.round(clamp(base * speed, 3000, 120000));
}

/**
 * The next move.
 *
 * Weighted towards pulling a thread, because that is the move Drift is FOR
 * (§2.1: the reader steers) and because it is also the cheaper move for the
 * server — a thread pull needs no new fetch, the candidate is already in hand,
 * whereas a drift eventually empties the buffer and costs a refill. Getting this
 * split wrong in either direction moves every request-rate number in the report,
 * so it is stated here once rather than sprinkled through the drivers.
 */
export function chooseMove(rng) {
  const r = rng();
  if (r < 0.6) return "thread";
  if (r < 0.95) return "drift";
  return "back";
}

/** Roughly one card in four gets expanded. Costs one `extended=1` summary. */
export function shouldReadMore(rng) {
  return rng() < 0.25;
}

/** How many cards this bot reads before ending its session: 8 to 40. */
export function sessionLength(rng) {
  return 8 + Math.floor(rng() * 33);
}

/** Ending a session: a bit over half the time the trail gets saved. */
export function shouldSaveTrail(rng) {
  return rng() < 0.55;
}

/**
 * When bot `i` of `count` joins, in milliseconds from the start of the run.
 *
 * Spread over `rampMs` with jitter rather than all at once. Fifty simultaneous
 * cold starts is a thundering herd no beta will ever produce, and against the
 * Gallery it would spend the museum's whole burst budget in one go and then
 * measure nothing but 403s. The jitter stops the joins from arriving as a tidy
 * metronome, which is its own artefact.
 */
export function startDelayMs(rng, i, count, rampMs) {
  if (count <= 1) return 0;
  const slot = (rampMs * i) / count;
  return Math.round(clamp(slot + (rng() - 0.5) * (rampMs / count), 0, rampMs));
}

/**
 * Which realm each bot reads, as an array of length `count`.
 *
 * `galleryShare` is a target, not a promise: `galleryCap` wins. The Met's edge
 * throttles at roughly 80 requests per 30 seconds and, per CLAUDE.md §4,
 * repeated tripping shrinks that budget for a DAY — while a cold Gallery room
 * alone costs 21 requests. So the cap is a real safety limit and the caller is
 * told when it bit, rather than silently getting a different test than it asked
 * for.
 */
export function assignRealms(count, galleryShare, galleryCap) {
  const wanted = Math.round(count * galleryShare);
  const gallery = Math.min(wanted, galleryCap, count);
  const realms = Array.from({ length: count }, (_, i) =>
    // Interleaved rather than "first N are Gallery", so a partial run (or an
    // early stop) still holds the intended mix instead of being all Gallery.
    i % Math.max(1, Math.round(count / Math.max(1, gallery))) === 0 && i < count
      ? "gallery"
      : "encyclopedia",
  );
  // The interleave above is approximate; correct the count exactly so the report
  // can state the mix as a fact.
  let have = realms.filter((r) => r === "gallery").length;
  for (let i = realms.length - 1; i >= 0 && have > gallery; i--) {
    if (realms[i] === "gallery") {
      realms[i] = "encyclopedia";
      have--;
    }
  }
  for (let i = 0; i < realms.length && have < gallery; i++) {
    if (realms[i] === "encyclopedia") {
      realms[i] = "gallery";
      have++;
    }
  }
  return { realms, gallery: have, capped: wanted > gallery };
}

/** Pick one element of a non-empty array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
