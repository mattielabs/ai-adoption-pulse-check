/**
 * The ten V1.1 recommendation rules.
 *
 * Each rule is a pure function of the measured context. It returns whether it
 * fired, the conditions it evaluated, the evidence behind them, and the two
 * numbers ranking needs. Merge and suppression relationships between rules are
 * NOT handled here - they live in `engine.ts` so that each rule stays
 * independently testable. Spec 26.
 */

import type { QuestionId } from '../survey/questions.js';
import { asPercent } from '../util/number.js';
import {
  allEvaluable,
  allMet,
  condition,
  evidenceItem,
  minDefined,
  type RecommendationContext,
} from './evidence.js';
import type {
  EvidenceItem,
  RecommendationFamily,
  RecommendationId,
  RecommendationPriority,
  RuleCondition,
} from './types.js';

export interface RuleEvaluation {
  readonly triggered: boolean;
  readonly evaluable: boolean;
  readonly conditions: readonly RuleCondition[];
  readonly evidence: readonly EvidenceItem[];
  readonly gapFromThreshold: number | null;
  readonly affectedProportion: number | null;
  /**
   * Corroborating measures beyond the primary trigger. Two or more (with an
   * adequate sample) earns the "Strong Signal" label. Spec 29.
   */
  readonly supportingMeasures: number;
}

export interface RuleDefinition {
  readonly id: RecommendationId;
  readonly family: RecommendationFamily;
  readonly priority: RecommendationPriority;
  readonly title: string;
  readonly actionKeys: readonly string[];
  readonly recommendedAction: string;
  readonly rootEvidenceQuestions: readonly QuestionId[];
  readonly evaluate: (ctx: RecommendationContext) => RuleEvaluation;
}

// --- Thresholds ------------------------------------------------------------
// Named so no rule contains a bare magic number.

export const THRESHOLDS = {
  R01_ADOPTION_MIN: 60,
  R01_SAFETY_MAX: 50,
  R02_QUESTION_MAX: 50,
  R03_ADOPTION_MIN: 40,
  R03_QUESTION_MAX: 50,
  R04_INTEREST_MIN: 70,
  R04_ENABLEMENT_MAX: 50,
  R05_ADOPTION_MIN: 50,
  R05_CONFIDENCE_MAX: 50,
  R06_ADOPTION_MIN: 60,
  R06_WORKFLOW_MAX: 50,
  R06_CONFIDENCE_TAILORING_MIN: 70,
  R07_ADOPTION_MAX: 40,
  R07_INTEREST_MIN: 70,
  R07_ENABLEMENT_MIN: 50,
  R08_ADOPTION_MAX: 40,
  R08_INTEREST_MAX: 50,
  R09_MIN_CHAMPIONS: 3,
  R10_ADOPTION_MIN: 60,
  /** Expressed as a proportion, not a percentage, to match the context units. */
  R10_UNMANAGED_RATE_MIN: 0.3,
} as const;

function countBelow(values: readonly (number | null)[], threshold: number): number {
  return values.filter((v): v is number => v !== null && v < threshold).length;
}

function score(metric: string, questionId: QuestionId | undefined, label: string, value: number | null, threshold?: number): EvidenceItem {
  return evidenceItem({
    metric,
    ...(questionId ? { questionId } : {}),
    label,
    value,
    unit: 'score',
    ...(threshold === undefined ? {} : { threshold }),
  });
}

// --- R01 -------------------------------------------------------------------

