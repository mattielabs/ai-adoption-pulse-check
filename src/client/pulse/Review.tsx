/**
 * Final review before submission.
 *
 * Shows per-section completion, lets the employee jump back, repeats the
 * sensitive-information reminder, and states that submission is final for
 * this browser session. It deliberately does not echo full answers back
 * (free text in particular) and shows no scoring internals. Phase 1 brief 17.
 */

import { useEffect, useRef } from 'react';
import type { AnswerMap, RenderableSection } from '../lib/sections.js';
import { questionError } from '../lib/sections.js';
import type { SubmitFailureKind } from '../lib/api.js';

interface Props {
  readonly sections: readonly RenderableSection[];
  readonly answers: AnswerMap;
  readonly submitting: boolean;
  readonly submitError: SubmitFailureKind | null;
  readonly onEditSection: (index: number) => void;
  readonly onSubmit: () => void;
}

const SUBMIT_ERROR_COPY: Readonly<Record<SubmitFailureKind, string>> = {
  closed:
    'This Pulse Check stopped accepting responses while you were completing it. Your answers are still saved on this browser, but they can no longer be submitted.',
  not_yet_open: 'This Pulse Check is not accepting responses yet.',
  not_found: 'This Pulse Check link is no longer available.',
  version_mismatch:
    'This survey was updated since you loaded the page. Reload the page to continue - your answers on this browser are kept where compatible.',
  validation:
    'Some answers could not be accepted by the server. Go back through the sections, check your answers, and try again.',
  network:
    'Could not reach the server. Your answers are still saved on this browser - check your connection and try again.',
  server:
    'Something went wrong on the server. Your answers are still saved on this browser - please try again.',
};

function answeredCount(section: RenderableSection, answers: AnswerMap): number {
  return section.questions.filter((q) => {
    const value = answers[q.key];
    if (value === undefined) return false;
    return typeof value === 'string' ? value.trim().length > 0 : value.length > 0;
  }).length;
}

export function Review({ sections, answers, submitting, submitError, onEditSection, onSubmit }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const incomplete = sections
    .map((section, index) => ({
      index,
      title: section.title,
      missing: section.questions.filter((q) => questionError(q, answers[q.key]) !== null).length,
    }))
    .filter((entry) => entry.missing > 0);

  const canSubmit = incomplete.length === 0 && !submitting;

  return (
    <div>
      <header className="mb-5">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-slate-900 outline-none">
          Review your answers
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Check each section, then submit. Submission is final for this browser session.
        </p>
      </header>

      {incomplete.length > 0 && (
        <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {incomplete.length === 1 ? 'One section still has' : 'Some sections still have'} required
          questions to answer.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sections.map((section, index) => {
          const answered = answeredCount(section, answers);
          const missing = incomplete.find((entry) => entry.index === index)?.missing ?? 0;
          return (
            <li
              key={section.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{section.title}</p>
                <p className="text-sm text-slate-600">
                  {answered} of {section.questions.length} answered
                  {missing > 0 && <span className="font-medium text-red-700"> &middot; {missing} required missing</span>}
                </p>
              </div>
              <button
                type="button"
                data-testid={`edit-section-${index}`}
                onClick={() => onEditSection(index)}
                className="min-h-11 shrink-0 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
              >
                Edit<span className="sr-only"> {section.title}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Reminder: please make sure your written answers do not include confidential, personal,
        customer, or sensitive company information.
      </p>

      {submitError !== null && (
        <p role="alert" data-testid="submit-error" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {SUBMIT_ERROR_COPY[submitError]}
        </p>
      )}

      <button
        type="button"
        data-testid="submit-response"
        onClick={onSubmit}
        disabled={!canSubmit}
        aria-busy={submitting}
        className="mt-6 min-h-12 w-full rounded-lg px-6 text-base font-semibold disabled:opacity-50 sm:w-auto"
        style={{ backgroundColor: 'var(--pc-accent)', color: 'var(--pc-accent-text)' }}
      >
        {submitting ? 'Submitting…' : 'Submit response'}
      </button>
    </div>
  );
}
