/**
 * Recommendation cards.
 *
 * Everything on a card came from the engine. "What we found" is the list of
 * conditions that actually fired, each with the measured value beside the
 * threshold it was compared against; the evidence list is the engine's own.
 * Nothing is generated, summarised, or rephrased here, and no rule is
 * re-evaluated - the server already ranked, merged and deduplicated, and the
 * client renders that decision. Spec 24, 27, 28.
 */

import type { RecommendationCard as Card } from '../../core/results/contracts.js';
import { comparatorCopy, formatEvidence, formatScore } from './display.js';
import { EmptyState } from './components.js';

const PRIORITY_STYLES: Readonly<Record<number, string>> = {
  1: 'border-red-300 bg-red-50 text-red-900',
  2: 'border-amber-300 bg-amber-50 text-amber-900',
  3: 'border-sky-300 bg-sky-50 text-sky-900',
  4: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

function EvidenceList({ items }: { readonly items: Card['evidence'] }) {
  const measured = items.filter((item) => item.value !== null);
  if (measured.length === 0) return null;

  return (
    <ul className="mt-1 space-y-1">
      {measured.map((item) => (
        <li key={item.metric} className="flex flex-wrap justify-between gap-x-4 text-sm">
          <span className="text-slate-700">{item.label}</span>
          <span className="tabular-nums font-medium text-slate-900">
            {formatEvidence(item)}
            {item.threshold !== undefined && (
              <span className="ml-1 font-normal text-slate-500">
                (threshold {formatScore(item.threshold)})
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecommendationCard({ card, index }: { readonly card: Card; readonly index: number }) {
  return (
    <article
      data-testid={`recommendation-${card.id}`}
      aria-labelledby={`rec-${card.id}-title`}
      className="mb-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Priority is stated in words, not conveyed by the colour alone. */}
        <span
          data-testid={`recommendation-${card.id}-priority`}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[card.priority] ?? ''}`}
        >
          Priority {card.priority} &middot; {card.priorityLabel}
        </span>
        {card.confidenceLabelCopy !== null && (
          <span
            data-testid={`recommendation-${card.id}-confidence`}
            className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
          >
            {card.confidenceLabelCopy}
          </span>
        )}
      </div>

      <h3 id={`rec-${card.id}-title`} className="mt-2 text-base font-semibold text-slate-900">
        {index}. {card.title}
      </h3>
      <p className="mt-1 text-xs text-slate-500">{card.priorityMeaning}</p>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        What we found
      </h4>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {card.whatWeFound.map((finding) => (
          <li key={finding.id}>
            {finding.description}
            {finding.actual !== null && (
              <span className="text-slate-900">
                {' '}
                &mdash; measured {formatScore(finding.actual)}, {comparatorCopy(finding.comparator)}{' '}
                {formatScore(finding.threshold)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Why it matters
      </h4>
      <p className="mt-1 text-sm text-slate-700">{card.whyItMatters}</p>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recommended action
      </h4>
      <p className="mt-1 text-sm text-slate-700">{card.recommendedAction}</p>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</h4>
      <EvidenceList items={card.evidence} />

      {card.mergedFindings.length > 0 && (
        <div
          data-testid={`recommendation-${card.id}-merged`}
          className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Also folded into this priority
          </h4>
          {card.mergedFindings.map((finding) => (
            <div key={finding.sourceId} className="mt-1">
              <p className="text-sm text-slate-700">{finding.summary}</p>
              <EvidenceList items={finding.evidence} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function RecommendationList({
  cards,
  emptyMessage,
  testId,
}: {
  readonly cards: readonly Card[];
  readonly emptyMessage: string;
  readonly testId?: string;
}) {
  if (cards.length === 0) {
    return <EmptyState {...(testId === undefined ? {} : { testId })}>{emptyMessage}</EmptyState>;
  }

  return (
    <div {...(testId === undefined ? {} : { 'data-testid': testId })}>
      {cards.map((card, index) => (
        <RecommendationCard key={card.id} card={card} index={index + 1} />
      ))}
    </div>
  );
}
