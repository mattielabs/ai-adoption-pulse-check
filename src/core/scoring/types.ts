/**
 * Scoring result types.
 *
 * A dimension that cannot be calculated returns a typed "not assessed" result.
 * It never returns 0, NaN, or a bare null: "we do not have enough information"
 * and "this organization scored zero" are different findings and the product
 * must never conflate them. Spec 12, 18.
 */

import type { Dimension, QuestionId } from '../survey/questions.js';

/** Sentinel for an answer that is legitimately outside the scale. */
export const NOT_ASSESSED = 'not_assessed' as const;
export type NotAssessed = typeof NOT_ASSESSED;

/** Sentinel for an answer the respondent simply did not provide. */
export const MISSING = 'missing' as const;
export type Missing = typeof MISSING;

/** The value a single question contributes, or a reason it contributes nothing. */
export type MappedValue = number | NotAssessed | Missing;

export interface WeightedInput {
  readonly questionId: QuestionId;
  /** Intended share of the dimension, expressed as a fraction of 1. */
  readonly weight: number;
  readonly value: MappedValue;
}

export interface ScoreDiagnostics {
  /** Fraction of the intended weighting that carried a valid scored value. */
  readonly validWeight: number;
  /** Questions the respondent answered with a legitimately unscoreable option. */
  readonly notAssessedInputs: readonly QuestionId[];
  /** Questions the respondent did not answer at all. */
  readonly missingInputs: readonly QuestionId[];
  /** Questions that contributed to the score. */
  readonly scoredInputs: readonly QuestionId[];
}

export type DimensionScore =
  | ({
      readonly dimension: Dimension;
      readonly assessed: true;
      /** 0-100, at internal precision. Use `roundScore` for display. */
      readonly score: number;
    } & ScoreDiagnostics)
  | ({
      readonly dimension: Dimension;
      readonly assessed: false;
      readonly reason: 'insufficient_valid_weight';
    } & ScoreDiagnostics);

/**
 * A dimension is calculated only when at least 60% of its intended weighting
 * carries a valid scored response. Spec 18.
 */
export const MIN_VALID_WEIGHT_RATIO = 0.6;

export interface RespondentScores {
  readonly adoption: DimensionScore;
  readonly confidence: DimensionScore;
  readonly workflow: DimensionScore;
  readonly safety: DimensionScore;
  readonly enablement: DimensionScore;
}

/** Interest is reported separately and is explicitly not a sixth dimension. Spec 22. */
export type InterestScore =
  | { readonly assessed: true; readonly score: number }
  | { readonly assessed: false; readonly reason: 'not_assessed' | 'missing' };

export function scoreOrNull(result: DimensionScore): number | null {
  return result.assessed ? result.score : null;
}
