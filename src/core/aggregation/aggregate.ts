/**
 * Organization-level aggregation.
 *
 * Respondent scores are calculated FIRST and then aggregated. Organization
 * scores are never computed by pooling raw answer points, because that would
 * let a respondent who answered more questions carry more weight than one who
 * answered fewer. Spec 21.
 *
 * Everything here returns typed structured data. No charts, no formatting.
 */

import type { SurveyResponse } from '../survey/answers.js';
import type { Dimension } from '../survey/questions.js';
import { DIMENSIONS } from '../survey/questions.js';
import { calculateInterest, calculateScores } from '../scoring/calculateScores.js';
import type { RespondentScores } from '../scoring/types.js';
import { MISSING, NOT_ASSESSED } from '../scoring/types.js';
import {
  SCORED_QUESTION_IDS,
  questionValue,
  type ScoredQuestionId,
} from '../scoring/questionValues.js';
import {
  classifyRespondent,
  CLASSIFICATION_LEVELS,
  type ClassificationLevel,
} from '../classification/classifyRespondent.js';
import {
  isPotentialChampion,
  summarizeChampionSignal,
  type ChampionSignal,
} from '../classification/championSignal.js';
import { bandForScore, emptyBandDistribution, sampleCaveat, type ScoreBand } from './bands.js';
import { multiSelectDistribution, singleSelectDistribution, type OptionDistribution } from './distributions.js';
import { mean, median, rate } from '../util/number.js';

export interface DimensionAggregate {
  readonly dimension: Dimension;
  readonly mean: number | null;
  readonly median: number | null;
  readonly distribution: Readonly<Record<ScoreBand, number>>;
  readonly scoredCount: number;
  readonly notAssessedCount: number;
  /**
   * Proportion of respondents who selected an Unsure / unclear / not-done
   * option relevant to this dimension. Always displayed beside the score so
   * that the deliberate "Unsure = 0" choices stay visible. Spec 16, 17, 21.
   */
  readonly unsureRate: number | null;
  readonly unsureRateBasis: string | null;
}

export interface QuestionScoreAggregate {
  readonly questionId: ScoredQuestionId;
  readonly mean: number | null;
  readonly median: number | null;
  readonly scoredCount: number;
  readonly notAssessedCount: number;
  readonly missingCount: number;
}

export interface InterestAggregate {
  readonly mean: number | null;
  readonly median: number | null;
  readonly distribution: Readonly<Record<ScoreBand, number>>;
  readonly assessedCount: number;
  readonly notAssessedCount: number;
  readonly unsureRate: number | null;
}

export interface ClassificationAggregate {
  readonly counts: Readonly<Record<ClassificationLevel, number>>;
  readonly rates: Readonly<Record<ClassificationLevel, number | null>>;
  readonly classifiedCount: number;
  readonly unclassifiedCount: number;
}

/** Q19b independently-accessed AI tooling. Diagnostic, plus evidence for R10. */
export interface UnmanagedToolAggregate {
  /** Denominator excludes "Prefer not to say" only. Spec 26 R10. */
  readonly validCount: number;
  readonly preferNotToSayCount: number;
  readonly sometimesOrOftenCount: number;
  readonly sometimesOrOftenRate: number | null;
  readonly noOrgProvidedAccessCount: number;
  readonly noOrgProvidedAccessRate: number | null;
  readonly distribution: OptionDistribution;
}

export interface DiagnosticAggregates {
  readonly generalAiFrequency: OptionDistribution;
  readonly workAiFrequency: OptionDistribution;
  readonly tools: OptionDistribution;
  readonly useCases: OptionDistribution;
  readonly workflowArtifacts: OptionDistribution;
  readonly barriers: OptionDistribution;
  readonly trainingDemand: OptionDistribution;
  readonly learningPreferences: OptionDistribution;
  readonly painAreas: OptionDistribution;
  readonly unmanagedTools: UnmanagedToolAggregate;
}

export interface RespondentResult {
  readonly responseId: string;
  readonly scores: RespondentScores;
  /** Reported separately from the five dimensions, never averaged into them. */
  readonly interest: number | null;
  readonly classificationLevel: ClassificationLevel | null;
  readonly isPotentialChampion: boolean;
}

