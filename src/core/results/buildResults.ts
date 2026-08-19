/**
 * Maps the analysis engine's output into the results API contract.
 *
 * This mapping is written out field by field rather than spread, and that is
 * the point. `OrganizationAggregate.respondents` holds per-person scores,
 * classifications and row ids; a `{...aggregate}` anywhere on this path would
 * ship all of it to a browser. Explicit construction means a field added to
 * the core aggregate later is invisible to the API until somebody deliberately
 * maps it.
 *
 * Nothing here computes methodology. Every number comes from the engine
 * unchanged - no rounding, no re-derivation, no thresholds. Rounding is the
 * client's job, at display time, so that a threshold comparison can never be
 * made against a rounded value.
 */

import { bandForScore, type ScoreBand } from '../aggregation/bands.js';
import type {
  DimensionAggregate,
  DiagnosticAggregates,
  OrganizationAggregate,
} from '../aggregation/aggregate.js';
import type { OptionDistribution } from '../aggregation/distributions.js';
import {
  CLASSIFICATION_KEY_BY_LEVEL,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_LEVELS,
} from '../classification/classifyRespondent.js';
import { DIMENSIONS } from '../survey/questions.js';
import type { QuestionId } from '../survey/questions.js';
import { SCORED_QUESTION_IDS } from '../scoring/questionValues.js';
import type { OpportunityMap } from '../opportunities/analyze.js';
import type {
  MergedFinding,
  RecommendationEngineResult,
  RecommendationResult,
} from '../recommendations/types.js';
import { CONFIDENCE_LABEL_COPY, PRIORITY_LABELS } from '../recommendations/types.js';
import { PRIORITY_MEANINGS, RECOMMENDATION_RATIONALE } from '../recommendations/presentation.js';
import type { PulseAnalysis } from '../analysis/runAnalysis.js';
import type {
  ClassificationDistribution,
  DiagnosticsResult,
  DimensionResult,
  DistributionResult,
  EvidenceLine,
  InterestResult,
  MergedFindingCard,
  OpportunitiesResult,
  QuestionScoreResult,
  RecommendationCard,
  RecommendationsResult,
  SampleState,
} from './contracts.js';
import { EARLY_DIRECTIONAL_BELOW, MINIMUM_REPORTABLE_RESPONSES } from './contracts.js';

function bandOf(mean: number | null): ScoreBand | null {
  return mean === null ? null : bandForScore(mean);
}

export function buildSampleState(responseCount: number, caveat: string | null): SampleState {
  return {
    responseCount,
    minimumRequired: MINIMUM_REPORTABLE_RESPONSES,
    sufficient: responseCount >= MINIMUM_REPORTABLE_RESPONSES,
    earlyDirectional:
      responseCount >= MINIMUM_REPORTABLE_RESPONSES && responseCount < EARLY_DIRECTIONAL_BELOW,
    caveat,
  };
}

function toDimension(aggregate: DimensionAggregate): DimensionResult {
  return {
    dimension: aggregate.dimension,
    mean: aggregate.mean,
    median: aggregate.median,
    band: bandOf(aggregate.mean),
    distribution: aggregate.distribution,
    scoredCount: aggregate.scoredCount,
    notAssessedCount: aggregate.notAssessedCount,
    unsureRate: aggregate.unsureRate,
    unsureRateBasis: aggregate.unsureRateBasis,
  };
}

function toDistribution(distribution: OptionDistribution): DistributionResult {
  return {
    questionId: distribution.questionId,
    answeredCount: distribution.answeredCount,
    options: Object.entries(distribution.counts).map(([optionId, count]) => ({
      optionId,
      count,
      rate: distribution.rates[optionId] ?? null,
    })),
  };
}

function toDiagnostics(diagnostics: DiagnosticAggregates): DiagnosticsResult {
  const unmanaged = diagnostics.unmanagedTools;
  return {
    scoredQuestions: Object.values(diagnostics.scoredQuestions).map(toDistribution),
    generalAiFrequency: toDistribution(diagnostics.generalAiFrequency),
    workAiFrequency: toDistribution(diagnostics.workAiFrequency),
    tools: toDistribution(diagnostics.tools),
    useCases: toDistribution(diagnostics.useCases),
    workflowArtifacts: toDistribution(diagnostics.workflowArtifacts),
    barriers: toDistribution(diagnostics.barriers),
    trainingDemand: toDistribution(diagnostics.trainingDemand),
    learningPreferences: toDistribution(diagnostics.learningPreferences),
    painAreas: toDistribution(diagnostics.painAreas),
    unmanagedTools: {
      validCount: unmanaged.validCount,
      preferNotToSayCount: unmanaged.preferNotToSayCount,
      sometimesOrOftenCount: unmanaged.sometimesOrOftenCount,
      sometimesOrOftenRate: unmanaged.sometimesOrOftenRate,
      noOrgProvidedAccessCount: unmanaged.noOrgProvidedAccessCount,
      noOrgProvidedAccessRate: unmanaged.noOrgProvidedAccessRate,
      distribution: toDistribution(unmanaged.distribution),
    },
  };
}

