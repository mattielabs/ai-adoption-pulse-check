/**
 * Confidence - SELF-REPORTED confidence using and evaluating AI.
 *
 * This dimension was renamed from "Capability" in V1.1 precisely so that
 * nothing in the codebase or the UI can imply it measures demonstrated skill.
 * It does not. Do not rename it back, and do not describe it as capability,
 * proficiency, or competence. Spec 5.5, 14, 71.
 *
 * Q8-Q11 carry equal weight (25% each). "I have not done this" is Not Assessed
 * rather than zero: never having attempted something is not the same as being
 * unconfident at it.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateWeightedDimension } from './weighting.js';
import { CONFIDENCE_VALUES } from './mappings.js';
import { MISSING, type DimensionScore, type MappedValue, type WeightedInput } from './types.js';

export const CONFIDENCE_QUESTION_IDS = ['q8', 'q9', 'q10', 'q11'] as const;

/** Equal weighting across the four items. */
export const CONFIDENCE_ITEM_WEIGHT = 1 / CONFIDENCE_QUESTION_IDS.length;

function itemValue(answers: SurveyAnswers, id: (typeof CONFIDENCE_QUESTION_IDS)[number]): MappedValue {
  const answer = answers[id];
  return answer === undefined ? MISSING : CONFIDENCE_VALUES[answer];
}

export function calculateConfidence(answers: SurveyAnswers): DimensionScore {
  const inputs: WeightedInput[] = CONFIDENCE_QUESTION_IDS.map((id) => ({
    questionId: id,
    weight: CONFIDENCE_ITEM_WEIGHT,
    value: itemValue(answers, id),
  }));
  return calculateWeightedDimension('confidence', inputs);
}
