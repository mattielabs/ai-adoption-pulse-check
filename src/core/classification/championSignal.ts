/**
 * Potential champion signal.
 *
 * A respondent qualifies when Workflow >= 75, Confidence >= 70 and Safety >= 70,
 * plus Q12/Q15 corroboration. The organization-level signal requires at least
 * three qualifying respondents, and identities are NEVER produced - not the
 * respondent id, not the row, not a filtered subset. Spec 23.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import type { RespondentScores } from '../scoring/types.js';
import { LEVEL_4_EVIDENCE, REUSABLE_ARTIFACT_EVIDENCE } from './classifyRespondent.js';

export const CHAMPION_THRESHOLDS = {
  workflow: 75,
  confidence: 70,
  safety: 70,
} as const;

/** Minimum qualifying respondents before the organization-level signal exists. */
export const MIN_CHAMPIONS_FOR_SIGNAL = 3;

/**
 * Below this many qualifying respondents the dashboard shows "3+ potential
 * champions" rather than an exact count, so that a very small group cannot be
 * narrowed down by elimination.
 */
export const EXACT_CHAMPION_COUNT_THRESHOLD = 5;

/**
 * Interpretation of "plus Q12/Q15 corroboration": the respondent must either
 * report repeatable-process or builder behaviour on Q12, or report a concrete
 * artifact / coworker-enablement action on Q15. Scores alone are not enough,
 * because all three inputs are self-reported.
 */
function hasCorroboration(answers: SurveyAnswers): boolean {
  const q12 = answers.q12;
  if (q12 === 'repeatable_processes' || q12 === 'built_workflows_tools') return true;
  const q15 = answers.q15 ?? [];
  return q15.some(
    (value) => LEVEL_4_EVIDENCE.includes(value) || REUSABLE_ARTIFACT_EVIDENCE.includes(value),
  );
}

export function isPotentialChampion(answers: SurveyAnswers, scores: RespondentScores): boolean {
  if (!scores.workflow.assessed || scores.workflow.score < CHAMPION_THRESHOLDS.workflow) return false;
  if (!scores.confidence.assessed || scores.confidence.score < CHAMPION_THRESHOLDS.confidence) return false;
  if (!scores.safety.assessed || scores.safety.score < CHAMPION_THRESHOLDS.safety) return false;
  return hasCorroboration(answers);
}

export interface ChampionSignal {
  readonly qualifyingCount: number;
  readonly signalPresent: boolean;
  /** Privacy-safe text for display. Never an exact count below the disclosure threshold. */
  readonly displayCount: string | null;
}

export function summarizeChampionSignal(qualifyingCount: number): ChampionSignal {
  const signalPresent = qualifyingCount >= MIN_CHAMPIONS_FOR_SIGNAL;
  if (!signalPresent) {
    return { qualifyingCount, signalPresent: false, displayCount: null };
  }
  const displayCount =
    qualifyingCount < EXACT_CHAMPION_COUNT_THRESHOLD
      ? `${MIN_CHAMPIONS_FOR_SIGNAL}+ potential champions`
      : `${qualifyingCount} potential champions`;
  return { qualifyingCount, signalPresent: true, displayCount };
}
