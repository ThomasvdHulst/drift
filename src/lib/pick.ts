// Tiny pure helper: pick a uniformly-random element. Lives in lib (not inline in
// a component) so React's render-purity lint rule stays happy and it's testable.
// RNG is injected for deterministic tests.
export function pickRandom<T>(
  arr: readonly T[],
  rng: () => number = Math.random,
): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.min(Math.floor(rng() * arr.length), arr.length - 1)];
}
