/**
 * Adoption - self-reported frequency and breadth of work-related AI use.
 *
 * Q4 (general AI use) is deliberately excluded. It exists so the dashboard can
 * compare general AI familiarity against workplace AI use, but including it
 * would let personal-life usage inflate an organizational adoption figure.
 * Spec 13, 71.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateWeightedDimension } from './weighting.js';
import { Q5_VALUES, q7BreadthValue } from './mappings.js';
import { MISSING, type DimensionScore, type MappedValue } from './types.js';

export const ADOPTION_WEIGHTS = {
  q5: 0.7,
  q7: 0.3,
} as const;

function q5Value(answers: SurveyAnswers): MappedValue {
  return answers.q5 === undefined ? MISSING : Q5_VALUES[answers.q5];
}

function q7Value(answers: SurveyAnswers): MappedValue {
  const selections = answers.q7;
  // An absent or empty selection set is an unanswered question, not a genuine
  // breadth of zero. A respondent who uses no AI selects the explicit
  // "I do not currently use AI for work" option, which does score 0.
  if (selections === undefined || selections.length === 0) return MISSING;
  return q7BreadthValue(selections);
}

export function calculateAdoption(answers: SurveyAnswers): DimensionScore {
  return calculateWeightedDimension('adoption', [
    { questionId: 'q5', weight: ADOPTION_WEIGHTS.q5, value: q5Value(answers) },
    { questionId: 'q7', weight: ADOPTION_WEIGHTS.q7, value: q7Value(answers) },
  ]);
}
