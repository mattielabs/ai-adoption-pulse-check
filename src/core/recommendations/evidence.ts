/**
 * Builds the immutable input context the recommendation rules read from.
 *
 * Rules never touch raw responses. They read measured organization values only,
 * which keeps every rule a pure function of a small typed record and makes
 * threshold tests trivial to write.
 */

import type { OrganizationAggregate } from '../aggregation/aggregate.js';
import type { SurveyResponse } from '../survey/answers.js';
import type { ScoredQuestionId } from '../scoring/questionValues.js';
import { SCORED_QUESTION_IDS, questionValue } from '../scoring/questionValues.js';
import { MISSING, NOT_ASSESSED } from '../scoring/types.js';
import { topOptions } from '../aggregation/distributions.js';
import { rate } from '../util/number.js';
import type { Comparator, EvidenceItem, RuleCondition } from './types.js';

export interface TopOption {
  readonly optionId: string;
  readonly count: number;
  readonly rate: number | null;
}

export interface RecommendationContext {
  readonly responseCount: number;

  // Dimension means. Null means "not assessable", never "zero".
  readonly adoption: number | null;
  readonly confidence: number | null;
  readonly workflow: number | null;
  readonly safety: number | null;
  readonly enablement: number | null;
  readonly interest: number | null;

  readonly questionScores: Readonly<Record<ScoredQuestionId, number | null>>;

  /** Q19b: share of valid responses reporting Sometimes or Often. Excludes "Prefer not to say". */
  readonly unmanagedToolRate: number | null;
  readonly unmanagedToolPreferNotToSayCount: number;
  readonly noOrgProvidedAccessRate: number | null;

  readonly championCount: number;

  /** Respondent-level shares, used for the "proportion affected" ranking tie-break. */
  readonly proportions: {
    readonly lowAdoption: number | null;
    readonly lowConfidence: number | null;
    readonly lowWorkflow: number | null;
    readonly lowSafety: number | null;
    readonly lowEnablement: number | null;
    readonly highInterest: number | null;
    /** Respondents scoring below 50 on Q16 or Q17. */
    readonly weakVerification: number | null;
    /** Respondents scoring below 50 on Q18, Q19 or Q20. */
    readonly unclearGuidance: number | null;
  };

  readonly topBarriers: readonly TopOption[];
  readonly topTrainingDemand: readonly TopOption[];
  readonly topLearningPreferences: readonly TopOption[];
}

export const LOW_SCORE_THRESHOLD = 50;
export const HIGH_INTEREST_THRESHOLD = 70;
export const LOW_ADOPTION_THRESHOLD = 40;

/**
 * Share of respondents scoring below `threshold` on ANY of the given questions.
 * The denominator is respondents for whom at least one of those questions
 * produced a scored value, so Not-Assessed answers neither inflate nor deflate
 * the share.
 */
function shareBelowOnAnyQuestion(
  responses: readonly SurveyResponse[],
  questionIds: readonly ScoredQuestionId[],
  threshold: number,
): number | null {
  let denominator = 0;
  let numerator = 0;
  for (const response of responses) {
    const values = questionIds
      .map((id) => questionValue(response.answers, id))
      .filter((v): v is number => v !== NOT_ASSESSED && v !== MISSING);
    if (values.length === 0) continue;
    denominator += 1;
    if (values.some((v) => v < threshold)) numerator += 1;
  }
  return rate(numerator, denominator);
}

