/**
 * Display bands. Spec 19.
 *
 * The band is a reading aid. The number and the underlying evidence matter
 * more than the label, and for small samples small differences between bands
 * should not be presented as meaningful.
 */

import { roundScore } from '../util/number.js';

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
  readonly min: number;
  readonly max: number;
}

export const SCORE_BAND_RANGES: readonly BandRange[] = [
  { band: 'low', min: 0, max: 24 },
  { band: 'emerging', min: 25, max: 49 },
  { band: 'developing', min: 50, max: 69 },
  { band: 'established', min: 70, max: 84 },
  { band: 'strong', min: 85, max: 100 },
];

/**
 * Bands are assigned from the display-rounded score so that the band a user
 * sees always matches the number they see next to it.
 */
export function bandForScore(score: number): ScoreBand {
  const displayed = roundScore(score);
  const match = SCORE_BAND_RANGES.find((r) => displayed >= r.min && displayed <= r.max);
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
