/**
 * Recommendation engine types.
 *
 * Rules return structured data, never UI markup. The dashboard is responsible
 * for presentation; the engine is responsible for being explainable, which
 * means every result carries the conditions it evaluated, the measured values,
 * and the thresholds those values were compared against. Spec 24.
 */

import type { QuestionId } from '../survey/questions.js';

export const RECOMMENDATION_IDS = [
  'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10',
] as const;
export type RecommendationId = (typeof RECOMMENDATION_IDS)[number];

export const RECOMMENDATION_FAMILIES = [
  'SAFETY',
  'POLICY',
  'ENABLEMENT',
  'CONFIDENCE',
  'WORKFLOW',
  'DISCOVERY',
  'CHAMPIONS',
] as const;
export type RecommendationFamily = (typeof RECOMMENDATION_FAMILIES)[number];

/** 1 = Guardrail/Risk, 2 = Adoption Blocker, 3 = Improvement/Discovery, 4 = Internal Opportunity. */
export type RecommendationPriority = 1 | 2 | 3 | 4;

export const PRIORITY_LABELS: Readonly<Record<RecommendationPriority, string>> = {
  1: 'Guardrail / Risk',
  2: 'Adoption Blocker',
  3: 'Improvement / Discovery',
  4: 'Internal Opportunity',
};

/**
 * Confidence labels are qualitative on purpose. The engine must never invent a
 * statistical confidence percentage from a self-report survey. Spec 29.
 */
export type ConfidenceLabel = 'strong_signal' | 'signal' | 'early_signal';

export const CONFIDENCE_LABEL_COPY: Readonly<Record<ConfidenceLabel, string>> = {
  strong_signal: 'Strong Signal',
  signal: 'Signal',
  early_signal: 'Early Signal',
};

export type Comparator = 'gte' | 'gt' | 'lt' | 'lte';

export interface RuleCondition {
  readonly id: string;
  readonly description: string;
  /** The measured organization value, or null when it could not be assessed. */
  readonly actual: number | null;
  readonly threshold: number;
  readonly comparator: Comparator;
  readonly met: boolean;
}

export type EvidenceUnit = 'score' | 'rate' | 'count';

export interface EvidenceItem {
  /** Machine key, stable for tests and exports. */
  readonly metric: string;
  /** The survey question this evidence comes from, when there is exactly one. */
  readonly questionId?: QuestionId;
  readonly label: string;
  readonly value: number | null;
  readonly unit: EvidenceUnit;
  readonly threshold?: number;
}

export type RecommendationSuppressionReason =
  | 'merged_into_r01'
  | 'explained_by_r04'
  | 'family_already_represented'
  | 'root_evidence_limit'
  | 'primary_slots_full';

export interface RecommendationResult {
  readonly id: RecommendationId;
  readonly engineVersion: string;
  readonly family: RecommendationFamily;
  readonly priority: RecommendationPriority;
  readonly title: string;
  /** Whether every trigger condition was met. */
  readonly triggered: boolean;
  /** False when a required input could not be assessed, so the rule could not be decided. */
  readonly evaluable: boolean;
  readonly conditions: readonly RuleCondition[];
  readonly evidence: readonly EvidenceItem[];
  /** Stable keys the UI maps to action copy, so wording changes need no engine change. */
  readonly actionKeys: readonly string[];
  readonly recommendedAction: string;
  readonly confidenceLabel: ConfidenceLabel | null;
  /**
   * Questions this recommendation fundamentally rests on. Used by the
   * root-evidence duplication backstop. Spec 27.
   */
  readonly rootEvidenceQuestions: readonly QuestionId[];
  /** How far past its threshold the primary measure sits. Used for ranking. Spec 28. */
  readonly gapFromThreshold: number | null;
  /** Share of respondents affected, in [0,1]. Used for ranking. Spec 28. */
  readonly affectedProportion: number | null;
  /** Sub-findings folded into this recommendation instead of taking their own slot. */
  readonly mergedFindings: readonly MergedFinding[];
  /** Set when this rule was deliberately not surfaced. */
  readonly suppressedBy?: RecommendationId | null;
  readonly suppressionReason?: RecommendationSuppressionReason | null;
}

export interface MergedFinding {
  readonly sourceId: RecommendationId;
  readonly summary: string;
  readonly evidence: readonly EvidenceItem[];
}

export type RecommendationEngineStatus = 'ok' | 'insufficient_sample';

export interface RecommendationEngineResult {
  readonly engineVersion: string;
  readonly status: RecommendationEngineStatus;
  readonly sampleSize: number;
  /** Maximum three. Spec 24. */
  readonly primary: readonly RecommendationResult[];
  /** Up to three additional opportunities / signals. */
  readonly additional: readonly RecommendationResult[];
  /** Everything that fired, after merge and suppression, in ranked order. */
  readonly triggered: readonly RecommendationResult[];
  /** All ten rules with their evaluation detail, for auditing and tests. */
  readonly evaluated: readonly RecommendationResult[];
}

/** Organization-level results require at least this many completed responses. Spec 32. */
export const MIN_ORGANIZATION_SAMPLE = 5;

/** Below this sample size a fired rule is labelled "Early Signal". Spec 29. */
export const EARLY_SIGNAL_MAX_SAMPLE = 10;

export const MAX_PRIMARY_RECOMMENDATIONS = 3;
export const MAX_ADDITIONAL_RECOMMENDATIONS = 3;

/** No more than two primary recommendations may rest on the same root question. Spec 27. */
export const MAX_PRIMARY_PER_ROOT_QUESTION = 2;