export interface OrganizationAggregate {
  readonly responseCount: number;
  readonly sampleCaveat: string | null;
  readonly dimensions: Readonly<Record<Dimension, DimensionAggregate>>;
  readonly questionScores: Readonly<Record<ScoredQuestionId, QuestionScoreAggregate>>;
  readonly interest: InterestAggregate;
  readonly classification: ClassificationAggregate;
  readonly championSignal: ChampionSignal;
  readonly diagnostics: DiagnosticAggregates;
  readonly respondents: readonly RespondentResult[];
}

// --- Unsure / unclear rate definitions -------------------------------------
// Each dimension reports the rate of respondents who chose at least one
// Unsure / unclear / not-done option among that dimension's own inputs.

const UNSURE_RATE_BASIS: Readonly<Record<Dimension, string | null>> = {
  adoption: null, // Q5 and Q7 have no Unsure option.
  confidence: 'Q8-Q11 "I have not done this"',
  workflow: 'Q14 "Unsure"',
  safety: 'Q18 "Unsure"',
  enablement: 'Q19 "Unsure"/"not defined" or Q20-Q22 "Unsure"',
};

function respondentHasUnclearAnswer(response: SurveyResponse, dimension: Dimension): boolean {
  const a = response.answers;
  switch (dimension) {
    case 'adoption':
      return false;
    case 'confidence':
      return [a.q8, a.q9, a.q10, a.q11].some((v) => v === 'not_done_this');
    case 'workflow':
      return a.q14 === 'unsure';
    case 'safety':
      return a.q18 === 'unsure';
    case 'enablement':
      return (
        a.q19 === 'unsure' ||
        a.q19 === 'not_defined' ||
        a.q20 === 'unsure' ||
        a.q21 === 'unsure' ||
        a.q22 === 'unsure'
      );
    default: {
      const exhaustive: never = dimension;
      throw new Error(`Unhandled dimension: ${String(exhaustive)}`);
    }
  }
}

function aggregateDimension(
  dimension: Dimension,
  responses: readonly SurveyResponse[],
  scored: readonly RespondentScores[],
): DimensionAggregate {
  const values: number[] = [];
  const distribution = emptyBandDistribution();
  let notAssessedCount = 0;

  for (const scores of scored) {
    const result = scores[dimension];
    if (!result.assessed) {
      notAssessedCount += 1;
      continue;
    }
    values.push(result.score);
    distribution[bandForScore(result.score)] += 1;
  }

  const unclearCount = responses.filter((r) => respondentHasUnclearAnswer(r, dimension)).length;
  const basis = UNSURE_RATE_BASIS[dimension];

  return {
    dimension,
    mean: mean(values),
    median: median(values),
    distribution,
    scoredCount: values.length,
    notAssessedCount,
    unsureRate: basis === null ? null : rate(unclearCount, responses.length),
    unsureRateBasis: basis,
  };
}

function aggregateQuestion(
  questionId: ScoredQuestionId,
  responses: readonly SurveyResponse[],
): QuestionScoreAggregate {
  const values: number[] = [];
  let notAssessedCount = 0;
  let missingCount = 0;

  for (const response of responses) {
    const value = questionValue(response.answers, questionId);
    if (value === NOT_ASSESSED) notAssessedCount += 1;
    else if (value === MISSING) missingCount += 1;
    else values.push(value);
  }

  return {
    questionId,
    mean: mean(values),
    median: median(values),
    scoredCount: values.length,
    notAssessedCount,
    missingCount,
  };
}

function aggregateInterest(responses: readonly SurveyResponse[]): InterestAggregate {
  const values: number[] = [];
  const distribution = emptyBandDistribution();
  let notAssessedCount = 0;
  let unsureCount = 0;

  for (const response of responses) {
    if (response.answers.q28 === 'unsure') unsureCount += 1;
    const interest = calculateInterest(response.answers);
    if (!interest.assessed) {
      notAssessedCount += 1;
      continue;
    }
    values.push(interest.score);
    distribution[bandForScore(interest.score)] += 1;
  }

  return {
    mean: mean(values),
    median: median(values),
    distribution,
    assessedCount: values.length,
    notAssessedCount,
    unsureRate: rate(unsureCount, responses.length),
  };
}

