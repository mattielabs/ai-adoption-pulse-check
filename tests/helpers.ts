/**
 * Test builders.
 *
 * `completeAnswers` is a deliberately mid-range, fully-answered response. Tests
 * override only the fields they are about, so a failure points at the thing
 * under test rather than at incidental setup.
 */

import type { SurveyAnswers, SurveyResponse } from '../src/core/survey/answers.js';
import type { RecommendationContext } from '../src/core/recommendations/evidence.js';
import type { ScoredQuestionId } from '../src/core/scoring/questionValues.js';
import { SCORED_QUESTION_IDS } from '../src/core/scoring/questionValues.js';
import { SURVEY_VERSION } from '../src/core/versions.js';

export const COMPLETE_ANSWERS: SurveyAnswers = {
  q1: 'it_technology',
  q2: 'individual_contributor',
  q3: 'documents_information_data',
  q4: 'few_times_week',
  q5: 'few_times_week',
  q6: ['chatgpt'],
  q7: ['email_communication', 'research_information'],
  q8: 'somewhat_confident',
  q9: 'somewhat_confident',
  q10: 'somewhat_confident',
  q11: 'somewhat_confident',
  q12: 'regular_individual_tasks',
  q13: 'sometimes',
  q14: 'see_opportunities',
  q15: ['none_of_these'],
  q16: 'sometimes',
  q17: 'usually',
  q18: 'somewhat_confident',
  q19: 'general_idea',
  q19b: 'rarely',
  q20: 'neither',
  q21: 'neither',
  q22: 'disagree',
  q23: ['not_enough_time'],
  q24: ['ai_basics'],
  q25: ['short_tutorials'],
  q26: ['email_communication'],
  q28: 'moderately_interested',
};

export function answers(overrides: Partial<SurveyAnswers> = {}): SurveyAnswers {
  return { ...COMPLETE_ANSWERS, ...overrides };
}

/**
 * Builds answers with specific keys removed entirely, which is different from
 * setting them to a Not-Assessed option.
 */
export function answersWithout(
  omit: readonly (keyof SurveyAnswers)[],
  overrides: Partial<SurveyAnswers> = {},
): SurveyAnswers {
  const result: Record<string, unknown> = { ...COMPLETE_ANSWERS, ...overrides };
  for (const key of omit) delete result[key];
  return result as SurveyAnswers;
}

let responseCounter = 0;

export function response(
  overrides: Partial<SurveyAnswers> = {},
  meta: Partial<Omit<SurveyResponse, 'answers'>> = {},
): SurveyResponse {
  responseCounter += 1;
  return {
    id: meta.id ?? `test-${String(responseCounter).padStart(4, '0')}`,
    submittedOn: meta.submittedOn ?? '2026-06-01',
    surveyVersion: meta.surveyVersion ?? SURVEY_VERSION,
    answers: answers(overrides),
  };
}

export function responses(count: number, overrides: Partial<SurveyAnswers> = {}): SurveyResponse[] {
  return Array.from({ length: count }, () => response(overrides));
}

function neutralQuestionScores(): Record<ScoredQuestionId, number | null> {
  return Object.fromEntries(SCORED_QUESTION_IDS.map((id) => [id, 75])) as Record<
    ScoredQuestionId,
    number | null
  >;
}

/**
 * Overrides allow partial nested records so a test can set one question score
 * without restating the other fifteen.
 */
export type ContextOverrides = Omit<
  Partial<RecommendationContext>,
  'questionScores' | 'proportions'
> & {
  readonly questionScores?: Partial<Record<ScoredQuestionId, number | null>>;
  readonly proportions?: Partial<RecommendationContext['proportions']>;
};

/**
 * A recommendation context in which NO rule fires. Rule tests set only the
 * inputs their rule reads, so a rule firing is unambiguous evidence about that
 * rule rather than a side effect of the baseline.
 */
export function baseContext(overrides: ContextOverrides = {}): RecommendationContext {
  const base: RecommendationContext = {
    responseCount: 30,
    adoption: 30,
    confidence: 80,
    workflow: 80,
    safety: 80,
    enablement: 80,
    interest: 55,
    questionScores: neutralQuestionScores(),
    unmanagedToolRate: 0,
    unmanagedToolPreferNotToSayCount: 0,
    noOrgProvidedAccessRate: 0,
    championCount: 0,
    proportions: {
      lowAdoption: 0,
      lowConfidence: 0,
      lowWorkflow: 0,
      lowSafety: 0,
      lowEnablement: 0,
      highInterest: 0,
      weakVerification: 0,
      unclearGuidance: 0,
    },
    topBarriers: [],
    topTrainingDemand: [],
    topLearningPreferences: [],
  };

  return {
    ...base,
    ...overrides,
    questionScores: { ...base.questionScores, ...(overrides.questionScores ?? {}) },
    proportions: { ...base.proportions, ...(overrides.proportions ?? {}) },
  };
}
