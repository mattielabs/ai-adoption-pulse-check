/**
 * Display bands. Spec 19.
 *
 * The band is a reading aid. The number and the underlying evidence matter
 * more than the label, and for small samples small differences between bands
 * should not be presented as meaningful.
 */

export const SCORE_BANDS = ['low', 'emerging', 'developing', 'established', 'strong'] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export const SCORE_BAND_LABELS: Readonly<Record<ScoreBand, string>> = {
  low: 'Low',
  emerging: 'Emerging',
  developing: 'Developing',
  established: 'Established',
  strong: 'Strong',
};

interface BandRange {
  readonly band: ScoreBand;
  /** Inclusive lower bound on the raw score. */
  readonly min: number;
  /** Exclusive upper bound on the raw score, except for the top band. */
  readonly max: number;
}

/**
 * Spec 19 presents the bands as the whole-number ranges 0-24, 25-49, 50-69,
 * 70-84, 85-100. Scores are continuous, so those are read as the continuous
 * half-open intervals below: a boundary value belongs to the band it opens.
 */
export const SCORE_BAND_RANGES: readonly BandRange[] = [
  { band: 'low', min: 0, max: 25 },
  { band: 'emerging', min: 25, max: 50 },
  { band: 'developing', min: 50, max: 70 },
  { band: 'established', min: 70, max: 85 },
  { band: 'strong', min: 85, max: 100 },
];

/**
 * Bands are assigned from the raw score, never from a rounded one.
 *
 * Rounding first moved every boundary down by half a point - 24.87 landed in
 * Emerging, whose documented range starts at 25 - which quietly disagreed with
 * the thresholds the recommendation engine compares against.
 */
export function bandForScore(score: number): ScoreBand {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`Score outside 0-100 range: ${score}`);
  }
  // The top band is closed at 100; every other range is half-open.
  const match = SCORE_BAND_RANGES.find((r) => score >= r.min && (score < r.max || r.max === 100));
  if (!match) {
    throw new Error(`Score outside 0-100 range: ${score}`);
  }
  return match.band;
}

export function emptyBandDistribution(): Record<ScoreBand, number> {
  return { low: 0, emerging: 0, developing: 0, established: 0, strong: 0 };
}

/** Sample-size caveat text. Spec 19, 32. */
export function sampleCaveat(n: number): string | null {
  if (n < 5) return 'Below the minimum reporting threshold of 5 responses.';
  if (n < 10) return 'Early directional results - interpret cautiously.';
  if (n < 30) return 'Treat small score differences cautiously; this is directional self-report data.';
  return null;
}
