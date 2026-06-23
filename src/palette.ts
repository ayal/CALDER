// ---------------------------------------------------------------------------
// Alexander Calder palette.
//
// Calder worked almost entirely from a fixed, deliberately limited set: the
// three primaries (red, yellow, blue) plus black and white — "I love red so
// much I want to paint everything red." Black dominates the wire armatures and
// most of the larger plates; the primaries punctuate. So we keep a single small
// constant palette and let weighting (lots of black, a little white, primaries
// as accents) carry the variety rather than swapping schemes.
// ---------------------------------------------------------------------------

export const randInt = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(arr: T[]): T => arr[randInt(arr.length)];

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

// ---- the Calder colours ----------------------------------------------------
export const CALDER_RED = 0xd62828;
export const CALDER_YELLOW = 0xf6c700;
export const CALDER_BLUE = 0x1d4e9c;
export const CALDER_BLACK = 0x111111;
export const CALDER_WHITE = 0xf3f1ea;

// Gallery wall — a warm off-white, like the AGAM "cream" but cooler.
export const GALLERY = 0xeceae4;

// Plate colours weighted the way Calder actually used them: black most often,
// the primaries as punctuation, white sparingly.
const WEIGHTED: number[] = [
  CALDER_BLACK, CALDER_BLACK, CALDER_BLACK,
  CALDER_RED, CALDER_RED,
  CALDER_YELLOW,
  CALDER_BLUE,
  CALDER_WHITE,
];

// Pick a plate colour, avoiding an immediate repeat of `prev` when possible so
// adjacent plates contrast.
export function plateColor(prev?: number): number {
  let c = pick(WEIGHTED);
  if (prev !== undefined) {
    for (let i = 0; i < 4 && c === prev; i++) c = pick(WEIGHTED);
  }
  return c;
}
