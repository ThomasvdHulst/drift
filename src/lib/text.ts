// ---------------------------------------------------------------------------
// Small text helpers for the surfaces that write a SENTENCE about a trail
// rather than drawing one.
//
// Kept here because the same shape was being re-derived privately wherever a
// list had to be read aloud, and two copies of a joiner drift apart the moment
// one of them learns about the Oxford comma and the other does not.
// ---------------------------------------------------------------------------

/** "A" / "A and B" / "A, B and C" — a list read aloud rather than punctuated. */
export function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** A small count as a word, which is how a sentence says it. Anything larger
 *  stays a numeral: "twenty-three" mid-line reads worse than "23", and a trail
 *  that ended in more than ten places is past the point of being charming. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