const R01: RuleDefinition = {
  id: 'R01',
  family: 'SAFETY',
  priority: 1,
  title: 'Strengthen safe AI use before expanding adoption',
  actionKeys: ['publish_verification_expectations', 'clarify_sensitive_data_boundaries', 'review_before_scaling'],
  recommendedAction:
    'Set clear verification and review expectations, and clarify what information must not be entered into AI tools, before encouraging broader AI use.',
  rootEvidenceQuestions: ['q16', 'q17', 'q18'],
  evaluate: (ctx) => {
    const conditions = [
      condition('adoption_high', 'Organization Adoption is at or above 60', ctx.adoption, 'gte', THRESHOLDS.R01_ADOPTION_MIN),
      condition('safety_low', 'Organization Safety is below 50', ctx.safety, 'lt', THRESHOLDS.R01_SAFETY_MAX),
    ];
    const q = ctx.questionScores;
    const supporting = countBelow([q.q16, q.q17, q.q18], THRESHOLDS.R02_QUESTION_MAX) +
      (ctx.unmanagedToolRate !== null && ctx.unmanagedToolRate >= THRESHOLDS.R10_UNMANAGED_RATE_MIN ? 1 : 0);

    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R01_ADOPTION_MIN),
        score('safety_mean', undefined, 'Safety (self-reported)', ctx.safety, THRESHOLDS.R01_SAFETY_MAX),
        score('q16_mean', 'q16', 'Verification of important AI output', q.q16),
        score('q17_mean', 'q17', 'Human review before sharing AI output', q.q17),
        score('q18_mean', 'q18', 'Confidence about sensitive-data boundaries', q.q18),
        evidenceItem({
          metric: 'unmanaged_tool_rate',
          questionId: 'q19b',
          label: 'Reports using independently accessed AI tools sometimes or often',
          value: asPercent(ctx.unmanagedToolRate),
          unit: 'rate',
        }),
      ],
      gapFromThreshold: ctx.safety === null ? null : THRESHOLDS.R01_SAFETY_MAX - ctx.safety,
      affectedProportion: ctx.proportions.lowSafety,
      supportingMeasures: supporting,
    };
  },
};

// --- R02 -------------------------------------------------------------------

const R02: RuleDefinition = {
  id: 'R02',
  family: 'POLICY',
  priority: 1,
  title: 'Publish clear AI usage guidance',
  actionKeys: ['publish_ai_usage_guidance', 'name_approved_tools', 'define_sensitive_data_rules'],
  recommendedAction:
    'Publish one short, practical AI usage document that names approved tools, states what data must never be entered, and explains what employees are expected to do before relying on AI output.',
  rootEvidenceQuestions: ['q18', 'q19', 'q20'],
  evaluate: (ctx) => {
    const q = ctx.questionScores;
    const conditions = [
      condition('q18_low', 'Sensitive-data boundaries are unclear (Q18 below 50)', q.q18, 'lt', THRESHOLDS.R02_QUESTION_MAX),
      condition('q19_low', 'Approved tools are unclear (Q19 below 50)', q.q19, 'lt', THRESHOLDS.R02_QUESTION_MAX),
      condition('q20_low', 'General AI policy/guidance is unclear (Q20 below 50)', q.q20, 'lt', THRESHOLDS.R02_QUESTION_MAX),
    ];
    const triggered = conditions.some((c) => c.met);
    // Decidable either because something fired, or because every input was
    // available and none of them fired.
    const evaluable = triggered || allEvaluable(conditions);
    const lowest = minDefined([q.q18, q.q19, q.q20]);

    return {
      triggered,
      evaluable,
      conditions,
      evidence: [
        score('q18_mean', 'q18', 'Confidence about sensitive-data boundaries', q.q18, THRESHOLDS.R02_QUESTION_MAX),
        score('q19_mean', 'q19', 'Clarity on approved AI tools', q.q19, THRESHOLDS.R02_QUESTION_MAX),
        score('q20_mean', 'q20', 'Clarity of organizational AI guidance', q.q20, THRESHOLDS.R02_QUESTION_MAX),
      ],
      gapFromThreshold: lowest === null ? null : THRESHOLDS.R02_QUESTION_MAX - lowest,
      affectedProportion: ctx.proportions.unclearGuidance,
      supportingMeasures: conditions.filter((c) => c.met).length,
    };
  },
};

// --- R03 -------------------------------------------------------------------
// R01 subordination is applied in engine.ts, not here, so this rule stays a
// pure function of the measured context.

