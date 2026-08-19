/**
 * The results API contract.
 *
 * This is the privacy boundary. `OrganizationAggregate` carries a
 * `respondents` array with per-person scores, classifications and row ids -
 * exactly what an aggregate discovery product must never ship to a browser.
 * So the dashboard does not receive core types: the server maps into these
 * shapes explicitly, and a field added to the core aggregate later cannot leak
 * by simply being spread into a response.
 *
 * Three properties these types are built to guarantee:
 *
 *   1. No per-respondent record appears anywhere. There is no id, no row
 *      token, no submission date, and no individual score in any shape here.
 *   2. Q27 free text is absent. It has its own endpoint and its own type,
 *      because the moment it shares a payload with segmented aggregates
 *      somebody can line them up.
 *   3. A suppressed segment carries no aggregate at all - not a partial one,
 *      not a zeroed one. The suppressed variant simply has no data fields.
 *
 * Machine ids are returned rather than display copy wherever the survey schema
 * already defines the label, because the client compiles that same schema from
 * `src/core` and a second copy of the wording would drift.
 */

import type { Dimension, QuestionId } from '../survey/questions.js';
import type { ScoreBand } from '../aggregation/bands.js';
import type { ClassificationKey, ClassificationLevel } from '../classification/classifyRespondent.js';
import type { OpportunityLabel } from '../opportunities/analyze.js';
import type {
  Comparator,
  ConfidenceLabel,
  EvidenceUnit,
  RecommendationFamily,
  RecommendationId,
  RecommendationPriority,
} from '../recommendations/types.js';
import type { SegmentationDimension, SuppressionReason } from '../privacy/thresholds.js';
import type { PulseOperationalState } from '../pulse/status.js';
import type { EngineVersions } from '../versions.js';

/** Organization results require at least this many responses. Spec 32. */
export const MINIMUM_REPORTABLE_RESPONSES = 5;

/** Below this, results carry the early-directional caveat. Spec 32. */
export const EARLY_DIRECTIONAL_BELOW = 10;

// --- context ---------------------------------------------------------------

export interface ResultsPulseSummary {
  readonly id: number;
  readonly name: string;
  readonly state: PulseOperationalState;
  readonly opensOn: string | null;
  readonly closesOn: string | null;
  /** Total responses for the Pulse, before any segment filter. */
  readonly responseCount: number;
  readonly surveyVersion: string;
}

export interface SampleState {
  /** Responses in the current view. Equals the segment size when one is active. */
  readonly responseCount: number;
  readonly minimumRequired: number;
  readonly sufficient: boolean;
  /** True for 5-9 responses: results are shown, with a caution. Spec 32. */
  readonly earlyDirectional: boolean;
  /** The engine's own caveat string, or null when none applies. */
  readonly caveat: string | null;
}

// --- dimensions ------------------------------------------------------------

export interface DimensionResult {
  readonly dimension: Dimension;
  readonly mean: number | null;
  readonly median: number | null;
  /** Band of the mean, or null when the dimension could not be assessed. */
  readonly band: ScoreBand | null;
  readonly distribution: Readonly<Record<ScoreBand, number>>;
  readonly scoredCount: number;
  readonly notAssessedCount: number;
  readonly unsureRate: number | null;
  readonly unsureRateBasis: string | null;
}

export interface QuestionScoreResult {
  readonly questionId: QuestionId;
  readonly mean: number | null;
  readonly median: number | null;
  readonly scoredCount: number;
  readonly notAssessedCount: number;
  readonly missingCount: number;
}

export interface InterestResult {
  readonly mean: number | null;
  readonly median: number | null;
  readonly band: ScoreBand | null;
  readonly distribution: Readonly<Record<ScoreBand, number>>;
  readonly assessedCount: number;
  readonly notAssessedCount: number;
  readonly unsureRate: number | null;
}

// --- diagnostics -----------------------------------------------------------

export interface OptionCount {
  readonly optionId: string;
  readonly count: number;
  /** Share of respondents who answered this question. Multi-selects do not sum to 1. */
  readonly rate: number | null;
}

export interface DistributionResult {
  readonly questionId: QuestionId;
  readonly answeredCount: number;
  readonly options: readonly OptionCount[];
}

/** Q19b. Diagnostic only - never scored, and never framed as a policy breach. */
export interface UnmanagedToolResult {
  /** Denominator excludes "Prefer not to say", which is reported separately. */
  readonly validCount: number;
  readonly preferNotToSayCount: number;
  readonly sometimesOrOftenCount: number;
  readonly sometimesOrOftenRate: number | null;
  readonly noOrgProvidedAccessCount: number;
  readonly noOrgProvidedAccessRate: number | null;
  readonly distribution: DistributionResult;
}

export interface DiagnosticsResult {
  /** Option frequencies for the scored single-select questions. Descriptive only. */
  readonly scoredQuestions: readonly DistributionResult[];
  readonly generalAiFrequency: DistributionResult;
  readonly workAiFrequency: DistributionResult;
  readonly tools: DistributionResult;
  readonly useCases: DistributionResult;
  readonly workflowArtifacts: DistributionResult;
  readonly barriers: DistributionResult;
  readonly trainingDemand: DistributionResult;
  readonly learningPreferences: DistributionResult;
  readonly painAreas: DistributionResult;
  readonly unmanagedTools: UnmanagedToolResult;
}

// --- classification --------------------------------------------------------

