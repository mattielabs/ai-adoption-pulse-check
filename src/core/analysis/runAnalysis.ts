/**
 * The full analysis pipeline, in one place.
 *
 *   responses
 *     -> privacy suppression        (before anything is computed)
 *     -> respondent scores
 *     -> organization aggregation
 *     -> recommendation engine
 *     -> opportunity engine
 *     -> safe analysis
 *
 * Suppression runs FIRST so that a suppressed segment never has an aggregate
 * computed for it at all - there is nothing to accidentally leak downstream.
 * Spec 43.
 *
 * At V1 scale this is calculated on read. There is deliberately no aggregate
 * cache and no `pulse_aggregates` table. Spec 43, 71.
 */

import type { SurveyResponse } from '../survey/answers.js';
import { ENGINE_VERSIONS, type EngineVersions } from '../versions.js';
import { aggregateResponses, type OrganizationAggregate } from '../aggregation/aggregate.js';
import { buildRecommendationContext } from '../recommendations/evidence.js';
import { runRecommendationEngine } from '../recommendations/engine.js';
import type { RecommendationEngineResult } from '../recommendations/types.js';
import { analyzeOpportunities, type OpportunityMap } from '../opportunities/analyze.js';
import { applySegmentation, type SegmentFilter } from '../privacy/segmentation.js';
import type { SegmentationDimension, SuppressionReason } from '../privacy/thresholds.js';

export interface AnalysisSegment {
  readonly dimension: SegmentationDimension | null;
  readonly value: string | null;
  readonly segmentCount: number;
  readonly complementCount: number;
}

export interface PulseAnalysis {
  readonly suppressed: false;
  readonly versions: EngineVersions;
  readonly segment: AnalysisSegment;
  readonly responseCount: number;
  readonly sampleCaveat: string | null;
  readonly aggregate: OrganizationAggregate;
  readonly recommendations: RecommendationEngineResult;
  readonly opportunities: OpportunityMap;
}

export interface SuppressedAnalysis {
  readonly suppressed: true;
  readonly reason: SuppressionReason;
}

export type AnalysisResult = PulseAnalysis | SuppressedAnalysis;

export interface AnalysisOptions {
  /** At most one filter. More than one is refused rather than truncated. */
  readonly filters?: readonly SegmentFilter[];
}

export function runAnalysis(
  responses: readonly SurveyResponse[],
  options: AnalysisOptions = {},
): AnalysisResult {
  const segmentation = applySegmentation(responses, options.filters ?? []);
  if (segmentation.suppressed) {
    return { suppressed: true, reason: segmentation.reason };
  }

  const scoped = segmentation.responses;
  const aggregate = aggregateResponses(scoped);
  const context = buildRecommendationContext(aggregate, scoped);
  const recommendations = runRecommendationEngine(context);
  const opportunities = analyzeOpportunities(scoped, aggregate.dimensions.safety.mean);

  return {
    suppressed: false,
    versions: ENGINE_VERSIONS,
    segment: {
      dimension: segmentation.dimension,
      value: segmentation.value,
      segmentCount: segmentation.segmentCount,
      complementCount: segmentation.complementCount,
    },
    responseCount: scoped.length,
    sampleCaveat: aggregate.sampleCaveat,
    aggregate,
    recommendations,
    opportunities,
  };
}