const R03: RuleDefinition = {
  id: 'R03',
  family: 'SAFETY',
  priority: 1,
  title: 'Improve verification and human review',
  actionKeys: ['define_verification_expectations', 'require_human_review', 'target_high_risk_outputs'],
  recommendedAction:
    'Define when AI output must be verified against a source and when a human must review it before it leaves the organization, focusing first on customer-facing and decision-supporting work.',
  rootEvidenceQuestions: ['q16', 'q17'],
  evaluate: (ctx) => {
    const q = ctx.questionScores;
    const adoption = condition(
      'adoption_min',
      'Organization Adoption is at or above 40',
      ctx.adoption,
      'gte',
      THRESHOLDS.R03_ADOPTION_MIN,
    );
    const q16 = condition('q16_low', 'Verification behaviour is weak (Q16 below 50)', q.q16, 'lt', THRESHOLDS.R03_QUESTION_MAX);
    const q17 = condition('q17_low', 'Human review is weak (Q17 below 50)', q.q17, 'lt', THRESHOLDS.R03_QUESTION_MAX);
    const conditions = [adoption, q16, q17];
    const weakness = q16.met || q17.met;
    const triggered = adoption.met && weakness;
    const evaluable = adoption.actual !== null && (weakness || allEvaluable([q16, q17]));
    const lowest = minDefined([q.q16, q.q17]);

    return {
      triggered,
      evaluable,
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R03_ADOPTION_MIN),
        score('q16_mean', 'q16', 'Verification of important AI output', q.q16, THRESHOLDS.R03_QUESTION_MAX),
        score('q17_mean', 'q17', 'Human review before sharing AI output', q.q17, THRESHOLDS.R03_QUESTION_MAX),
      ],
      gapFromThreshold: lowest === null ? null : THRESHOLDS.R03_QUESTION_MAX - lowest,
      affectedProportion: ctx.proportions.weakVerification,
      supportingMeasures: [q16, q17].filter((c) => c.met).length,
    };
  },
};

// --- R04 -------------------------------------------------------------------

const R04: RuleDefinition = {
  id: 'R04',
  family: 'ENABLEMENT',
  priority: 2,
  title: 'Remove organizational barriers to adoption',
  actionKeys: ['confirm_tool_access', 'name_approved_tools', 'provide_practical_training', 'address_top_barriers'],
  recommendedAction:
    'Employees report wanting to use AI more than current support allows. Confirm who actually has access to approved tools, publish which tools are approved, and provide practical role-relevant training before investing in new tooling.',
  rootEvidenceQuestions: ['q19', 'q20', 'q21', 'q22'],
  evaluate: (ctx) => {
    const q = ctx.questionScores;
    const conditions = [
      condition('interest_high', 'Interest is at or above 70', ctx.interest, 'gte', THRESHOLDS.R04_INTEREST_MIN),
      condition('enablement_low', 'Enablement is below 50', ctx.enablement, 'lt', THRESHOLDS.R04_ENABLEMENT_MAX),
    ];
    const supporting =
      countBelow([q.q19, q.q20, q.q21, q.q22], THRESHOLDS.R02_QUESTION_MAX) +
      (ctx.noOrgProvidedAccessRate !== null && ctx.noOrgProvidedAccessRate > 0 ? 1 : 0);

    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('interest_mean', 'q28', 'Interest in using AI more', ctx.interest, THRESHOLDS.R04_INTEREST_MIN),
        score('enablement_mean', undefined, 'Enablement', ctx.enablement, THRESHOLDS.R04_ENABLEMENT_MAX),
        score('q19_mean', 'q19', 'Clarity on approved AI tools', q.q19),
        score('q20_mean', 'q20', 'Clarity of organizational AI guidance', q.q20),
        score('q21_mean', 'q21', 'Access to needed AI tools', q.q21),
        score('q22_mean', 'q22', 'Sufficient guidance or training', q.q22),
        evidenceItem({
          metric: 'no_org_provided_access_rate',
          questionId: 'q19b',
          label: 'Reports having no access to organization-provided AI tools',
          value: asPercent(ctx.noOrgProvidedAccessRate),
          unit: 'rate',
        }),
        evidenceItem({
          metric: 'top_barriers',
          questionId: 'q23',
          label: 'Most-reported barrier count',
          value: ctx.topBarriers[0]?.count ?? null,
          unit: 'count',
        }),
      ],
      gapFromThreshold: ctx.enablement === null ? null : THRESHOLDS.R04_ENABLEMENT_MAX - ctx.enablement,
      affectedProportion: ctx.proportions.lowEnablement,
      supportingMeasures: supporting,
    };
  },
};

