/**
 * Opportunity Map analysis.
 *
 * THE DENOMINATOR IS THE POINT. "Current AI usage" for a workflow is measured
 * among the respondents who reported THAT SAME workflow as time-consuming or
 * repetitive - not against a global usage percentage. That is what makes the
 * comparison exact by construction and removes any many-to-many mapping.
 * Spec 30.
 *
 * V1.1 has exactly two per-workflow labels: Explore and Standardize. Enable,
 * Scale and per-workflow Guardrail were deliberately removed because
 * per-workflow evidence cannot support them yet. Guardrail survives only as a
 * single organization-wide banner driven by the Safety score. Spec 31, 71.
 */

import type { SurveyResponse } from '../survey/answers.js';
import { rate } from '../util/number.js';
import {
  SHARED_WORKFLOW_CATEGORY_IDS,
  SHARED_WORKFLOW_CATEGORY_LABELS,
  type SharedWorkflowCategoryId,
} from './categories.js';

/** A workflow must be reported as painful by at least this share of respondents. */
export const PAIN_RATE_THRESHOLD = 0.2;

/** Above this AI-use rate within the pain group, the workflow is Standardize rather than Explore. */
export const AI_USE_AMONG_PAIN_THRESHOLD = 0.4;

/** Organization Safety below this triggers the single Guardrail banner. */
export const GUARDRAIL_SAFETY_THRESHOLD = 50;

export type OpportunityLabel = 'explore' | 'standardize';

export const OPPORTUNITY_LABEL_COPY: Readonly<
  Record<OpportunityLabel, { readonly title: string; readonly meaning: string; readonly action: string }>
> = {
  explore: {
    title: 'Explore',
    meaning: 'Meaningful workflow friction exists, but AI use within that workflow is still limited.',
    action:
      'Interview employees who perform this workflow and map the current process before selecting a solution.',
  },
  standardize: {
    title: 'Standardize',
    meaning:
      'Employees are already using AI in a workflow they still experience as repetitive or time-consuming.',
    action:
      'Investigate whether shared prompts, templates, process guidance, or a controlled workflow would improve consistency.',
  },
};

export interface OpportunityCategoryResult {
  readonly categoryId: SharedWorkflowCategoryId;
  readonly label: string;
  /** Respondents who reported this workflow as painful/repetitive on Q26. */
  readonly painCount: number;
  /** painCount / respondents who answered Q26. */
  readonly painRate: number | null;
  /** Of the pain group, how many also report using AI for this workflow on Q7. */
  readonly aiUseAmongPainCount: number;
  /** aiUseAmongPainCount / painCount. Null when nobody reported this pain. */
  readonly aiUseAmongPainRate: number | null;
  readonly opportunityLabel: OpportunityLabel | null;
}

export interface GuardrailSignal {
  readonly active: boolean;
  readonly safetyScore: number | null;
  readonly message: string | null;
}

export interface OpportunityMap {
  /** Respondents who answered Q26, i.e. the pain-rate denominator. */
  readonly denominator: number;
  readonly categories: readonly OpportunityCategoryResult[];
  readonly explore: readonly OpportunityCategoryResult[];
  readonly standardize: readonly OpportunityCategoryResult[];
  readonly guardrail: GuardrailSignal;
}

function labelFor(painRate: number | null, aiUseRate: number | null): OpportunityLabel | null {
  if (painRate === null || painRate < PAIN_RATE_THRESHOLD) return null;
  // A pain rate at or above threshold guarantees painCount > 0, so aiUseRate is
  // never null here; the guard keeps the types honest.
  if (aiUseRate === null) return 'explore';
  return aiUseRate >= AI_USE_AMONG_PAIN_THRESHOLD ? 'standardize' : 'explore';
}

export function buildGuardrailSignal(organizationSafety: number | null): GuardrailSignal {
  if (organizationSafety === null) {
    return { active: false, safetyScore: null, message: null };
  }
  const active = organizationSafety < GUARDRAIL_SAFETY_THRESHOLD;
  return {
    active,
    safetyScore: organizationSafety,
    message: active
      ? 'Guardrail signal: Strengthen safe-use practices before broadly scaling AI workflows.'
      : null,
  };
}

export function analyzeOpportunities(
  responses: readonly SurveyResponse[],
  organizationSafety: number | null,
): OpportunityMap {
  const withPainAnswer = responses.filter(
    (r) => Array.isArray(r.answers.q26) && r.answers.q26.length > 0,
  );
  const denominator = withPainAnswer.length;

  const categories: OpportunityCategoryResult[] = SHARED_WORKFLOW_CATEGORY_IDS.map((categoryId) => {
    const painGroup = withPainAnswer.filter((r) =>
      (r.answers.q26 as readonly string[]).includes(categoryId),
    );
    const painCount = painGroup.length;
    const aiUseAmongPainCount = painGroup.filter((r) => {
      const uses = r.answers.q7;
      return Array.isArray(uses) && uses.includes(categoryId as never);
    }).length;

    const painRate = rate(painCount, denominator);
    const aiUseAmongPainRate = rate(aiUseAmongPainCount, painCount);

    return {
      categoryId,
      label: SHARED_WORKFLOW_CATEGORY_LABELS[categoryId],
      painCount,
      painRate,
      aiUseAmongPainCount,
      aiUseAmongPainRate,
      opportunityLabel: labelFor(painRate, aiUseAmongPainRate),
    };
  });

  return {
    denominator,
    categories,
    explore: categories.filter((c) => c.opportunityLabel === 'explore'),
    standardize: categories.filter((c) => c.opportunityLabel === 'standardize'),
    guardrail: buildGuardrailSignal(organizationSafety),
  };
}
