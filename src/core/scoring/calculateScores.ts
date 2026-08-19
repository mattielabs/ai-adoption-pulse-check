/**
 * Entry point for respondent-level scoring.
 *
 * There are five separate dimensions and deliberately no combined "AI maturity"
 * number. One average would hide exactly the differences the product exists to
 * surface (e.g. high Adoption alongside low Safety). Spec 5.3.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import { calculateAdoption } from './adoption.js';
import { calculateConfidence } from './confidence.js';
import { calculateWorkflow } from './workflow.js';
import { calculateSafety } from './safety.js';
import { calculateEnablement } from './enablement.js';
import { Q28_VALUES } from './mappings.js';
import { NOT_ASSESSED, type InterestScore, type RespondentScores } from './types.js';

export function calculateScores(answers: SurveyAnswers): RespondentScores {
  return {
    adoption: calculateAdoption(answers),
    confidence: calculateConfidence(answers),
    workflow: calculateWorkflow(answers),
    safety: calculateSafety(answers),
    enablement: calculateEnablement(answers),
  };
}

/** Q28 Interest. Separate from the five dimensions by design. Spec 22. */
export function calculateInterest(answers: SurveyAnswers): InterestScore {
  if (answers.q28 === undefined) return { assessed: false, reason: 'missing' };
  const value = Q28_VALUES[answers.q28];
  if (value === NOT_ASSESSED) return { assessed: false, reason: 'not_assessed' };
  return { assessed: true, score: value };
}

export { calculateAdoption, calculateConfidence, calculateWorkflow, calculateSafety, calculateEnablement };
