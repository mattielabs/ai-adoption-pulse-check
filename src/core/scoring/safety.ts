/**
 * Safety - SELF-REPORTED verification, review and data-handling awareness.
 *
 * This dimension is asymmetric and must be described that way everywhere:
 *   - a LOW score is a meaningful risk signal;
 *   - a HIGH score is NOT proof that behaviour is actually safe.
 *
 * It is not a compliance audit and not a measure of verified safety. Spec 5.5, 16.
 *
 * Q19 (approved-tool clarity) is deliberately NOT part of Safety in V1.1 - it
 * measures what the organization supplied, so it belongs to Enablement.
 * Q19b (unmanaged tool use) is diagnostic only and never scored, though it is
 * used as evidence by the recommendation engine.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateWeightedDimension } from './weighting.js';
import { FREQUENCY_VALUES, Q18_VALUES } from './mappings.js';
import { MISSING, type DimensionScore, type MappedValue } from './types.js';

export const SAFETY_WEIGHTS = {
  q16: 0.4,
  q17: 0.3,
  q18: 0.3,
} as const;

export function calculateSafety(answers: SurveyAnswers): DimensionScore {
  const q16: MappedValue = answers.q16 === undefined ? MISSING : FREQUENCY_VALUES[answers.q16];
  const q17: MappedValue = answers.q17 === undefined ? MISSING : FREQUENCY_VALUES[answers.q17];
  const q18: MappedValue = answers.q18 === undefined ? MISSING : Q18_VALUES[answers.q18];

  return calculateWeightedDimension('safety', [
    { questionId: 'q16', weight: SAFETY_WEIGHTS.q16, value: q16 },
    { questionId: 'q17', weight: SAFETY_WEIGHTS.q17, value: q17 },
    { questionId: 'q18', weight: SAFETY_WEIGHTS.q18, value: q18 },
  ]);
}
