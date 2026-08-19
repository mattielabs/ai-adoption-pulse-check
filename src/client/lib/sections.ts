/**
 * Builds the renderable survey model from the CANONICAL schema.
 *
 * Nothing here restates a question, an option, a section, or a limit - it all
 * comes from `src/core/survey/questions.ts`, plus the Pulse's configured
 * custom questions. Changing the survey means changing the schema, never this
 * file. Phase 1 brief 11-12.
 */

import {
  SURVEY_QUESTIONS,
  SURVEY_SECTIONS,
  SURVEY_SECTION_LABELS,
  QUESTION_IDS,
  type SurveyQuestion,
} from '../../core/survey/questions.js';
import type { SurveyAnswers } from '../../core/survey/answers.js';
import {
  CUSTOM_FREE_TEXT_MAX_LENGTH,
  type PublicCustomQuestion,
} from '../../core/survey/customQuestions.js';
import type { SubmissionPayload } from './api.js';

/** All in-progress answers, core and custom, keyed by question key. */
export type AnswerMap = Readonly<Record<string, string | readonly string[]>>;

export interface RenderableOption {
  readonly id: string;
  readonly label: string;
}

export interface RenderableQuestion {
  readonly key: string;
  readonly type: 'single_select' | 'multi_select' | 'free_text';
  readonly prompt: string;
  readonly helperText: string | null;
  readonly required: boolean;
  readonly options: readonly RenderableOption[] | null;
  readonly maxSelections: number | null;
  readonly maxLength: number | null;
}

export interface RenderableSection {
  readonly id: string;
  readonly title: string;
  readonly questions: readonly RenderableQuestion[];
}

function toRenderable(question: SurveyQuestion): RenderableQuestion {
  if (question.type === 'free_text') {
    return {
      key: question.id,
      type: 'free_text',
      prompt: question.prompt,
      helperText: question.helperText ?? null,
      required: question.required,
      options: null,
      maxSelections: null,
      maxLength: question.maxLength,
    };
  }
  return {
    key: question.id,
    type: question.type,
    prompt: question.prompt,
    helperText: question.helperText ?? null,
    required: question.required,
    options: question.options,
    maxSelections: question.maxSelections,
    maxLength: null,
  };
}

function customToRenderable(question: PublicCustomQuestion): RenderableQuestion {
  return {
    key: question.key,
    type: question.type,
    prompt: question.questionText,
    helperText: null,
    // Every custom question is optional; they never gate completion.
    required: false,
    options: question.options,
    maxSelections: null,
    maxLength: question.type === 'free_text' ? CUSTOM_FREE_TEXT_MAX_LENGTH : null,
  };
}

/**
 * The eight core sections, plus one clearly-labelled final section when the
 * Pulse has custom questions.
 */
export function buildSections(
  customQuestions: readonly PublicCustomQuestion[],
): readonly RenderableSection[] {
  const core = SURVEY_SECTIONS.map((sectionId) => ({
    id: sectionId as string,
    title: SURVEY_SECTION_LABELS[sectionId],
    questions: SURVEY_QUESTIONS.filter((q) => q.section === sectionId).map(toRenderable),
  }));

  if (customQuestions.length === 0) return core;
  return [
    ...core,
    {
      id: 'custom',
      title: 'Additional questions from your organization',
      questions: customQuestions.map(customToRenderable),
    },
  ];
}

export function totalQuestionCount(customQuestions: readonly PublicCustomQuestion[]): number {
  return SURVEY_QUESTIONS.length + customQuestions.length;
}

/**
 * Client-side check for one question. Mirrors (never replaces) the server's
 * validation: required-ness and selection limits come from the same schema
 * properties the server enforces.
 */
export function questionError(
  question: RenderableQuestion,
  value: string | readonly string[] | undefined,
): string | null {
  if (question.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : [];
    if (question.required && selected.length === 0) return 'Select at least one option.';
    if (question.maxSelections !== null && selected.length > question.maxSelections) {
      return `Select at most ${question.maxSelections}.`;
    }
    return null;
  }
  if (question.type === 'single_select') {
    if (question.required && (typeof value !== 'string' || value === '')) {
      return 'Select an option to continue.';
    }
    return null;
  }
  // Free text: none are required in V1; length is capped by the control.
  return null;
}

export function sectionErrors(
  section: RenderableSection,
  answers: AnswerMap,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const question of section.questions) {
    const error = questionError(question, answers[question.key]);
    if (error !== null) errors[question.key] = error;
  }
  return errors;
}

const CORE_QUESTION_IDS = new Set<string>(QUESTION_IDS);

function isMeaningful(value: string | readonly string[]): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value.length > 0;
}

/**
 * Splits the in-progress answer map into the submission payload: core answers
 * (empty selections and blank text omitted) and custom answers keyed c1..c3.
 */
export function buildSubmissionPayload(
  answers: AnswerMap,
  surveyVersion: string,
): SubmissionPayload {
  const core: Record<string, string | readonly string[]> = {};
  const custom: Record<string, string | readonly string[]> = {};

  for (const [key, rawValue] of Object.entries(answers)) {
    if (!isMeaningful(rawValue)) continue;
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (CORE_QUESTION_IDS.has(key)) core[key] = value;
    else if (/^c[1-3]$/.test(key)) custom[key] = value;
    // Anything else (a corrupt draft key) is dropped rather than submitted.
  }

  const payload: SubmissionPayload = {
    surveyVersion,
    answers: core as SurveyAnswers,
    ...(Object.keys(custom).length > 0 ? { customAnswers: custom } : {}),
  };
  return payload;
}