export function buildRecommendationContext(
  aggregate: OrganizationAggregate,
  responses: readonly SurveyResponse[],
): RecommendationContext {
  const questionScores = Object.fromEntries(
    SCORED_QUESTION_IDS.map((id) => [id, aggregate.questionScores[id].mean]),
  ) as Record<ScoredQuestionId, number | null>;

  const respondents = aggregate.respondents;

  const shareBelow = (
    pick: (r: (typeof respondents)[number]) => number | null,
    threshold: number,
  ): number | null => {
    const assessed = respondents.map(pick).filter((v): v is number => v !== null);
    return rate(assessed.filter((v) => v < threshold).length, assessed.length);
  };

  const assessedInterest = respondents.map((r) => r.interest).filter((v): v is number => v !== null);

  return {
    responseCount: respondents.length,
    adoption: aggregate.dimensions.adoption.mean,
    confidence: aggregate.dimensions.confidence.mean,
    workflow: aggregate.dimensions.workflow.mean,
    safety: aggregate.dimensions.safety.mean,
    enablement: aggregate.dimensions.enablement.mean,
    interest: aggregate.interest.mean,
    questionScores,
    unmanagedToolRate: aggregate.diagnostics.unmanagedTools.sometimesOrOftenRate,
    unmanagedToolPreferNotToSayCount: aggregate.diagnostics.unmanagedTools.preferNotToSayCount,
    noOrgProvidedAccessRate: aggregate.diagnostics.unmanagedTools.noOrgProvidedAccessRate,
    championCount: aggregate.championSignal.qualifyingCount,
    proportions: {
      lowAdoption: shareBelow(
        (r) => (r.scores.adoption.assessed ? r.scores.adoption.score : null),
        LOW_ADOPTION_THRESHOLD,
      ),
      lowConfidence: shareBelow(
        (r) => (r.scores.confidence.assessed ? r.scores.confidence.score : null),
        LOW_SCORE_THRESHOLD,
      ),
      lowWorkflow: shareBelow(
        (r) => (r.scores.workflow.assessed ? r.scores.workflow.score : null),
        LOW_SCORE_THRESHOLD,
      ),
      lowSafety: shareBelow(
        (r) => (r.scores.safety.assessed ? r.scores.safety.score : null),
        LOW_SCORE_THRESHOLD,
      ),
      lowEnablement: shareBelow(
        (r) => (r.scores.enablement.assessed ? r.scores.enablement.score : null),
        LOW_SCORE_THRESHOLD,
      ),
      highInterest: rate(
        assessedInterest.filter((v) => v >= HIGH_INTEREST_THRESHOLD).length,
        assessedInterest.length,
      ),
      weakVerification: shareBelowOnAnyQuestion(responses, ['q16', 'q17'], LOW_SCORE_THRESHOLD),
      unclearGuidance: shareBelowOnAnyQuestion(responses, ['q18', 'q19', 'q20'], LOW_SCORE_THRESHOLD),
    },
    topBarriers: topOptions(aggregate.diagnostics.barriers, 5),
    topTrainingDemand: topOptions(aggregate.diagnostics.trainingDemand, 5),
    topLearningPreferences: topOptions(aggregate.diagnostics.learningPreferences, 5),
  };
}

// --- Small builders shared by every rule -----------------------------------

export function condition(
  id: string,
  description: string,
  actual: number | null,
  comparator: Comparator,
  threshold: number,
): RuleCondition {
  const met = actual === null ? false : compare(actual, comparator, threshold);
  return { id, description, actual, threshold, comparator, met };
}

export function compare(actual: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case 'gte':
      return actual >= threshold;
    case 'gt':
      return actual > threshold;
    case 'lt':
      return actual < threshold;
    case 'lte':
      return actual <= threshold;
    default: {
      const exhaustive: never = comparator;
      throw new Error(`Unhandled comparator: ${String(exhaustive)}`);
    }
  }
}

export function evidenceItem(item: EvidenceItem): EvidenceItem {
  return item;
}

/** True when every condition could actually be evaluated (no null inputs). */
export function allEvaluable(conditions: readonly RuleCondition[]): boolean {
  return conditions.every((c) => c.actual !== null);
}

export function allMet(conditions: readonly RuleCondition[]): boolean {
  return conditions.every((c) => c.met);
}

/** The smallest non-null value, or null when every value is null. */
export function minDefined(values: readonly (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v !== null);
  return defined.length === 0 ? null : Math.min(...defined);
}
