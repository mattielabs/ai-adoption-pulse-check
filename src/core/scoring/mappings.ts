/**
 * Answer-option to 0-100 value mappings.
 *
 * Every mapping in the V1.1 spec lives here and nowhere else. Note the
 * deliberate asymmetries:
 *   - Q14 "Unsure" and Q16/Q17 "Not applicable" are NOT_ASSESSED (excluded
 *     from the score, with the remaining weights normalized).
 *   - Q18/Q19/Q20-Q22 "Unsure" maps to 0, because an organizational resource
 *     employees do not know about is not effectively enabling or protecting
 *     them. This is intentional, not an oversight. Spec 16, 17.
 *
 * Unknown data is never silently mapped to 50. Spec 12.
 */

import type * as O from '../survey/options.js';
import { NOT_ASSESSED, type MappedValue, type NotAssessed } from './types.js';
import { NO_WORK_AI_USE } from '../survey/categories.js';

/** Q5 - work AI usage frequency. 70% of Adoption. */
export const Q5_VALUES: Readonly<Record<O.Q5Option, number>> = {
  never: 0,
  less_than_monthly: 20,
  few_times_month: 40,
  few_times_week: 60,
  most_workdays: 80,
  multiple_times_day: 100,
};

/**
 * Q7 - breadth of work AI use. 30% of Adoption.
 *
 * Breadth counts distinct AI use categories. The explicit "I do not currently
 * use AI for work" sentinel forces 0 regardless of anything else selected, so a
 * contradictory response resolves deterministically rather than being rejected.
 */
export function q7BreadthValue(selections: readonly string[]): number {
  if (selections.includes(NO_WORK_AI_USE)) return 0;
  const count = new Set(selections.filter((s) => s !== NO_WORK_AI_USE)).size;
  if (count === 0) return 0;
  if (count === 1) return 25;
  if (count <= 3) return 50;
  if (count <= 5) return 75;
  return 100;
}

/** Q8-Q11 - self-reported confidence. Equal weighting. */
export const CONFIDENCE_VALUES: Readonly<Record<O.ConfidenceScaleOption, MappedValue>> = {
  not_confident: 0,
  slightly_confident: 25,
  somewhat_confident: 50,
  very_confident: 75,
  extremely_confident: 100,
  // "I have not done this" is a legitimate non-answer, not low confidence.
  not_done_this: NOT_ASSESSED,
};

/** Q12 - workflow behaviour ladder. 50% of Workflow. */
export const Q12_VALUES: Readonly<Record<O.Q12Option, number>> = {
  no_work_ai_use: 0,
  occasional_experiments: 20,
  regular_individual_tasks: 40,
  reuse_prompts_approaches: 60,
  repeatable_processes: 80,
  built_workflows_tools: 100,
};

/** Q13 - reuse frequency. 25% of Workflow. "I do not use AI" is a real 0, not a non-answer. */
export const Q13_VALUES: Readonly<Record<O.Q13Option, number>> = {
  never: 0,
  rarely: 25,
  sometimes: 50,
  often: 75,
  almost_always: 100,
  no_ai_use: 0,
};

/** Q14 - process redesign. 25% of Workflow. */
export const Q14_VALUES: Readonly<Record<O.Q14Option, MappedValue>> = {
  no: 0,
  see_opportunities: 20,
  one_small_process: 50,
  several_processes: 75,
  recurring_workflows: 100,
  unsure: NOT_ASSESSED,
};

/** Q16 and Q17 - verification and human-review behaviour. */
export const FREQUENCY_VALUES: Readonly<Record<O.FrequencyScaleOption, MappedValue>> = {
  never: 0,
  rarely: 25,
  sometimes: 50,
  usually: 75,
  always: 100,
  not_applicable: NOT_ASSESSED,
};

/** Q18 - data-handling awareness. "Unsure" is scored 0 by design. */
export const Q18_VALUES: Readonly<Record<O.Q18Option, number>> = {
  not_confident: 0,
  slightly_confident: 25,
  somewhat_confident: 50,
  very_confident: 75,
  extremely_confident: 100,
  unsure: 0,
};

/** Q19 - approved-tool clarity. 20% of Enablement. */
export const Q19_VALUES: Readonly<Record<O.Q19Option, number>> = {
  yes_clearly: 100,
  mostly: 75,
  general_idea: 50,
  no: 0,
  not_defined: 0,
  unsure: 0,
};

/** Q20-Q22 - organizational support agreement scale. "Unsure" is scored 0 by design. */
export const AGREEMENT_VALUES: Readonly<Record<O.AgreementScaleOption, number>> = {
  strongly_disagree: 0,
  disagree: 25,
  neither: 50,
  agree: 75,
  strongly_agree: 100,
  unsure: 0,
};

/** Q28 - Interest. Reported separately; never a maturity dimension. Spec 22. */
export const Q28_VALUES: Readonly<Record<O.Q28Option, number | NotAssessed>> = {
  not_interested: 0,
  slightly_interested: 25,
  moderately_interested: 50,
  very_interested: 75,
  extremely_interested: 100,
  unsure: NOT_ASSESSED,
};

/**
 * Ordinal ranks used by the classification ladder. These are ordering positions,
 * not scores, and are kept separate from the 0-100 mappings on purpose.
 */
export const Q5_RANK: Readonly<Record<O.Q5Option, number>> = {
  never: 0,
  less_than_monthly: 1,
  few_times_month: 2,
  few_times_week: 3,
  most_workdays: 4,
  multiple_times_day: 5,
};

export const Q12_RANK: Readonly<Record<O.Q12Option, number>> = {
  no_work_ai_use: 0,
  occasional_experiments: 1,
  regular_individual_tasks: 2,
  reuse_prompts_approaches: 3,
  repeatable_processes: 4,
  built_workflows_tools: 5,
};

export const Q13_RANK: Readonly<Record<O.Q13Option, number>> = {
  no_ai_use: 0,
  never: 0,
  rarely: 1,
  sometimes: 2,
  often: 3,
  almost_always: 4,
};

export const Q14_RANK: Readonly<Record<O.Q14Option, number | null>> = {
  no: 0,
  see_opportunities: 0,
  one_small_process: 1,
  several_processes: 2,
  recurring_workflows: 3,
  unsure: null,
};
