/**
 * Recommendation ranking. Spec 28.
 *
 * Order:
 *   1. Priority 1 -> 4
 *   2. Larger gap from threshold
 *   3. Greater proportion of respondents affected
 *   4. Lower rule id (deterministic final tie-break)
 *
 * Step 4 exists so that two rules with identical measurements always come back
 * in the same order. The engine must be reproducible run to run.
 */

import type { RecommendationResult } from './types.js';

function compareDescendingNullable(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function compareRecommendations(a: RecommendationResult, b: RecommendationResult): number {
  if (a.priority !== b.priority) return a.priority - b.priority;

  const byGap = compareDescendingNullable(a.gapFromThreshold, b.gapFromThreshold);
  if (byGap !== 0) return byGap;

  const byProportion = compareDescendingNullable(a.affectedProportion, b.affectedProportion);
  if (byProportion !== 0) return byProportion;

  return a.id.localeCompare(b.id);
}

export function rankRecommendations(
  results: readonly RecommendationResult[],
): readonly RecommendationResult[] {
  return [...results].sort(compareRecommendations);
}
