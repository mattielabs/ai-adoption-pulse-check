/**
 * Workflow - self-reported movement from isolated AI use toward repeatable
 * processes.
 *
 * Q15 (artifacts created) is deliberately NOT scored. It is corroborating
 * evidence for classification and champion signals only; scoring it would
 * double-count the same behaviour already captured by Q12. Spec 15, 71.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateWeightedDimension } from './weighting.js';
import { Q12_VALUES, Q13_VALUES, Q14_VALUES } from './mappings.js';
import { MISSING, type DimensionScore, type MappedValue } from './types.js';

export const WORKFLOW_WEIGHTS = {
  q12: 0.5,
  q13: 0.25,
  q14: 0.25,
} as const;

export function calculateWorkflow(answers: SurveyAnswers): DimensionScore {
  const q12: MappedValue = answers.q12 === undefined ? MISSING : Q12_VALUES[answers.q12];
  const q13: MappedValue = answers.q13 === undefined ? MISSING : Q13_VALUES[answers.q13];
  const q14: MappedValue = answers.q14 === undefined ? MISSING : Q14_VALUES[answers.q14];

  return calculateWeightedDimension('workflow', [
    { questionId: 'q12', weight: WORKFLOW_WEIGHTS.q12, value: q12 },
    { questionId: 'q13', weight: WORKFLOW_WEIGHTS.q13, value: q13 },
    { questionId: 'q14', weight: WORKFLOW_WEIGHTS.q14, value: q14 },
  ]);
}
