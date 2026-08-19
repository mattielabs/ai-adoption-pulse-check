/**
 * Local personal result.
 *
 * Calculated entirely in the browser with the SAME versioned core modules the
 * Worker uses for organization analysis. No second request is made and the
 * result is never sent to the server - the employee's individual scores exist
 * only on their device. Spec 36, Phase 1 brief 20.
 */

import type { SurveyAnswers } from '../../core/survey/answers.js';
import { calculateScores } from '../../core/scoring/calculateScores.js';
import { scoreOrNull } from '../../core/scoring/types.js';
import { classifyRespondent } from '../../core/classification/classifyRespondent.js';
import { decidePersonalFocus, type PersonalFocus } from '../../core/personal/focus.js';
import { SCORING_VERSION } from '../../core/versions.js';

export interface PersonalResultData {
  readonly scoringVersion: string;
  readonly classificationLabel: string | null;
  readonly scores: {
    readonly adoption: number | null;
    readonly confidence: number | null;
    readonly workflow: number | null;
    readonly safety: number | null;
    /** Displayed as "Organization Support Experience", never as personal ability. */
    readonly enablement: number | null;
  };
  readonly focus: PersonalFocus;
}

export function computePersonalResult(answers: SurveyAnswers): PersonalResultData {
  const scores = calculateScores(answers);
  const classification = classifyRespondent(answers);

  return {
    scoringVersion: SCORING_VERSION,
    classificationLabel: classification.classified ? classification.label : null,
    scores: {
      adoption: scoreOrNull(scores.adoption),
      confidence: scoreOrNull(scores.confidence),
      workflow: scoreOrNull(scores.workflow),
      safety: scoreOrNull(scores.safety),
      enablement: scoreOrNull(scores.enablement),
    },
    focus: decidePersonalFocus(scores, classification),
  };
}
