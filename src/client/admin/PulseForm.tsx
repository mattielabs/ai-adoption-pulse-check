/**
 * The single Pulse form: creation, duplication prefill, and pre-response
 * editing all use it.
 *
 * Fields the server has locked are shown as read-only values with the reason,
 * rather than hidden. An administrator should be able to see the configuration
 * a Pulse is running under and understand why it can no longer change - and
 * removing the control is a UI courtesy, not the enforcement (see
 * routes/adminPulses.ts).
 */

import { useState } from 'react';
import type { LockedPulseField } from '../../core/admin/contracts.js';
import { MAX_CUSTOM_QUESTIONS } from '../../core/survey/answers.js';
import {
  CUSTOM_OPTION_LABEL_MAX_LENGTH,
  CUSTOM_QUESTION_TEXT_MAX_LENGTH,
  MAX_CUSTOM_OPTIONS,
  PULSE_DESCRIPTION_MAX_LENGTH,
  PULSE_NAME_MAX_LENGTH,
} from '../../core/admin/schemas.js';
import { CUSTOM_QUESTION_TYPES, type CustomQuestionType } from '../../core/survey/customQuestions.js';
import { SURVEY_QUESTIONS } from '../../core/survey/questions.js';
import { formatCalendarDay } from '../../core/pulse/day.js';
import type { ApiError } from '../lib/adminApi.js';
import {
  blankQuestion,
  QUESTION_TYPE_LABELS,
  type CustomQuestionDraft,
  type PulseFormValues,
} from './pulseFormValues.js';
import { hasErrors, NO_ERRORS, validatePulseForm, type PulseFormErrors } from './pulseFormValidation.js';
import { CheckboxField, ErrorAlert, Field, TextAreaField, TextField } from './ui.js';
import { BUTTON_STYLES } from './uiTokens.js';

const CORE_QUESTION_NOTE =
  'The validated core Pulse Check questions are fixed in V1. Custom questions are added separately and do not affect scoring.';

interface Props {
  readonly initial: PulseFormValues;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly serverError: ApiError | null;
  readonly lockedFields: readonly LockedPulseField[];
  readonly onSubmit: (values: PulseFormValues) => void;
  readonly onCancel: () => void;
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <fieldset className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function LockedValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{value}</p>
    </div>
  );
}

