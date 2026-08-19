/**
 * The employee's local personal result.
 *
 * Methodology honesty is part of the interface: Confidence and Safety are
 * labelled self-reported, Enablement appears as "Organization Support
 * Experience" (never personal ability), and there are no comparisons with
 * coworkers, no percentiles, and no champion claims. Scores show one decimal
 * so the display never contradicts the engine's raw-score thresholds.
 * Spec 36, Phase 1 brief 20-24.
 */

import type { PersonalResultData } from '../lib/personalResult.js';
import { formatScore } from '../lib/format.js';

interface Props {
  readonly result: PersonalResultData;
  /** True when shown directly after submission (vs. a revisit). */
  readonly justSubmitted: boolean;
  /** Removes the browser-local copy of this result. */
  readonly onClearResult: () => void;
}

interface ScoreRowSpec {
  readonly key: keyof PersonalResultData['scores'];
  readonly label: string;
  readonly meaning: string;
}

const SCORE_ROWS: readonly ScoreRowSpec[] = [
  { key: 'adoption', label: 'Adoption', meaning: 'How often and how broadly you use AI for work.' },
  {
    key: 'confidence',
    label: 'Confidence',
    meaning: 'Your self-reported confidence using and evaluating AI.',
  },
  {
    key: 'workflow',
    label: 'Workflow',
    meaning: 'How far your AI use has moved from one-off tasks toward repeatable processes.',
  },
  {
    key: 'safety',
    label: 'Safety',
    meaning: 'Your self-reported verification, review, and data-handling awareness.',
  },
  {
    key: 'enablement',
    label: 'Organization Support Experience',
    meaning: 'Based on your answers about approved tools, guidance, access, and training.',
  },
];

export function Result({ result, justSubmitted, onClearResult }: Props) {
  return (
    <div>
      <header className="mb-5">
        {justSubmitted && (
          <p role="status" data-testid="submission-confirmed" className="mb-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
            Your response was submitted. Thank you for taking part.
          </p>
        )}
        <h2 className="text-xl font-semibold text-slate-900">Your personal result</h2>
        <p className="mt-1 text-sm text-slate-600">
          Calculated on your device from your own answers. Your individual scores are not sent to or
          stored by your organization.
        </p>
      </header>

      {result.classificationLabel !== null && (
        <section aria-labelledby="profile-heading" className="mb-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h3 id="profile-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Your usage profile
          </h3>
          <p data-testid="result-classification" className="mt-1 text-lg font-semibold text-slate-900">
            {result.classificationLabel}
          </p>
          <p className="mt-1 text-sm text-slate-600">Based on how you described your current AI use.</p>
        </section>
      )}

      <section aria-labelledby="scores-heading" className="mb-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 id="scores-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your scores
        </h3>
        <dl className="mt-2 divide-y divide-slate-100">
          {SCORE_ROWS.map((row) => {
            const value = result.scores[row.key];
            return (
              <div key={row.key} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <dt className="text-sm font-medium text-slate-900">{row.label}</dt>
                  <dd className="mt-0.5 text-sm text-slate-600">{row.meaning}</dd>
                </div>
                <p
                  data-testid={`score-${row.key}`}
                  className="shrink-0 text-lg font-semibold tabular-nums text-slate-900"
                >
                  {value === null ? (
                    <span className="text-sm font-normal text-slate-500">Not enough information</span>
                  ) : (
                    formatScore(value)
                  )}
                </p>
              </div>
            );
          })}
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          Scores are directional self-report on a 0&ndash;100 scale, not a measure of skill or verified behaviour.
        </p>
      </section>

      <section aria-labelledby="focus-heading" className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 id="focus-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Primary focus
        </h3>
        <p data-testid="focus-primary" className="mt-1 text-base font-semibold text-slate-900">
          {result.focus.primary}
        </p>
        <h4 className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Suggested next step</h4>
        <p data-testid="focus-next-step" className="mt-1 text-sm text-slate-700">
          {result.focus.nextStep}
        </p>
      </section>

      <section
        aria-labelledby="storage-heading"
        className="mt-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
      >
        <h3 id="storage-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          This device
        </h3>
        <p className="mt-1 text-sm text-slate-700">
          This result is stored only on this browser. Clear it if you use a shared device.
        </p>
        <button
          type="button"
          data-testid="clear-my-result"
          onClick={onClearResult}
          className="mt-3 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          Clear my result from this browser
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Your submitted response stays with your organization &mdash; clearing this only removes the
          local copy, and does not let you take the survey again.
        </p>
      </section>

      <p className="mt-8 text-xs text-slate-400">
        AI Adoption Pulse Check &mdash; open-source project by Mattie Labs
      </p>
    </div>
  );
}