// --- R05 -------------------------------------------------------------------

const R05: RuleDefinition = {
  id: 'R05',
  family: 'CONFIDENCE',
  priority: 2,
  title: 'Build practical AI confidence',
  actionKeys: ['teach_clear_instructions', 'teach_adding_context', 'teach_evaluating_output', 'teach_when_not_to_use'],
  recommendedAction:
    'Run short, practical sessions on giving clear instructions, adding context when the first answer is weak, judging whether output is accurate, and deciding when AI is not the right tool.',
  rootEvidenceQuestions: ['q8', 'q9', 'q10', 'q11'],
  evaluate: (ctx) => {
    const q = ctx.questionScores;
    const conditions = [
      condition('adoption_min', 'Adoption is at or above 50', ctx.adoption, 'gte', THRESHOLDS.R05_ADOPTION_MIN),
      condition('confidence_low', 'Confidence is below 50', ctx.confidence, 'lt', THRESHOLDS.R05_CONFIDENCE_MAX),
    ];
    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R05_ADOPTION_MIN),
        score('confidence_mean', undefined, 'Confidence (self-reported)', ctx.confidence, THRESHOLDS.R05_CONFIDENCE_MAX),
        score('q8_mean', 'q8', 'Confidence giving clear instructions', q.q8),
        score('q9_mean', 'q9', 'Confidence adding context or constraints', q.q9),
        score('q10_mean', 'q10', 'Confidence evaluating AI output', q.q10),
        score('q11_mean', 'q11', 'Confidence deciding when AI is appropriate', q.q11),
      ],
      gapFromThreshold: ctx.confidence === null ? null : THRESHOLDS.R05_CONFIDENCE_MAX - ctx.confidence,
      affectedProportion: ctx.proportions.lowConfidence,
      supportingMeasures: countBelow([q.q8, q.q9, q.q10, q.q11], THRESHOLDS.R05_CONFIDENCE_MAX),
    };
  },
};

// --- R06 -------------------------------------------------------------------

const R06: RuleDefinition = {
  id: 'R06',
  family: 'WORKFLOW',
  priority: 3,
  title: 'Move from one-off AI use to repeatable workflows',
  actionKeys: ['save_useful_prompts', 'document_recurring_steps', 'standardize_repeat_tasks', 'automate_only_where_justified'],
  recommendedAction:
    'Help employees save the prompts that already work, document the recurring steps around them, and standardize the repeat tasks. Introduce automation only where a step is genuinely deterministic.',
  rootEvidenceQuestions: ['q12', 'q13', 'q14'],
  evaluate: (ctx) => {
    const q = ctx.questionScores;
    const conditions = [
      condition('adoption_min', 'Adoption is at or above 60', ctx.adoption, 'gte', THRESHOLDS.R06_ADOPTION_MIN),
      condition('workflow_low', 'Workflow is below 50', ctx.workflow, 'lt', THRESHOLDS.R06_WORKFLOW_MAX),
    ];
    // When Confidence is already strong the blocker is workflow design, not AI
    // basics, so the action is tailored rather than duplicated. Spec 26 R06.
    const confidentAudience =
      ctx.confidence !== null && ctx.confidence >= THRESHOLDS.R06_CONFIDENCE_TAILORING_MIN;

    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R06_ADOPTION_MIN),
        score('workflow_mean', undefined, 'Workflow', ctx.workflow, THRESHOLDS.R06_WORKFLOW_MAX),
        score('confidence_mean', undefined, 'Confidence (self-reported)', ctx.confidence),
        score('q13_mean', 'q13', 'Reuse of prompts or templates', q.q13),
        score('q14_mean', 'q14', 'Work processes changed because of AI', q.q14),
        evidenceItem({
          metric: 'tailored_for_confident_audience',
          label: 'Confidence is high enough to focus on workflow design rather than AI basics',
          value: confidentAudience ? 1 : 0,
          unit: 'count',
        }),
      ],
      gapFromThreshold: ctx.workflow === null ? null : THRESHOLDS.R06_WORKFLOW_MAX - ctx.workflow,
      affectedProportion: ctx.proportions.lowWorkflow,
      supportingMeasures: countBelow([q.q13, q.q14], THRESHOLDS.R06_WORKFLOW_MAX),
    };
  },
};