function aggregateUnmanagedTools(responses: readonly SurveyResponse[]): UnmanagedToolAggregate {
  let validCount = 0;
  let preferNotToSayCount = 0;
  let sometimesOrOftenCount = 0;
  let noOrgProvidedAccessCount = 0;

  for (const response of responses) {
    const answer = response.answers.q19b;
    if (answer === undefined) continue;
    if (answer === 'prefer_not_to_say') {
      preferNotToSayCount += 1;
      continue;
    }
    validCount += 1;
    if (answer === 'sometimes' || answer === 'often') sometimesOrOftenCount += 1;
    if (answer === 'no_org_provided_access') noOrgProvidedAccessCount += 1;
  }

  return {
    validCount,
    preferNotToSayCount,
    sometimesOrOftenCount,
    sometimesOrOftenRate: rate(sometimesOrOftenCount, validCount),
    noOrgProvidedAccessCount,
    noOrgProvidedAccessRate: rate(noOrgProvidedAccessCount, validCount),
    distribution: singleSelectDistribution(responses, 'q19b'),
  };
}

export function aggregateResponses(responses: readonly SurveyResponse[]): OrganizationAggregate {
  const scored = responses.map((r) => calculateScores(r.answers));

  const respondents: RespondentResult[] = responses.map((response, index) => {
    const scores = scored[index] as RespondentScores;
    const classification = classifyRespondent(response.answers);
    const interest = calculateInterest(response.answers);
    return {
      responseId: response.id,
      scores,
      interest: interest.assessed ? interest.score : null,
      classificationLevel: classification.classified ? classification.level : null,
      isPotentialChampion: isPotentialChampion(response.answers, scores),
    };
  });

  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, aggregateDimension(d, responses, scored)]),
  ) as Record<Dimension, DimensionAggregate>;

  const questionScores = Object.fromEntries(
    SCORED_QUESTION_IDS.map((id) => [id, aggregateQuestion(id, responses)]),
  ) as Record<ScoredQuestionId, QuestionScoreAggregate>;

  const counts = Object.fromEntries(CLASSIFICATION_LEVELS.map((l) => [l, 0])) as Record<
    ClassificationLevel,
    number
  >;
  let unclassifiedCount = 0;
  for (const respondent of respondents) {
    if (respondent.classificationLevel === null) unclassifiedCount += 1;
    else counts[respondent.classificationLevel] += 1;
  }
  const classifiedCount = respondents.length - unclassifiedCount;
  const rates = Object.fromEntries(
    CLASSIFICATION_LEVELS.map((l) => [l, rate(counts[l], classifiedCount)]),
  ) as Record<ClassificationLevel, number | null>;

  const championCount = respondents.filter((r) => r.isPotentialChampion).length;

  return {
    responseCount: responses.length,
    sampleCaveat: sampleCaveat(responses.length),
    dimensions,
    questionScores,
    interest: aggregateInterest(responses),
    classification: { counts, rates, classifiedCount, unclassifiedCount },
    championSignal: summarizeChampionSignal(championCount),
    diagnostics: {
      generalAiFrequency: singleSelectDistribution(responses, 'q4'),
      workAiFrequency: singleSelectDistribution(responses, 'q5'),
      tools: multiSelectDistribution(responses, 'q6'),
      useCases: multiSelectDistribution(responses, 'q7'),
      workflowArtifacts: multiSelectDistribution(responses, 'q15'),
      barriers: multiSelectDistribution(responses, 'q23'),
      trainingDemand: multiSelectDistribution(responses, 'q24'),
      learningPreferences: multiSelectDistribution(responses, 'q25'),
      painAreas: multiSelectDistribution(responses, 'q26'),
      unmanagedTools: aggregateUnmanagedTools(responses),
    },
    respondents,
  };
}
