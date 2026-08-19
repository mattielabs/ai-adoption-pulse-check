/**
 * Personal focus recommendation for the employee's local result.
 *
 * This is a SMALL, SEPARATE ruleset. It is deliberately not the organization
 * recommendation engine: that engine reasons about aggregates and priorities
 * across a whole company; this one gives a single employee exactly
 *
 *   1 Primary Focus + 1 Suggested Next Step
 *
 * and nothing else. Spec 36 (source of truth), 23 (Phase 1 brief).
 *
 * Rules are evaluated in fixed order and the first match wins, so the result
 * is deterministic for any input. The safety rule is first for the same
 * reason R01 is Priority 1 in the organization engine: risk before growth.
 *
 * Like everything respondent-level, this runs locally in the browser and its
 * output is never sent to the server.
 */

import type { RespondentScores } from '../scoring/types.js';
import { scoreOrNull } from '../scoring/types.js';
import type { RespondentClassification } from '../classification/classifyRespondent.js';

export const FOCUS_THRESHOLDS = {
  /** Adoption at/above this with Safety below its floor means safety comes first. */
  SAFETY_RULE_ADOPTION_MIN: 60,
  SAFETY_RULE_SAFETY_MAX: 50,
  /** The "document a workflow" rule mirrors the potential-champion bar. */
  STRONG_CONFIDENCE_MIN: 70,
  STRONG_WORKFLOW_MIN: 75,
  STRONG_SAFETY_MIN: 70,
  /** Regular users below this Workflow score are nudged toward repeatability. */
  REPEATABLE_WORKFLOW_MAX: 50,
} as const;

export type PersonalFocusId =
  | 'strengthen_safety'
  | 'document_workflow'
  | 'start_small'
  | 'make_repeatable'
  | 'consolidate';

export interface PersonalFocus {
  readonly id: PersonalFocusId;
  readonly primary: string;
  readonly nextStep: string;
}

const FOCUS_COPY: Readonly<Record<PersonalFocusId, Omit<PersonalFocus, 'id'>>> = {
  strengthen_safety: {
    primary: 'Strengthen verification and data-handling habits.',
    nextStep:
      'Review important outputs and confirm what information is appropriate to share before expanding your AI use.',
  },
  document_workflow: {
    primary: 'Look for a workflow worth documenting or improving.',
    nextStep:
      'Take one repeatable AI-assisted process and make the steps, review points, and expected outcome explicit.',
  },
  start_small: {
    primary: 'Start with one low-risk recurring task.',
    nextStep:
      'Choose something you already do regularly and test whether AI makes it easier without sharing sensitive information.',
  },
  make_repeatable: {
    primary: 'Turn one useful AI task into a repeatable process.',
    nextStep:
      'Save the prompt or steps you already use successfully instead of starting from scratch each time.',
  },
  consolidate: {
    primary: 'Strengthen the reliability of your existing AI use.',
    nextStep:
      'Pick one AI-assisted task you already do and tighten how you review, reuse, and improve it.',
  },
};

function focus(id: PersonalFocusId): PersonalFocus {
  return { id, ...FOCUS_COPY[id] };
}

/**
 * Always returns exactly one focus. Rules that need a score skip themselves
 * when that score could not be assessed - a missing score never triggers a
 * risk message, and never blocks the fallback.
 */
export function decidePersonalFocus(
  scores: RespondentScores,
  classification: RespondentClassification,
): PersonalFocus {
  const adoption = scoreOrNull(scores.adoption);
  const confidence = scoreOrNull(scores.confidence);
  const workflow = scoreOrNull(scores.workflow);
  const safety = scoreOrNull(scores.safety);
  const level = classification.classified ? classification.level : null;

  // 1. High adoption with weak self-reported safety: risk first, always.
  if (
    adoption !== null &&
    safety !== null &&
    adoption >= FOCUS_THRESHOLDS.SAFETY_RULE_ADOPTION_MIN &&
    safety < FOCUS_THRESHOLDS.SAFETY_RULE_SAFETY_MAX
  ) {
    return focus('strengthen_safety');
  }

  // 2. Strong confidence + workflow + safety: the next step is documentation,
  //    not more basics. (Deliberately says nothing about being a "champion" -
  //    that is an organization-level, opt-in concept.)
  if (
    confidence !== null &&
    workflow !== null &&
    safety !== null &&
    confidence >= FOCUS_THRESHOLDS.STRONG_CONFIDENCE_MIN &&
    workflow >= FOCUS_THRESHOLDS.STRONG_WORKFLOW_MIN &&
    safety >= FOCUS_THRESHOLDS.STRONG_SAFETY_MIN
  ) {
    return focus('document_workflow');
  }

  // 3. Non-user / Explorer (or unclassifiable): start small.
  if (level === null || level <= 1) {
    return focus('start_small');
  }

  // 4. Regular user whose use is still task-by-task: make one thing repeatable.
  if (level === 2 && workflow !== null && workflow < FOCUS_THRESHOLDS.REPEATABLE_WORKFLOW_MAX) {
    return focus('make_repeatable');
  }

  // 5. Everyone else - established users who did not match a sharper rule.
  return focus('consolidate');
}