// --- R07 -------------------------------------------------------------------

const R07: RuleDefinition = {
  id: 'R07',
  family: 'DISCOVERY',
  priority: 2,
  title: 'Investigate why interest is not converting into adoption',
  actionKeys: ['review_reported_barriers', 'interview_non_users', 'test_one_real_workflow'],
  recommendedAction:
    'Interest is high and organizational support already looks adequate, so the blocker is elsewhere. Review the reported barriers and speak to employees who are interested but not using AI before adding tools or training.',
  rootEvidenceQuestions: ['q5', 'q28'],
  evaluate: (ctx) => {
    const conditions = [
      condition('adoption_low', 'Adoption is below 40', ctx.adoption, 'lt', THRESHOLDS.R07_ADOPTION_MAX),
      condition('interest_high', 'Interest is at or above 70', ctx.interest, 'gte', THRESHOLDS.R07_INTEREST_MIN),
      condition('enablement_ok', 'Enablement is at or above 50', ctx.enablement, 'gte', THRESHOLDS.R07_ENABLEMENT_MIN),
    ];
    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R07_ADOPTION_MAX),
        score('interest_mean', 'q28', 'Interest in using AI more', ctx.interest, THRESHOLDS.R07_INTEREST_MIN),
        score('enablement_mean', undefined, 'Enablement', ctx.enablement, THRESHOLDS.R07_ENABLEMENT_MIN),
        evidenceItem({
          metric: 'top_barriers',
          questionId: 'q23',
          label: 'Most-reported barrier count',
          value: ctx.topBarriers[0]?.count ?? null,
          unit: 'count',
        }),
      ],
      gapFromThreshold: ctx.interest === null ? null : ctx.interest - THRESHOLDS.R07_INTEREST_MIN,
      affectedProportion: ctx.proportions.highInterest,
      supportingMeasures: ctx.topBarriers.filter((b) => (b.rate ?? 0) >= 0.2).length,
    };
  },
};

// --- R08 -------------------------------------------------------------------

const R08: RuleDefinition = {
  id: 'R08',
  family: 'DISCOVERY',
  priority: 3,
  title: 'Start with workflow discovery, not an AI rollout',
  actionKeys: ['map_operational_pain', 'interview_before_tooling', 'defer_broad_purchasing'],
  recommendedAction:
    'Do not buy tools or run broad training just because adoption is low. Start by finding the workflows employees already experience as slow or repetitive, and investigate those first.',
  rootEvidenceQuestions: ['q5', 'q28'],
  evaluate: (ctx) => {
    const conditions = [
      condition('adoption_low', 'Adoption is below 40', ctx.adoption, 'lt', THRESHOLDS.R08_ADOPTION_MAX),
      condition('interest_low', 'Interest is below 50', ctx.interest, 'lt', THRESHOLDS.R08_INTEREST_MAX),
    ];
    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R08_ADOPTION_MAX),
        score('interest_mean', 'q28', 'Interest in using AI more', ctx.interest, THRESHOLDS.R08_INTEREST_MAX),
      ],
      gapFromThreshold: ctx.interest === null ? null : THRESHOLDS.R08_INTEREST_MAX - ctx.interest,
      affectedProportion: ctx.proportions.lowAdoption,
      supportingMeasures: conditions.filter((c) => c.met).length - 1,
    };
  },
};

// --- R09 -------------------------------------------------------------------