export interface ClassificationBucket {
  readonly level: ClassificationLevel;
  readonly key: ClassificationKey;
  readonly label: string;
  readonly count: number;
  readonly rate: number | null;
}

export interface ClassificationDistribution {
  readonly buckets: readonly ClassificationBucket[];
  readonly classifiedCount: number;
  readonly unclassifiedCount: number;
  /**
   * Organization-level champion signal only. Deliberately not a list, not a
   * count below five, and never linked to respondents. Spec 23.
   */
  readonly championSignal: {
    readonly active: boolean;
    readonly display: string | null;
  };
}

// --- recommendations -------------------------------------------------------

/**
 * A condition the rule actually evaluated, with the measured value beside the
 * threshold it was compared against. This is what "what we found" renders
 * from - measured statements, never generated prose.
 */
export interface FindingLine {
  readonly id: string;
  readonly description: string;
  readonly actual: number | null;
  readonly threshold: number;
  readonly comparator: Comparator;
}

export interface EvidenceLine {
  readonly metric: string;
  readonly questionId?: QuestionId;
  readonly label: string;
  readonly value: number | null;
  readonly unit: EvidenceUnit;
  readonly threshold?: number;
}

export interface MergedFindingCard {
  readonly sourceId: RecommendationId;
  readonly summary: string;
  readonly evidence: readonly EvidenceLine[];
}

export interface RecommendationCard {
  readonly id: RecommendationId;
  readonly family: RecommendationFamily;
  readonly priority: RecommendationPriority;
  readonly priorityLabel: string;
  readonly priorityMeaning: string;
  readonly title: string;
  readonly whatWeFound: readonly FindingLine[];
  readonly whyItMatters: string;
  readonly recommendedAction: string;
  readonly evidence: readonly EvidenceLine[];
  readonly confidenceLabel: ConfidenceLabel | null;
  readonly confidenceLabelCopy: string | null;
  /** Sub-findings folded in rather than given their own card. Spec 26, 27. */
  readonly mergedFindings: readonly MergedFindingCard[];
}

export interface RecommendationsResult {
  readonly engineVersion: string;
  /** At most three. Spec 24. */
  readonly primary: readonly RecommendationCard[];
  /** Up to three further signals. */
  readonly additional: readonly RecommendationCard[];
}

// --- opportunities ---------------------------------------------------------

export interface OpportunityRowResult {
  readonly categoryId: string;
  readonly label: string;
  readonly painCount: number;
  readonly painRate: number | null;
  /** Measured among respondents reporting THIS workflow as painful. Spec 30. */
  readonly aiUseAmongPainCount: number;
  readonly aiUseAmongPainRate: number | null;
  readonly status: OpportunityLabel | null;
}

export interface OpportunitiesResult {
  /** Respondents who answered Q26 - the pain-rate denominator. */
  readonly denominator: number;
  readonly rows: readonly OpportunityRowResult[];
  readonly guardrail: {
    readonly active: boolean;
    readonly safetyScore: number | null;
    readonly message: string | null;
  };
}

// --- segmentation ----------------------------------------------------------

export interface SegmentOption {
  readonly value: string;
  /**
   * Whether this segment can be reported at all. A boolean and nothing else:
   * returning the group size to "explain" a suppression would defeat the
   * suppression. Spec 33.
   */
  readonly reportable: boolean;
}

export interface SegmentDimensionOptions {
  readonly dimension: SegmentationDimension;
  readonly options: readonly SegmentOption[];
}

export interface SegmentationState {
  readonly available: readonly SegmentDimensionOptions[];
  readonly active: {
    readonly dimension: SegmentationDimension;
    readonly value: string;
  } | null;
  /** V1 permits exactly one filter dimension at a time. Spec 33. */
  readonly maxActiveDimensions: number;
}

// --- responses -------------------------------------------------------------

export interface ResultsInsufficientSample {
  readonly status: 'insufficient_sample';
  readonly pulse: ResultsPulseSummary;
  readonly sample: SampleState;
}

export interface ResultsSuppressed {
  readonly status: 'suppressed';
  readonly pulse: ResultsPulseSummary;
  readonly reason: SuppressionReason;
  /** So the UI can offer a different segment without a second request. */
  readonly segmentation: SegmentationState;
}

export interface ResultsOk {
  readonly status: 'ok';
  readonly pulse: ResultsPulseSummary;
  readonly sample: SampleState;
  readonly versions: EngineVersions;
  readonly segmentation: SegmentationState;
  readonly dimensions: readonly DimensionResult[];
  readonly questionScores: readonly QuestionScoreResult[];
  readonly interest: InterestResult;
  readonly classification: ClassificationDistribution;
  readonly diagnostics: DiagnosticsResult;
  readonly recommendations: RecommendationsResult;
  readonly opportunities: OpportunitiesResult;
}

export type ResultsResponse = ResultsInsufficientSample | ResultsSuppressed | ResultsOk;

// --- free text -------------------------------------------------------------

export interface FreeTextInsufficientSample {
  readonly status: 'insufficient_sample';
  readonly sample: SampleState;
}

export interface FreeTextOk {
  readonly status: 'ok';
  readonly sample: SampleState;
  /**
   * Plain strings, nothing else. No id, no date, no work context, no scores.
   * Free text is never segmentable and never joined to anything. Spec 34.4, 47.
   */
  readonly responses: readonly string[];
}

export type FreeTextResponse = FreeTextInsufficientSample | FreeTextOk;
