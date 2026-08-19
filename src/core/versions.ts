/**
 * Central version constants.
 *
 * Every stored response records the survey version it was collected under, and
 * every analysis/export identifies all three versions. If scoring changes later,
 * historical results must remain reproducible under their original version, so
 * these strings must never be edited in place — a new version is added instead.
 *
 * Source of truth: V1.1 spec §57.
 */

export const SURVEY_VERSION = '1.1.0' as const;
export const SCORING_VERSION = '1.1.0' as const;
export const RECOMMENDATION_ENGINE_VERSION = '1.1.0' as const;

export type SurveyVersion = typeof SURVEY_VERSION;
export type ScoringVersion = typeof SCORING_VERSION;
export type RecommendationEngineVersion = typeof RECOMMENDATION_ENGINE_VERSION;

/** Versions stamped onto every analysis result and every export. */
export interface EngineVersions {
  readonly surveyVersion: string;
  readonly scoringVersion: string;
  readonly recommendationEngineVersion: string;
}

export const ENGINE_VERSIONS: EngineVersions = {
  surveyVersion: SURVEY_VERSION,
  scoringVersion: SCORING_VERSION,
  recommendationEngineVersion: RECOMMENDATION_ENGINE_VERSION,
};

/** Survey versions this build knows how to score. */
export const SUPPORTED_SURVEY_VERSIONS: readonly string[] = [SURVEY_VERSION];

export function isSupportedSurveyVersion(version: string): boolean {
  return SUPPORTED_SURVEY_VERSIONS.includes(version);
}