const R09: RuleDefinition = {
  id: 'R09',
  family: 'CHAMPIONS',
  priority: 4,
  title: 'Consider an internal AI champion group',
  actionKeys: ['invite_opt_in_champions', 'share_existing_practices', 'document_useful_workflows'],
  recommendedAction:
    'Invite employees to opt in separately if they want to support pilots, share practices, or help document useful workflows. Do not attempt to identify them from this survey.',
  rootEvidenceQuestions: ['q12', 'q15'],
  evaluate: (ctx) => {
    const conditions = [
      condition(
        'champions_min',
        'At least three respondents qualify for the potential champion signal',
        ctx.championCount,
        'gte',
        THRESHOLDS.R09_MIN_CHAMPIONS,
      ),
    ];
    return {
      triggered: allMet(conditions),
      evaluable: true,
      conditions,
      evidence: [
        evidenceItem({
          metric: 'champion_count',
          label: 'Respondents meeting the potential champion thresholds',
          value: ctx.championCount,
          unit: 'count',
          threshold: THRESHOLDS.R09_MIN_CHAMPIONS,
        }),
        score('workflow_mean', undefined, 'Workflow', ctx.workflow),
        score('confidence_mean', undefined, 'Confidence (self-reported)', ctx.confidence),
        score('safety_mean', undefined, 'Safety (self-reported)', ctx.safety),
      ],
      gapFromThreshold: ctx.championCount - THRESHOLDS.R09_MIN_CHAMPIONS,
      affectedProportion:
        ctx.responseCount === 0 ? null : ctx.championCount / ctx.responseCount,
      supportingMeasures: ctx.championCount >= 5 ? 2 : 1,
    };
  },
};

// --- R10 -------------------------------------------------------------------

const R10: RuleDefinition = {
  id: 'R10',
  family: 'SAFETY',
  priority: 1,
  title: 'Review reliance on independently accessed AI tools',
  actionKeys: ['identify_unmet_tool_needs', 'clarify_approved_alternatives', 'avoid_punitive_framing'],
  recommendedAction:
    'Find out which tasks are driving employees to independently accessed AI tools and whether an approved alternative exists. Treat this as a discovery signal about unmet needs, not as a policy violation.',
  rootEvidenceQuestions: ['q19b'],
  evaluate: (ctx) => {
    const conditions = [
      condition('adoption_min', 'Adoption is at or above 60', ctx.adoption, 'gte', THRESHOLDS.R10_ADOPTION_MIN),
      condition(
        'unmanaged_rate_min',
        'At least 30% of valid Q19b responses report Sometimes or Often',
        ctx.unmanagedToolRate,
        'gte',
        THRESHOLDS.R10_UNMANAGED_RATE_MIN,
      ),
    ];
    return {
      triggered: allMet(conditions),
      evaluable: allEvaluable(conditions),
      conditions,
      evidence: [
        score('adoption_mean', undefined, 'Adoption', ctx.adoption, THRESHOLDS.R10_ADOPTION_MIN),
        evidenceItem({
          metric: 'unmanaged_tool_rate',
          questionId: 'q19b',
          label: 'Reports using independently accessed AI tools sometimes or often',
          value: asPercent(ctx.unmanagedToolRate),
          unit: 'rate',
          threshold: THRESHOLDS.R10_UNMANAGED_RATE_MIN * 100,
        }),
        evidenceItem({
          metric: 'unmanaged_prefer_not_to_say',
          questionId: 'q19b',
          label: 'Respondents who preferred not to say (excluded from the rate)',
          value: ctx.unmanagedToolPreferNotToSayCount,
          unit: 'count',
        }),
        evidenceItem({
          metric: 'no_org_provided_access_rate',
          questionId: 'q19b',
          label: 'Reports having no access to organization-provided AI tools',
          value: asPercent(ctx.noOrgProvidedAccessRate),
          unit: 'rate',
        }),
      ],
      gapFromThreshold:
        ctx.unmanagedToolRate === null
          ? null
          : (ctx.unmanagedToolRate - THRESHOLDS.R10_UNMANAGED_RATE_MIN) * 100,
      affectedProportion: ctx.unmanagedToolRate,
      supportingMeasures:
        (ctx.noOrgProvidedAccessRate !== null && ctx.noOrgProvidedAccessRate > 0 ? 1 : 0) +
        (ctx.safety !== null && ctx.safety < THRESHOLDS.R01_SAFETY_MAX ? 1 : 0),
    };
  },
};

/** Evaluation order is by rule id, which is also the deterministic tie-break order. */
export const RULES: readonly RuleDefinition[] = [R01, R02, R03, R04, R05, R06, R07, R08, R09, R10];

export const RULES_BY_ID: Readonly<Record<RecommendationId, RuleDefinition>> = Object.freeze(
  Object.fromEntries(RULES.map((r) => [r.id, r])),
) as Readonly<Record<RecommendationId, RuleDefinition>>;