export function PulseForm({
  initial,
  submitLabel,
  pending,
  serverError,
  lockedFields,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<PulseFormValues>(initial);
  const [errors, setErrors] = useState<PulseFormErrors>(NO_ERRORS);
  const [showErrors, setShowErrors] = useState(false);

  const locked = (field: LockedPulseField): boolean => lockedFields.includes(field);

  function update(patch: Partial<PulseFormValues>): void {
    setValues((current) => ({ ...current, ...patch }));
  }

  function updateQuestion(key: string, patch: Partial<CustomQuestionDraft>): void {
    setValues((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((question) =>
        question.key === key ? { ...question, ...patch } : question,
      ),
    }));
  }

  function changeType(key: string, type: CustomQuestionType): void {
    updateQuestion(key, {
      type,
      optionLabels: type === 'free_text' ? [] : ['', ''],
    });
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (pending) return;

    const found = validatePulseForm(values);
    setErrors(found);
    setShowErrors(true);
    if (hasErrors(found)) return;

    onSubmit(values);
  }

  const questionErrors = (key: string) => (showErrors ? errors.questions[key] : undefined);
  const fieldError = (message: string | undefined) => (showErrors ? message : undefined);

  return (
    <form onSubmit={submit} noValidate>
      {serverError !== null && (
        <ErrorAlert testId="pulse-form-error">
          {serverError.kind === 'conflict' && serverError.code === 'pulse_configuration_locked'
            ? 'This Pulse already has responses, so that setting can no longer change. Duplicate it instead.'
            : serverError.kind === 'conflict' && serverError.code === 'organization_not_configured'
              ? 'Set up your organization before creating a Pulse.'
              : 'That could not be saved. Check the fields and try again.'}
        </ErrorAlert>
      )}

      {showErrors && hasErrors(errors) && (
        <ErrorAlert testId="pulse-form-invalid">Check the highlighted fields and try again.</ErrorAlert>
      )}

      <Section title="Pulse details">
        <TextField
          label="Pulse name"
          value={values.name}
          onChange={(name) => update({ name })}
          required
          maxLength={PULSE_NAME_MAX_LENGTH}
          error={fieldError(errors.name)}
          help="Employees see this at the top of the survey."
          testId="pulse-name"
        />
        <TextAreaField
          label="Description"
          value={values.description}
          onChange={(description) => update({ description })}
          maxLength={PULSE_DESCRIPTION_MAX_LENGTH}
          error={fieldError(errors.description)}
          help="Optional. A sentence explaining why you are running this Pulse."
          testId="pulse-description"
        />
      </Section>

      <Section title="Collection dates">
        {locked('opensOn') ? (
          <LockedValue
            label="Opens on"
            value={values.opensOn === '' ? 'Not set' : formatCalendarDay(values.opensOn)}
          />
        ) : (
          <TextField
            label="Opens on"
            type="date"
            value={values.opensOn}
            onChange={(opensOn) => update({ opensOn })}
            required
            error={fieldError(errors.opensOn)}
            help="The Pulse accepts responses from this day. Dates are calendar days in UTC."
            testId="pulse-opens-on"
          />
        )}

        <TextField
          label="Closes on"
          type="date"
          value={values.closesOn}
          onChange={(closesOn) => update({ closesOn })}
          error={fieldError(errors.closesOn)}
          help="Optional. The last day responses are accepted. Leave empty to close it yourself."
          testId="pulse-closes-on"
        />
      </Section>

      <Section title="Employee result">
        {locked('personalResultsEnabled') ? (
          <LockedValue
            label="Personal result"
            value={
              values.personalResultsEnabled
                ? 'Employees see their own result after submitting.'
                : 'Employees see a confirmation only.'
            }
          />
        ) : (
          <CheckboxField
            label="Show each employee their own result"
            checked={values.personalResultsEnabled}
            onChange={(personalResultsEnabled) => update({ personalResultsEnabled })}
            help="Calculated in the employee's browser from their own answers. Individual results are never sent to you."
            testId="pulse-personal-results"
          />
        )}
      </Section>

      <Section title="Custom questions">
        <p className="mb-4 text-sm text-slate-600">{CORE_QUESTION_NOTE}</p>

        {locked('customQuestions') ? (
          <LockedValue
            label="Custom questions"
            value={
              values.customQuestions.length === 0
                ? 'None'
                : values.customQuestions.map((question) => question.questionText).join(' · ')
            }
          />
        ) : (
          <>
            {values.customQuestions.map((question, index) => (
              <div
                key={question.key}
                data-testid={`custom-question-${index + 1}`}
                className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Question {index + 1}</p>
                  <button
                    type="button"
                    data-testid={`remove-question-${index + 1}`}
                    className="min-h-11 text-sm font-medium text-red-700 underline underline-offset-2"
                    onClick={() =>
                      update({
                        customQuestions: values.customQuestions.filter((q) => q.key !== question.key),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>

                <Field label="Answer type">
                  {({ id, describedBy }) => (
                    <select
                      id={id}
                      value={question.type}
                      aria-describedby={describedBy}
                      data-testid={`question-type-${index + 1}`}
                      onChange={(event) => changeType(question.key, event.target.value as CustomQuestionType)}
                      className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {CUSTOM_QUESTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {QUESTION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <TextField
                  label="Question"
                  value={question.questionText}
                  onChange={(questionText) => updateQuestion(question.key, { questionText })}
                  required
                  maxLength={CUSTOM_QUESTION_TEXT_MAX_LENGTH}
                  error={questionErrors(question.key)?.questionText}
                  testId={`question-text-${index + 1}`}
                />

                {question.type !== 'free_text' && (
                  <Field
                    label="Options"
                    help="At least two. Employees pick from these; the stored value is generated from the text."
                    error={questionErrors(question.key)?.optionLabels}
                  >
                    {({ describedBy, invalid }) => (
                      <div aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                        {question.optionLabels.map((label, optionIndex) => (
                          <div key={optionIndex} className="mb-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={label}
                              maxLength={CUSTOM_OPTION_LABEL_MAX_LENGTH}
                              aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                              data-testid={`question-${index + 1}-option-${optionIndex + 1}`}
                              onChange={(event) =>
                                updateQuestion(question.key, {
                                  optionLabels: question.optionLabels.map((current, i) =>
                                    i === optionIndex ? event.target.value : current,
                                  ),
                                })
                              }
                              className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              aria-label={`Remove question ${index + 1} option ${optionIndex + 1}`}
                              className="min-h-11 px-2 text-sm font-medium text-slate-600 underline underline-offset-2"
                              onClick={() =>
                                updateQuestion(question.key, {
                                  optionLabels: question.optionLabels.filter((_, i) => i !== optionIndex),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          data-testid={`add-option-${index + 1}`}
                          disabled={question.optionLabels.length >= MAX_CUSTOM_OPTIONS}
                          className={BUTTON_STYLES.secondary}
                          onClick={() =>
                            updateQuestion(question.key, {
                              optionLabels: [...question.optionLabels, ''],
                            })
                          }
                        >
                          Add option
                        </button>
                      </div>
                    )}
                  </Field>
                )}
              </div>
            ))}

            <button
              type="button"
              data-testid="add-custom-question"
              disabled={values.customQuestions.length >= MAX_CUSTOM_QUESTIONS}
              className={BUTTON_STYLES.secondary}
              onClick={() =>
                update({ customQuestions: [...values.customQuestions, blankQuestion()] })
              }
            >
              Add a custom question
            </button>
            <p className="mt-2 text-xs text-slate-500">
              {values.customQuestions.length} of {MAX_CUSTOM_QUESTIONS} used. All custom questions are
              optional for employees.
            </p>
          </>
        )}
      </Section>

      <Section title="Review">
        <dl data-testid="pulse-review" className="text-sm text-slate-700">
          <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="font-medium text-slate-900">Survey</dt>
            <dd>{SURVEY_QUESTIONS.length} core questions, about 7&ndash;10 minutes</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="font-medium text-slate-900">Custom questions</dt>
            <dd data-testid="review-custom-count">{values.customQuestions.length}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="font-medium text-slate-900">Opens</dt>
            <dd>{values.opensOn === '' ? 'Not set' : formatCalendarDay(values.opensOn)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
            <dt className="font-medium text-slate-900">Closes</dt>
            <dd>{values.closesOn === '' ? 'When you close it' : formatCalendarDay(values.closesOn)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="font-medium text-slate-900">Employee result</dt>
            <dd>{values.personalResultsEnabled ? 'Shown' : 'Hidden'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Employees are told the survey collects no name, email or employee ID, and that reporting is
          limited to groups meeting the minimum size.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" data-testid="save-pulse" disabled={pending} className={BUTTON_STYLES.primary}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className={BUTTON_STYLES.secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
