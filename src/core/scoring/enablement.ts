/**
 * Enablement - employee-reported organizational clarity, access and training.
 *
 * This measures the ORGANIZATION's support as experienced by employees. In the
 * personal result it must be framed as "organization support experience", never
 * as something the employee scored on. Spec 17, 36.
 *
 * "Unsure" maps to 0 across Q19-Q22 by design: guidance an employee does not
 * know about is not effectively enabling them. Because that choice can look
 * harsh, the aggregate always reports the Unsure/unclear rate beside the score.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateWeightedDimension } from './weighting.js';
import { AGREEMENT_VALUES, Q19_VALUES } from './mappings.js';
import { MISSING, type DimensionScore, type MappedValue } from './types.js';

export const ENABLEMENT_WEIGHTS = {
  q19: 0.2,
  q20: 0.3,
  q21: 0.2,
  q22: 0.3,
} as const;

export function calculateEnablement(answers: SurveyAnswers): DimensionScore {
  const q19: MappedValue = answers.q19 === undefined ? MISSING : Q19_VALUES[answers.q19];
  const q20: MappedValue = answers.q20 === undefined ? MISSING : AGREEMENT_VALUES[answers.q20];
  const q21: MappedValue = answers.q21 === undefined ? MISSING : AGREEMENT_VALUES[answers.q21];
  const q22: MappedValue = answers.q22 === undefined ? MISSING : AGREEMENT_VALUES[answers.q22];

  return calculateWeightedDimension('enablement', [
    { questionId: 'q19', weight: ENABLEMENT_WEIGHTS.q19, value: q19 },
    { questionId: 'q20', weight: ENABLEMENT_WEIGHTS.q20, value: q20 },
    { questionId: 'q21', weight: ENABLEMENT_WEIGHTS.q21, value: q21 },
    { questionId: 'q22', weight: ENABLEMENT_WEIGHTS.q22, value: q22 },
  ]);
}
