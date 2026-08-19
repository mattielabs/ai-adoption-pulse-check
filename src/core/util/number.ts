/**
 * Numeric helpers shared by scoring and aggregation.
 *
 * Scores are kept at full internal precision but normalized to a fixed number
 * of decimal places so that floating-point noise (0.30000000000000004) never
 * reaches a threshold comparison, a snapshot, or a display string.
 */

/** Internal precision. Enough to be lossless for our weight arithmetic, small enough to be stable. */
export const INTERNAL_PRECISION = 6;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // `Number.EPSILON` nudging avoids 1.005 -> 1.00 style rounding surprises.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Normalize a computed score to internal precision. */
export function normalizeScore(value: number): number {
  return roundTo(value, INTERNAL_PRECISION);
}

/**
 * The single rounding helper for anything shown to a human. Display always uses
 * whole numbers; the spec is explicit that small differences should not be
 * presented as meaningful precision.
 */
export function roundScore(value: number): number {
  return Math.round(roundTo(value, INTERNAL_PRECISION));
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return normalizeScore(total / values.length);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return normalizeScore(sorted[mid] as number);
  return normalizeScore(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

/** Proportion in [0,1], or null when the denominator is zero. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return roundTo(numerator / denominator, INTERNAL_PRECISION);
}

/** A rate expressed as a whole-number percentage for display. */
export function asPercent(value: number | null): number | null {
  return value === null ? null : roundTo(value * 100, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
