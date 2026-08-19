/**
 * Working values for the Pulse form, and the conversions between them, the
 * admin API payload, and an existing Pulse's stored configuration.
 *
 * Duplication is just `fromDetail` plus new dates: the copy goes out through
 * the ordinary create endpoint, so there is one code path that brings a Pulse
 * into existence rather than a second, divergent one.
 */

import type { AdminPulseDetail } from '../../core/admin/contracts.js';
import type { CustomQuestionType } from '../../core/survey/customQuestions.js';
import { localCalendarDay } from '../../core/pulse/day.js';
import type { PulsePayload } from '../lib/adminApi.js';

export interface CustomQuestionDraft {
  /** Stable list key. Local to the form; never sent to the server. */
  readonly key: string;
  readonly type: CustomQuestionType;
  readonly questionText: string;
  readonly optionLabels: readonly string[];
}

export interface PulseFormValues {
  readonly name: string;
  readonly description: string;
  readonly opensOn: string;
  readonly closesOn: string;
  readonly personalResultsEnabled: boolean;
  readonly customQuestions: readonly CustomQuestionDraft[];
}

let keyCounter = 0;

export function newQuestionKey(): string {
  keyCounter += 1;
  return `q${keyCounter}`;
}

export function blankQuestion(type: CustomQuestionType = 'single_select'): CustomQuestionDraft {
  return {
    key: newQuestionKey(),
    type,
    questionText: '',
    optionLabels: type === 'free_text' ? [] : ['', ''],
  };
}

/** A new Pulse defaults to opening on the administrator's local today. */
export function blankPulse(today: Date = new Date()): PulseFormValues {
  return {
    name: '',
    description: '',
    opensOn: localCalendarDay(today),
    closesOn: '',
    personalResultsEnabled: true,
    customQuestions: [],
  };
}

export function fromDetail(detail: AdminPulseDetail): PulseFormValues {
  return {
    name: detail.name,
    description: detail.description ?? '',
    opensOn: detail.opensOn ?? '',
    closesOn: detail.closesOn ?? '',
    personalResultsEnabled: detail.personalResultsEnabled,
    customQuestions: detail.customQuestions.map((question) => ({
      key: newQuestionKey(),
      type: question.type,
      questionText: question.questionText,
      optionLabels: (question.options ?? []).map((option) => option.label),
    })),
  };
}

/**
 * Prefill for "duplicate": the configuration carries over, the identity and
 * the schedule do not. Responses, counts and dates are never copied.
 */
export function duplicateOf(detail: AdminPulseDetail, today: Date = new Date()): PulseFormValues {
  const base = fromDetail(detail);
  return {
    ...base,
    name: `${detail.name} (copy)`,
    opensOn: localCalendarDay(today),
    closesOn: '',
  };
}

export function toPayload(values: PulseFormValues): PulsePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() === '' ? null : values.description.trim(),
    opensOn: values.opensOn,
    closesOn: values.closesOn === '' ? null : values.closesOn,
    personalResultsEnabled: values.personalResultsEnabled,
    customQuestions: values.customQuestions.map((question) => ({
      type: question.type,
      questionText: question.questionText.trim(),
      optionLabels:
        question.type === 'free_text'
          ? []
          : question.optionLabels.map((label) => label.trim()).filter((label) => label !== ''),
    })),
  };
}

export const QUESTION_TYPE_LABELS: Record<CustomQuestionType, string> = {
  single_select: 'Choose one',
  multi_select: 'Choose several',
  free_text: 'Written answer',
};
