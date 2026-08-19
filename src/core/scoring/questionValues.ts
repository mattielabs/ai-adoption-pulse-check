/**
 * Per-question 0-100 values.
 *
 * Some recommendation rules key off a single question's organization score
 * rather than a whole dimension (R02 uses Q18/Q19/Q20; R03 uses Q16/Q17).
 * Those need the same mappings the dimensions use, so both read from here.
 */

import type { SurveyAnswers } from '../survey/answers.js';
import type { QuestionId } from '../survey/questions.js';
import {
  AGREEMENT_VALUES,
  CONFIDENCE_VALUES,
  FREQUENCY_VALUES,
  Q12_VALUES,
  Q13_VALUES,
  Q14_VALUES,
  Q18_VALUES,
  Q19_VALUES,
  Q5_VALUES,
  q7BreadthValue,
} from './mappings.js';
import { MISSING, type MappedValue } from './types.js';

export type ScoredQuestionId =
  | 'q5' | 'q7'
  | 'q8' | 'q9' | 'q10' | 'q11'
  | 'q12' | 'q13' | 'q14'
  | 'q16' | 'q17' | 'q18'
  | 'q19' | 'q20' | 'q21' | 'q22';

export const SCORED_QUESTION_IDS: readonly ScoredQuestionId[] = [
  'q5', 'q7',
  'q8', 'q9', 'q10', 'q11',
  'q12', 'q13', 'q14',
  'q16', 'q17', 'q18',
  'q19', 'q20', 'q21', 'q22',
];

type Mapper = (answers: SurveyAnswers) => MappedValue;

export const QUESTION_VALUE_MAPPERS: Readonly<Record<ScoredQuestionId, Mapper>> = {
  q5: (a) => (a.q5 === undefined ? MISSING : Q5_VALUES[a.q5]),
  q7: (a) => (a.q7 === undefined || a.q7.length === 0 ? MISSING : q7BreadthValue(a.q7)),
  q8: (a) => (a.q8 === undefined ? MISSING : CONFIDENCE_VALUES[a.q8]),
  q9: (a) => (a.q9 === undefined ? MISSING : CONFIDENCE_VALUES[a.q9]),
  q10: (a) => (a.q10 === undefined ? MISSING : CONFIDENCE_VALUES[a.q10]),
  q11: (a) => (a.q11 === undefined ? MISSING : CONFIDENCE_VALUES[a.q11]),
  q12: (a) => (a.q12 === undefined ? MISSING : Q12_VALUES[a.q12]),
  q13: (a) => (a.q13 === undefined ? MISSING : Q13_VALUES[a.q13]),
  q14: (a) => (a.q14 === undefined ? MISSING : Q14_VALUES[a.q14]),
  q16: (a) => (a.q16 === undefined ? MISSING : FREQUENCY_VALUES[a.q16]),
  q17: (a) => (a.q17 === undefined ? MISSING : FREQUENCY_VALUES[a.q17]),
  q18: (a) => (a.q18 === undefined ? MISSING : Q18_VALUES[a.q18]),
  q19: (a) => (a.q19 === undefined ? MISSING : Q19_VALUES[a.q19]),
  q20: (a) => (a.q20 === undefined ? MISSING : AGREEMENT_VALUES[a.q20]),
  q21: (a) => (a.q21 === undefined ? MISSING : AGREEMENT_VALUES[a.q21]),
  q22: (a) => (a.q22 === undefined ? MISSING : AGREEMENT_VALUES[a.q22]),
};

export function questionValue(answers: SurveyAnswers, questionId: ScoredQuestionId): MappedValue {
  return QUESTION_VALUE_MAPPERS[questionId](answers);
}

export function isScoredQuestionId(id: QuestionId): id is ScoredQuestionId {
  return (SCORED_QUESTION_IDS as readonly string[]).includes(id);
}
