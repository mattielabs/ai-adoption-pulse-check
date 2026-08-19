/**
 * Recommendation engine orchestration.
 *
 * Pipeline:
 *   evaluate all ten rules
 *     -> apply merge / suppression relationships
 *     -> rank
 *     -> deduplicate into at most 3 primary + 3 additional
 *
 * Merge and suppression live here rather than inside the rules so each rule
 * stays an independently testable pure function. Spec 26, 27, 28.
 */

import { RECOMMENDATION_ENGINE_VERSION } from '../versions.js';
import { RULES, RULES_BY_ID } from './rules.js';
import type { RecommendationContext } from './evidence.js';
import { rankRecommendations } from './ranking.js';
import { deduplicateRecommendations } from './deduplication.js';
import {
  EARLY_SIGNAL_MAX_SAMPLE,
  MIN_ORGANIZATION_SAMPLE,
  type ConfidenceLabel,
  type MergedFinding,
  type RecommendationEngineResult,
  type RecommendationId,
  type RecommendationResult,
} from './types.js';

function confidenceLabelFor(sampleSize: number, supportingMeasures: number): ConfidenceLabel {
  // Early Signal is reserved for genuinely small samples. Spec 29.
  if (sampleSize < EARLY_SIGNAL_MAX_SAMPLE) return 'early_signal';
  return supportingMeasures >= 2 ? 'strong_signal' : 'signal';
}

function evaluateAll(ctx: RecommendationContext): Map<RecommendationId, RecommendationResult> {
  const results = new Map<RecommendationId, RecommendationResult>();
  for (const rule of RULES) {
    const evaluation = rule.evaluate(ctx);
    results.set(rule.id, {
      id: rule.id,
      engineVersion: RECOMMENDATION_ENGINE_VERSION,
      family: rule.family,
      priority: rule.priority,
      title: rule.title,
      triggered: evaluation.triggered,
      evaluable: evaluation.evaluable,
      conditions: evaluation.conditions,
      evidence: evaluation.evidence,
      actionKeys: rule.actionKeys,
      recommendedAction: rule.recommendedAction,
      confidenceLabel: evaluation.triggered
        ? confidenceLabelFor(ctx.responseCount, evaluation.supportingMeasures)
        : null,
      rootEvidenceQuestions: rule.rootEvidenceQuestions,
      gapFromThreshold: evaluation.gapFromThreshold,
      affectedProportion: evaluation.affectedProportion,
      mergedFindings: [],
      suppressedBy: null,
      suppressionReason: null,
    });
  }
  return results;
}

function suppress(
  result: RecommendationResult,
  by: RecommendationId,
  reason: 'merged_into_r01' | 'explained_by_r04',
): RecommendationResult {
  return { ...result, suppressedBy: by, suppressionReason: reason };
}

function mergeInto(
  target: RecommendationResult,
  source: RecommendationResult,
  summary: string,
): RecommendationResult {
  const finding: MergedFinding = { sourceId: source.id, summary, evidence: source.evidence };
  return { ...target, mergedFindings: [...target.mergedFindings, finding] };
}

/**
 * Applies the cross-rule relationships defined in the spec:
 *
 *   R03 -> R01  verification weakness becomes a sub-finding of the broader
 *               Safety recommendation rather than a second Priority-1 slot.
 *   R10 -> R01  unmanaged-tool reliance becomes a supporting finding of R01.
 *   R07 <- R04  interest-not-converting is suppressed because weak Enablement
 *               already explains the adoption gap.
 *
 * These are applied deterministically, not "may be merged": the engine must
 * produce identical output for identical input.
 */
function applyRelationships(
  results: Map<RecommendationId, RecommendationResult>,
): Map<RecommendationId, RecommendationResult> {
  const next = new Map(results);
  const r01 = next.get('R01') as RecommendationResult;
  const r03 = next.get('R03') as RecommendationResult;
  const r04 = next.get('R04') as RecommendationResult;
  const r07 = next.get('R07') as RecommendationResult;
  const r10 = next.get('R10') as RecommendationResult;

  let mergedR01 = r01;

  if (r01.triggered && r03.triggered) {
    mergedR01 = mergeInto(
      mergedR01,
      r03,
      'Verification and human-review weakness is folded into the broader safe-use recommendation.',
    );
    next.set('R03', suppress(r03, 'R01', 'merged_into_r01'));
  }

  if (r01.triggered && r10.triggered) {
    mergedR01 = mergeInto(
      mergedR01,
      r10,
      'Reliance on independently accessed AI tools is reported as a supporting finding rather than a separate priority.',
    );
    next.set('R10', suppress(r10, 'R01', 'merged_into_r01'));
  }

  if (mergedR01 !== r01) next.set('R01', mergedR01);

  if (r04.triggered && r07.triggered) {
    next.set('R07', suppress(r07, 'R04', 'explained_by_r04'));
  }

  return next;
}

export function runRecommendationEngine(ctx: RecommendationContext): RecommendationEngineResult {
  const sampleSize = ctx.responseCount;

  if (sampleSize < MIN_ORGANIZATION_SAMPLE) {
    return {
      engineVersion: RECOMMENDATION_ENGINE_VERSION,
      status: 'insufficient_sample',
      sampleSize,
      primary: [],
      additional: [],
      triggered: [],
      evaluated: [],
    };
  }

  const evaluated = applyRelationships(evaluateAll(ctx));
  const all = RULES.map((rule) => evaluated.get(rule.id) as RecommendationResult);

  // A rule that fired but was merged or explained away never competes for a slot.
  const eligible = all.filter((r) => r.triggered && r.suppressedBy === null);
  const ranked = rankRecommendations(eligible);
  const { primary, additional } = deduplicateRecommendations(ranked);

  return {
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    status: 'ok',
    sampleSize,
    primary,
    additional,
    triggered: ranked,
    evaluated: all,
  };
}

export { RULES, RULES_BY_ID };
