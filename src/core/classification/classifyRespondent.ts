/**
 * Employee behaviour classification.
 *
 * The ladder is ORDERED and EXHAUSTIVE. Rules are evaluated strictly from
 * Level 4 down to Level 0 and the first valid match wins. Contradictory but
 * valid responses fall through to the most conservative level that still
 * matches, rather than becoming unclassified. Spec 20.
 *
 * Exhaustiveness is enforced by a generated test that walks every valid
 * Q5 x Q12 x Q13 x Q14 x Q15 combination.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import type * as O from '../survey/options.js';
import { Q5_RANK, Q12_RANK, Q13_RANK, Q14_RANK } from '../scoring/mappings.js';

export const CLASSIFICATION_LEVELS = [0, 1, 2, 3, 4] as const;
export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number];

export type ClassificationKey =
  | 'non_user'
  | 'explorer'
  | 'regular_user'
  | 'workflow_user'
  | 'builder_champion';

export const CLASSIFICATION_LABELS: Readonly<Record<ClassificationKey, string>> = {
  non_user: 'Non-user',
  explorer: 'Explorer',
  regular_user: 'Regular User',
  workflow_user: 'Workflow User',
  builder_champion: 'Builder / Champion',
};

export const CLASSIFICATION_KEY_BY_LEVEL: Readonly<Record<ClassificationLevel, ClassificationKey>> = {
  0: 'non_user',
  1: 'explorer',
  2: 'regular_user',
  3: 'workflow_user',
  4: 'builder_champion',
};

/**
 * Q15 options that corroborate Level 4. Taken verbatim from the spec: an
 * automated AI workflow, an AI agent, an AI tool/application, a shared prompt
 * library, documentation/training, or having helped coworkers.
 */
export const LEVEL_4_EVIDENCE: readonly O.Q15Option[] = [
  'automated_workflow',
  'ai_agent',
  'ai_tool_application',
  'shared_prompt_library',
  'documentation_training',
  'helped_coworkers',
];

/**
 * Q15 options that count as "a reusable system or artifact" for Level 3
 * corroboration, and as contradictory evidence against Level 0.
 *
 * Interpretation: this is the artifact-producing subset. `documentation_training`
 * and `helped_coworkers` are excluded here because they are enablement of other
 * people rather than a reusable system the respondent themselves runs on.
 */
export const REUSABLE_ARTIFACT_EVIDENCE: readonly O.Q15Option[] = [
  'reusable_prompt_template',
  'shared_prompt_library',
  'custom_gpt_project',
  'automated_workflow',
  'ai_agent',
  'ai_tool_application',
];

export interface ClassificationResult {
  readonly classified: true;
  readonly level: ClassificationLevel;
  readonly key: ClassificationKey;
  readonly label: string;
  /** Which ladder rule matched, for explainability in the dashboard and tests. */
  readonly matchedRule: string;
  readonly reasons: readonly string[];
}

export interface ClassificationUnavailable {
  readonly classified: false;
  readonly reason: 'missing_required_answers';
  readonly missing: readonly ('q5' | 'q12')[];
}

export type RespondentClassification = ClassificationResult | ClassificationUnavailable;

function hasAny(selected: readonly string[] | undefined, candidates: readonly string[]): boolean {
  if (!selected) return false;
  return selected.some((value) => candidates.includes(value));
}

function build(
  level: ClassificationLevel,
  matchedRule: string,
  reasons: readonly string[],
): ClassificationResult {
  const key = CLASSIFICATION_KEY_BY_LEVEL[level];
  return { classified: true, level, key, label: CLASSIFICATION_LABELS[key], matchedRule, reasons };
}

export function classifyRespondent(answers: SurveyAnswers): RespondentClassification {
  const missing: ('q5' | 'q12')[] = [];
  if (answers.q5 === undefined) missing.push('q5');
  if (answers.q12 === undefined) missing.push('q12');
  if (missing.length > 0) {
    return { classified: false, reason: 'missing_required_answers', missing };
  }

  const q5 = answers.q5 as O.Q5Option;
  const q12 = answers.q12 as O.Q12Option;
  const q13 = answers.q13;
  const q14 = answers.q14;
  const q15 = answers.q15;

  const q5Rank = Q5_RANK[q5];
  const q12Rank = Q12_RANK[q12];

  // --- Level 4: Builder / Champion ---
  // Q12 = built workflows/automations/tools AND corroborating Q15 evidence.
  if (q12 === 'built_workflows_tools' && hasAny(q15, LEVEL_4_EVIDENCE)) {
    return build(4, 'L4_built_plus_q15_evidence', [
      'Q12 reports building AI workflows, automations or tools',
      'Q15 corroborates with a shared or delivered AI artifact',
    ]);
  }

  // --- Level 3: Workflow User ---
  // Q12 = reuse prompts/approaches OR repeatable processes, plus at least one
  // corroborating signal from Q13, Q14 or Q15.
  if (q12 === 'reuse_prompts_approaches' || q12 === 'repeatable_processes') {
    const q13Corroborates = q13 !== undefined && Q13_RANK[q13] >= Q13_RANK.often;
    const q14Rank = q14 === undefined ? null : Q14_RANK[q14];
    const q14Corroborates = q14Rank !== null && q14Rank >= 1;
    const q15Corroborates = hasAny(q15, REUSABLE_ARTIFACT_EVIDENCE);

    if (q13Corroborates || q14Corroborates || q15Corroborates) {
      const reasons = ['Q12 reports reusing prompts/approaches or repeatable processes'];
      if (q13Corroborates) reasons.push('Q13 reports reusing prompts often or almost always');
      if (q14Corroborates) reasons.push('Q14 reports at least one changed work process');
      if (q15Corroborates) reasons.push('Q15 reports a reusable AI artifact');
      return build(3, 'L3_workflow_behaviour_plus_corroboration', reasons);
    }
    // No corroboration: fall through. A self-declared workflow user with no
    // supporting behaviour lands at the conservative level below.
  }

  // --- Level 2: Regular User ---
  // Q5 >= a few times per month AND Q12 = regular individual tasks or higher.
  if (q5Rank >= Q5_RANK.few_times_month && q12Rank >= Q12_RANK.regular_individual_tasks) {
    return build(2, 'L2_regular_frequency_plus_task_use', [
      'Q5 reports work AI use at least a few times per month',
      'Q12 reports at least regular individual-task AI use',
    ]);
  }

  // --- Level 1: Explorer ---
  // Any work AI use or experimentation that did not qualify above. This also
  // catches contradictory responses, e.g. "never use AI" alongside Q15 evidence
  // of having built an AI tool.
  const contradictoryArtifacts = hasAny(q15, REUSABLE_ARTIFACT_EVIDENCE);
  if (q5Rank > 0 || q12Rank > 0 || contradictoryArtifacts) {
    const reasons: string[] = [];
    if (q5Rank > 0) reasons.push('Q5 reports some work AI use');
    if (q12Rank > 0) reasons.push('Q12 reports at least occasional experimentation');
    if (contradictoryArtifacts && q5Rank === 0 && q12Rank === 0) {
      reasons.push('Q15 reports an AI artifact despite reporting no current work AI use');
    }
    return build(1, 'L1_some_use_or_experimentation', reasons);
  }

  // --- Level 0: Non-user ---
  // Q5 = Never, Q12 = no current work AI use, and no contradictory Q15 evidence.
  return build(0, 'L0_no_use_no_contradiction', [
    'Q5 reports never using AI for work',
    'Q12 reports no current work AI use',
    'Q15 reports no AI workflows or tools',
  ]);
}
