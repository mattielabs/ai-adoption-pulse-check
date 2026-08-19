/**
 * One survey section: progress, the section's questions, and navigation.
 *
 * Progress is plain "Section N of M" plus a bar - no gamification, no score
 * hints during completion. Phase 1 brief 12-13.
 */

import { useEffect, useRef } from 'react';
import type { AnswerMap, RenderableSection } from '../lib/sections.js';
import { QuestionField } from './QuestionField.js';

interface Props {
  readonly section: RenderableSection;
  readonly sectionIndex: number;
  readonly sectionCount: number;
  readonly answers: AnswerMap;
  readonly errors: Readonly<Record<string, string>>;
  readonly restoredNotice: boolean;
  readonly returnToReview: boolean;
  readonly onAnswer: (key: string, value: string | readonly string[]) => void;
  readonly onPrevious: () => void;
  readonly onContinue: () => void;
}

export function SurveySection({
  section,
  sectionIndex,
  sectionCount,
  answers,
  errors,
  restoredNotice,
  returnToReview,
  onAnswer,
  onPrevious,
  onContinue,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the section heading whenever the section changes so
  // keyboard and screen-reader users land at the top of the new content.
  useEffect(() => {
    headingRef.current?.focus();
  }, [section.id]);

  const errorCount = Object.keys(errors).length;
  const percent = Math.round(((sectionIndex + 1) / sectionCount) * 100);

  return (
    <div>
      {restoredNotice && (
        <p
          role="status"
          data-testid="draft-restored"
          className="mb-4 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          Your earlier answers were restored from this browser.
        </p>
      )}

      <header className="mb-5">
        <p className="text-sm font-medium text-slate-600" data-testid="progress-label">
          Section {sectionIndex + 1} of {sectionCount}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-semibold text-slate-900 outline-none">
          {section.title}
        </h2>
        <div
          role="progressbar"
          aria-label="Survey progress"
          aria-valuemin={0}
          aria-valuemax={sectionCount}
          aria-valuenow={sectionIndex + 1}
          aria-valuetext={`Section ${sectionIndex + 1} of ${sectionCount}`}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full motion-safe:transition-[width]"
            style={{ width: `${percent}%`, backgroundColor: 'var(--pc-accent)' }}
          />
        </div>
      </header>

      <div aria-live="polite" className="sr-only">
        {errorCount > 0
          ? `${errorCount} ${errorCount === 1 ? 'question needs' : 'questions need'} attention before you can continue.`
          : ''}
      </div>

      {errorCount > 0 && (
        <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Please answer the highlighted {errorCount === 1 ? 'question' : 'questions'} to continue.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {section.questions.map((question) => (
          <QuestionField
            key={question.key}
            question={question}
            value={answers[question.key]}
            error={errors[question.key] ?? null}
            onChange={onAnswer}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="previous-section"
          onClick={onPrevious}
          disabled={sectionIndex === 0}
          className="min-h-12 rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-700 disabled:invisible"
        >
          Previous
        </button>
        <button
          type="button"
          data-testid="continue-section"
          onClick={onContinue}
          className="min-h-12 rounded-lg px-6 text-sm font-semibold"
          style={{ backgroundColor: 'var(--pc-accent)', color: 'var(--pc-accent-text)' }}
        >
          {returnToReview
            ? 'Back to review'
            : sectionIndex === sectionCount - 1
              ? 'Review answers'
              : 'Continue'}
        </button>
      </div>
    </div>
  );
}
