/**
 * Recommendation deduplication. Spec 27.
 *
 * Three constraints, applied in order over an already-ranked list:
 *   1. Normally only one PRIMARY recommendation per family.
 *   2. No more than two primary recommendations may depend on the same root
 *      evidence question. This is the backstop that stops future rule
 *      additions from recreating recommendation flooding.
 *   3. At most three primary recommendations.
 *
 * Anything that fired but did not win a primary slot becomes an additional
 * opportunity/signal rather than disappearing.
 */

import type { QuestionId } from '../survey/questions.js';
import {
  MAX_ADDITIONAL_RECOMMENDATIONS,
  MAX_PRIMARY_PER_ROOT_QUESTION,
  MAX_PRIMARY_RECOMMENDATIONS,
  type RecommendationFamily,
  type RecommendationResult,
  type RecommendationSuppressionReason,
} from './types.js';

export interface DeduplicationOutcome {
  readonly primary: readonly RecommendationResult[];
  readonly additional: readonly RecommendationResult[];
}

function withSuppression(
  result: RecommendationResult,
  reason: RecommendationSuppressionReason,
): RecommendationResult {
  return { ...result, suppressionReason: reason, suppressedBy: null };
}

/**
 * @param ranked triggered recommendations, already sorted by `rankRecommendations`.
 */
export function deduplicateRecommendations(
  ranked: readonly RecommendationResult[],
): DeduplicationOutcome {
  const primary: RecommendationResult[] = [];
  const additional: RecommendationResult[] = [];

  const usedFamilies = new Set<RecommendationFamily>();
  const rootQuestionCounts = new Map<QuestionId, number>();

  for (const candidate of ranked) {
    if (primary.length >= MAX_PRIMARY_RECOMMENDATIONS) {
      additional.push(withSuppression(candidate, 'primary_slots_full'));
      continue;
    }
    if (usedFamilies.has(candidate.family)) {
      additional.push(withSuppression(candidate, 'family_already_represented'));
      continue;
    }
    const wouldExceedRootLimit = candidate.rootEvidenceQuestions.some(
      (q) => (rootQuestionCounts.get(q) ?? 0) >= MAX_PRIMARY_PER_ROOT_QUESTION,
    );
    if (wouldExceedRootLimit) {
      additional.push(withSuppression(candidate, 'root_evidence_limit'));
      continue;
    }

    primary.push(candidate);
    usedFamilies.add(candidate.family);
    for (const question of candidate.rootEvidenceQuestions) {
      rootQuestionCounts.set(question, (rootQuestionCounts.get(question) ?? 0) + 1);
    }
  }

  return {
    primary,
    additional: additional.slice(0, MAX_ADDITIONAL_RECOMMENDATIONS),
  };
}
