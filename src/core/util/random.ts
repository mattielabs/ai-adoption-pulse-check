/**
 * Deterministic pseudo-randomness for reproducible fixtures and tests.
 *
 * This is NOT for anything security-relevant. Public Pulse ids, session
 * secrets and export tokens must come from a cryptographically secure source
 * (`crypto.getRandomValues`), never from here.
 */

export type RandomSource = () => number;

/** mulberry32 - small, fast, and stable across platforms and Node versions. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function pick<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) throw new Error('Cannot pick from an empty list');
  return items[Math.floor(random() * items.length)] as T;
}

/**
 * Picks an item using explicit relative weights, so fixture distributions are
 * intentional rather than accidental.
 */
export function pickWeighted<T>(
  entries: readonly (readonly [T, number])[],
  random: RandomSource,
): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new Error('Weights must sum to a positive number');
  let threshold = random() * total;
  for (const [value, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) return value;
  }
  return entries[entries.length - 1]?.[0] as T;
}

/** Picks `count` distinct items. */
export function sample<T>(items: readonly T[], count: number, random: RandomSource): T[] {
  return shuffle(items, random).slice(0, Math.min(count, items.length));
}
