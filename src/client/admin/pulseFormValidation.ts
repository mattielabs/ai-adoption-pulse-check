/**
 * Client-side checks for the Pulse form.
 *
 * These mirror the server schema so an administrator gets feedback before a
 * round trip. They are not the enforcement point: `pulseCreateSchema` and
 * `pulseUpdateSchema` re-validate everything, and the configuration lock is
 * decided by the server alone.
 */

import { isCalendarDay } from '../../core/pulse/day.js';
import {
  CUSTOM_OPTION_LABEL_MAX_LENGTH,
  CUSTOM_QUESTION_TEXT_MAX_LENGTH,
  MAX_CUSTOM_OPTIONS,
  MIN_CUSTOM_OPTIONS,
  PULSE_DESCRIPTION_MAX_LENGTH,
  PULSE_NAME_MAX_LENGTH,
} from '../../core/admin/schemas.js';
import type { PulseFormValues } from './pulseFormValues.js';

export interface QuestionErrors {
  readonly questionText?: string;
  readonly optionLabels?: string;
}

export interface PulseFormErrors {
  readonly name?: string;
  readonly description?: string;
  readonly opensOn?: string;
  readonly closesOn?: string;
  readonly questions: Readonly<Record<string, QuestionErrors>>;
}

export const NO_ERRORS: PulseFormErrors = { questions: {} };

export function validatePulseForm(values: PulseFormValues): PulseFormErrors {
  const errors: {
    name?: string;
    description?: string;
    opensOn?: string;
    closesOn?: string;
    questions: Record<string, QuestionErrors>;
  } = { questions: {} };

  if (values.name.trim() === '') errors.name = 'Give this Pulse a name.';
  else if (values.name.trim().length > PULSE_NAME_MAX_LENGTH) {
    errors.name = `Use at most ${PULSE_NAME_MAX_LENGTH} characters.`;
  }

  if (values.description.trim().length > PULSE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Use at most ${PULSE_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (values.opensOn === '') errors.opensOn = 'Choose an opening date.';
  else if (!isCalendarDay(values.opensOn)) errors.opensOn = 'Choose a real date.';

  if (values.closesOn !== '') {
    if (!isCalendarDay(values.closesOn)) errors.closesOn = 'Choose a real date.';
    else if (errors.opensOn === undefined && values.closesOn < values.opensOn) {
      errors.closesOn = 'The closing date cannot be before the opening date.';
    }
  }

  for (const question of values.customQuestions) {
    const found: { questionText?: string; optionLabels?: string } = {};

    if (question.questionText.trim() === '') found.questionText = 'Enter the question text.';
    else if (question.questionText.trim().length > CUSTOM_QUESTION_TEXT_MAX_LENGTH) {
      found.questionText = `Use at most ${CUSTOM_QUESTION_TEXT_MAX_LENGTH} characters.`;
    }

    if (question.type !== 'free_text') {
      const labels = question.optionLabels.map((label) => label.trim()).filter((label) => label !== '');

      if (labels.length < MIN_CUSTOM_OPTIONS) {
        found.optionLabels = `Add at least ${MIN_CUSTOM_OPTIONS} options.`;
      } else if (labels.length > MAX_CUSTOM_OPTIONS) {
        found.optionLabels = `Use at most ${MAX_CUSTOM_OPTIONS} options.`;
      } else if (new Set(labels.map((label) => label.toLowerCase())).size !== labels.length) {
        found.optionLabels = 'Options must be different from each other.';
      } else if (labels.some((label) => label.length > CUSTOM_OPTION_LABEL_MAX_LENGTH)) {
        found.optionLabels = `Each option must be at most ${CUSTOM_OPTION_LABEL_MAX_LENGTH} characters.`;
      }
    }

    if (Object.keys(found).length > 0) errors.questions[question.key] = found;
  }

  return errors;
}

export function hasErrors(errors: PulseFormErrors): boolean {
  return (
    errors.name !== undefined ||
    errors.description !== undefined ||
    errors.opensOn !== undefined ||
    errors.closesOn !== undefined ||
    Object.keys(errors.questions).length > 0
  );
}