function toClassification(aggregate: OrganizationAggregate): ClassificationDistribution {
  const { classification, championSignal } = aggregate;

  return {
    buckets: CLASSIFICATION_LEVELS.map((level) => {
      const key = CLASSIFICATION_KEY_BY_LEVEL[level];
      return {
        level,
        key,
        label: CLASSIFICATION_LABELS[key],
        count: classification.counts[level],
        rate: classification.rates[level],
      };
    }),
    classifiedCount: classification.classifiedCount,
    unclassifiedCount: classification.unclassifiedCount,
    // Only the privacy-safe display form. The exact qualifying count is
    // deliberately not forwarded below the disclosure threshold. Spec 23.
    championSignal: {
      active: championSignal.signalPresent,
      display: championSignal.displayCount,
    },
  };
}

function toEvidence(items: RecommendationResult['evidence']): readonly EvidenceLine[] {
  return items.map((item) => ({
    metric: item.metric,
    ...(item.questionId === undefined ? {} : { questionId: item.questionId as QuestionId }),
    label: item.label,
    value: item.value,
    unit: item.unit,
    ...(item.threshold === undefined ? {} : { threshold: item.threshold }),
  }));
}

function toMergedFindings(findings: readonly MergedFinding[]): readonly MergedFindingCard[] {
  return findings.map((finding) => ({
    sourceId: finding.sourceId,
    summary: finding.summary,
    evidence: toEvidence(finding.evidence),
  }));
}

function toRecommendationCard(result: RecommendationResult): RecommendationCard {
  return {
    id: result.id,
    family: result.family,
    priority: result.priority,
    priorityLabel: PRIORITY_LABELS[result.priority],
    priorityMeaning: PRIORITY_MEANINGS[result.priority],
    title: result.title,
    // Only the conditions that were actually met, with their measured values.
    // This is a report of what fired, not a generated narrative.
    whatWeFound: result.conditions
      .filter((condition) => condition.met)
      .map((condition) => ({
        id: condition.id,
        description: condition.description,
        actual: condition.actual,
        threshold: condition.threshold,
        comparator: condition.comparator,
      })),
    whyItMatters: RECOMMENDATION_RATIONALE[result.id],
    recommendedAction: result.recommendedAction,
    evidence: toEvidence(result.evidence),
    confidenceLabel: result.confidenceLabel,
    confidenceLabelCopy:
      result.confidenceLabel === null ? null : CONFIDENCE_LABEL_COPY[result.confidenceLabel],
    mergedFindings: toMergedFindings(result.mergedFindings),
  };
}

/**
 * Primary and additional only. The engine's `evaluated` and `triggered` lists
 * are auditing surfaces - forwarding them would put rules the deduplication
 * deliberately suppressed back in front of the administrator, which is the
 * recommendation flooding V1.1 removed. Spec 27.
 */
function toRecommendations(engine: RecommendationEngineResult): RecommendationsResult {
  return {
    engineVersion: engine.engineVersion,
    primary: engine.primary.map(toRecommendationCard),
    additional: engine.additional.map(toRecommendationCard),
  };
}

function toOpportunities(map: OpportunityMap): OpportunitiesResult {
  return {
    denominator: map.denominator,
    rows: map.categories.map((category) => ({
      categoryId: category.categoryId,
      label: category.label,
      painCount: category.painCount,
      painRate: category.painRate,
      aiUseAmongPainCount: category.aiUseAmongPainCount,
      aiUseAmongPainRate: category.aiUseAmongPainRate,
      status: category.opportunityLabel,
    })),
    guardrail: {
      active: map.guardrail.active,
      safetyScore: map.guardrail.safetyScore,
      message: map.guardrail.message,
    },
  };
}

function toInterest(aggregate: OrganizationAggregate): InterestResult {
  const interest = aggregate.interest;
  return {
    mean: interest.mean,
    median: interest.median,
    band: bandOf(interest.mean),
    distribution: interest.distribution,
    assessedCount: interest.assessedCount,
    notAssessedCount: interest.notAssessedCount,
    unsureRate: interest.unsureRate,
  };
}

function toQuestionScores(aggregate: OrganizationAggregate): readonly QuestionScoreResult[] {
  return SCORED_QUESTION_IDS.map((questionId) => {
    const score = aggregate.questionScores[questionId];
    return {
      questionId: questionId as QuestionId,
      mean: score.mean,
      median: score.median,
      scoredCount: score.scoredCount,
      notAssessedCount: score.notAssessedCount,
      missingCount: score.missingCount,
    };
  });
}

export interface AnalysisPayload {
  readonly sample: SampleState;
  readonly dimensions: readonly DimensionResult[];
  readonly questionScores: readonly QuestionScoreResult[];
  readonly interest: InterestResult;
  readonly classification: ClassificationDistribution;
  readonly diagnostics: DiagnosticsResult;
  readonly recommendations: RecommendationsResult;
  readonly opportunities: OpportunitiesResult;
}

/** The whole core-to-DTO mapping, in one auditable place. */
export function buildAnalysisPayload(analysis: PulseAnalysis): AnalysisPayload {
  const aggregate = analysis.aggregate;

  return {
    sample: buildSampleState(analysis.responseCount, analysis.sampleCaveat),
    dimensions: DIMENSIONS.map((dimension) => toDimension(aggregate.dimensions[dimension])),
    questionScores: toQuestionScores(aggregate),
    interest: toInterest(aggregate),
    classification: toClassification(aggregate),
    diagnostics: toDiagnostics(aggregate.diagnostics),
    recommendations: toRecommendations(analysis.recommendations),
    opportunities: toOpportunities(analysis.opportunities),
  };
}
