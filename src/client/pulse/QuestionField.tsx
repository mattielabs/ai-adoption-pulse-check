/**
 * One survey question, rendered from the canonical schema.
 *
 * Accessibility structure: each question is a fieldset with the prompt as its
 * legend; helper text and error text are separate elements referenced via
 * aria-describedby; every control has an associated label; errors never rely
 * on colour alone.
 */

import type { RenderableQuestion } from '../lib/sections.js';

interface Props {
  readonly question: RenderableQuestion;
  readonly value: string | readonly string[] | undefined;
  readonly error: string | null;
  readonly onChange: (key: string, value: string | readonly string[]) => void;
}

export function QuestionField({ question, value, error, onChange }: Props) {
  const helperId = `${question.key}-helper`;
  const errorId = `${question.key}-error`;
  const describedBy =
    [question.helperText !== null ? helperId : null, error !== null ? errorId : null]
      .filter((id): id is string => id !== null)
      .join(' ') || undefined;

  return (
    <fieldset
      id={`question-${question.key}`}
      data-testid={`question-${question.key}`}
      tabIndex={-1}
      aria-describedby={describedBy}
      className={`rounded-lg border bg-white p-4 sm:p-5 outline-none ${
        error !== null ? 'border-red-400' : 'border-slate-200'
      }`}
    >
      <legend className="text-base font-medium text-slate-900">
        {question.prompt}
        {!question.required && <span className="ml-2 text-sm font-normal text-slate-500">(Optional)</span>}
      </legend>

      {question.helperText !== null && (
        <p id={helperId} className="mt-1 text-sm text-slate-600">
          {question.helperText}
        </p>
      )}

      {error !== null && (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3">
        {question.type === 'single_select' && (
          <SingleSelect question={question} value={typeof value === 'string' ? value : ''} onChange={onChange} />
        )}
        {question.type === 'multi_select' && (
          <MultiSelect question={question} value={Array.isArray(value) ? value : []} onChange={onChange} />
        )}
        {question.type === 'free_text' && (
          <FreeText question={question} value={typeof value === 'string' ? value : ''} onChange={onChange} />
        )}
      </div>
    </fieldset>
  );
}

function SingleSelect({
  question,
  value,
  onChange,
}: {
  readonly question: RenderableQuestion;
  readonly value: string;
  readonly onChange: Props['onChange'];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(question.options ?? []).map((option) => {
        const inputId = `${question.key}-${option.id}`;
        const checked = value === option.id;
        return (
          <label
            key={option.id}
            htmlFor={inputId}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
              checked ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              id={inputId}
              name={question.key}
              value={option.id}
              checked={checked}
              onChange={() => onChange(question.key, option.id)}
              className="h-4 w-4 shrink-0"
              style={{ accentColor: 'var(--pc-accent)' }}
            />
            <span className="text-slate-800">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function MultiSelect({
  question,
  value,
  onChange,
}: {
  readonly question: RenderableQuestion;
  readonly value: readonly string[];
  readonly onChange: Props['onChange'];
}) {
  const max = question.maxSelections;
  const atMax = max !== null && value.length >= max;

  const toggle = (optionId: string): void => {
    if (value.includes(optionId)) {
      onChange(question.key, value.filter((v) => v !== optionId));
    } else if (!atMax || max === null) {
      onChange(question.key, [...value, optionId]);
    }
  };

  return (
    <div>
      {max !== null && (
        <p className="mb-2 text-sm text-slate-600" aria-live="polite">
          {value.length} of {max} selected
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {(question.options ?? []).map((option) => {
          const inputId = `${question.key}-${option.id}`;
          const checked = value.includes(option.id);
          const disabled = !checked && atMax;
          return (
            <label
              key={option.id}
              htmlFor={inputId}
              className={`flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                checked
                  ? 'border-slate-500 bg-slate-50'
                  : disabled
                    ? 'cursor-not-allowed border-slate-100 text-slate-400'
                    : 'cursor-pointer border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                id={inputId}
                name={question.key}
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(option.id)}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: 'var(--pc-accent)' }}
              />
              <span className={disabled ? '' : 'text-slate-800'}>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function FreeText({
  question,
  value,
  onChange,
}: {
  readonly question: RenderableQuestion;
  readonly value: string;
  readonly onChange: Props['onChange'];
}) {
  const maxLength = question.maxLength ?? 1000;
  const countId = `${question.key}-count`;
  return (
    <div>
      <label htmlFor={`${question.key}-input`} className="sr-only">
        {question.prompt}
      </label>
      <textarea
        id={`${question.key}-input`}
        name={question.key}
        value={value}
        maxLength={maxLength}
        rows={4}
        aria-describedby={countId}
        onChange={(event) => onChange(question.key, event.target.value)}
        className="w-full rounded-md border border-slate-300 p-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <p id={countId} className="mt-1 text-xs text-slate-500">
        {value.length} of {maxLength} characters
      </p>
    </div>
  );
}
