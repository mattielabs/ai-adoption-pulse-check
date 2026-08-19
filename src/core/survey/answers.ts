/**
 * The shape of a single respondent's answers.
 *
 * Every field is optional at the type level because a stored response may have
 * been collected under a partially-completed flow, and because the scoring
 * engine must handle missing data explicitly rather than assuming presence.
 * Required-ness is enforced by `validation.ts` at the API boundary, not by
 * this type. Spec 18, 56.
 */

import type * as O from './options.js';
import type { SurveyQuestion } from './questions.js';
import { SURVEY_QUESTIONS } from './questions.js';

export interface SurveyAnswers {
  // Section 1 - optional work context. Never scored, never row-exported.
  readonly q1?: O.Q1Option | undefined;
  readonly q2?: O.Q2Option | undefined;
  readonly q3?: O.Q3Option | undefined;

  // Section 2 - current AI use
  readonly q4?: O.Q4Option | undefined;
  readonly q5?: O.Q5Option | undefined;
  readonly q6?: readonly O.Q6Option[] | undefined;
  readonly q7?: readonly O.Q7Option[] | undefined;

  // Section 3 - self-reported confidence
  readonly q8?: O.ConfidenceScaleOption | undefined;
  readonly q9?: O.ConfidenceScaleOption | undefined;
  readonly q10?: O.ConfidenceScaleOption | undefined;
  readonly q11?: O.ConfidenceScaleOption | undefined;

  // Section 4 - workflow
  readonly q12?: O.Q12Option | undefined;
  readonly q13?: O.Q13Option | undefined;
  readonly q14?: O.Q14Option | undefined;
  readonly q15?: readonly O.Q15Option[] | undefined;

  // Section 5 - safe & responsible use
  readonly q16?: O.FrequencyScaleOption | undefined;
  readonly q17?: O.FrequencyScaleOption | undefined;
  readonly q18?: O.Q18Option | undefined;
  readonly q19?: O.Q19Option | undefined;
  readonly q19b?: O.Q19bOption | undefined;

  // Section 6 - organizational support
  readonly q20?: O.AgreementScaleOption | undefined;
  readonly q21?: O.AgreementScaleOption | undefined;
  readonly q22?: O.AgreementScaleOption | undefined;
  readonly q23?: readonly O.Q23Option[] | undefined;

  // Section 7 - learning & development
  readonly q24?: readonly O.Q24Option[] | undefined;
  readonly q25?: readonly O.Q25Option[] | undefined;

  // Section 8 - workflow & opportunity discovery
  readonly q26?: readonly O.Q26Option[] | undefined;
  readonly q27?: string | undefined;
  readonly q28?: O.Q28Option | undefined;
}

/** One stored survey response, as it exists in D1 and in demo fixtures. */
export interface SurveyResponse {
  /** Opaque row id. Never derived from anything identifying. */
  readonly id: string;
  /** Day granularity only (YYYY-MM-DD). Exact times are deliberately not stored. Spec 34.3. */
  readonly submittedOn: string;
  readonly surveyVersion: string;
  readonly answers: SurveyAnswers;
  /** Answers to up to three organization-specific questions. Never scored. */
  readonly customAnswers?: Readonly<Record<string, string | readonly string[]>> | undefined;
}

/** Maximum organization-specific questions per Pulse. Enforced in application validation. Spec 40. */
export const MAX_CUSTOM_QUESTIONS = 3;

/** Hard cap on a submitted response payload, in bytes. Spec 59. */
export const MAX_RESPONSE_PAYLOAD_BYTES = 32 * 1024;

/** Questions a respondent must answer for the response to be accepted. */
export const REQUIRED_QUESTION_IDS: readonly SurveyQuestion['id'][] = SURVEY_QUESTIONS.filter(
  (q) => q.required,
).map((q) => q.id);
