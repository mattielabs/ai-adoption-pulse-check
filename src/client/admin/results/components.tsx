/**
 * Shared dashboard pieces.
 *
 * Charting decision: there is no chart library. Everything on this dashboard
 * is a proportion or a count, and a table with a CSS-width bar in one column
 * communicates that as well as a canvas would while staying readable by
 * assistive technology, selectable, and printable. The bar is decoration on a
 * row that already carries its number; it is never the only representation.
 *
 * Nothing here computes methodology. Components receive values the engine
 * produced and format them.
 */

import { SCORE_BANDS, type ScoreBand } from '../../../core/aggregation/bands.js';
import type { DistributionResult, DimensionResult } from '../../../core/results/contracts.js';
import { bandLabel, formatCount, formatRate, formatScore, labelledOptions, rankedOptions } from './display.js';

export function Card({
  title,
  subtitle,
  children,
  testId,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly testId?: string;
}) {
  const headingId = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={headingId}
      className="mb-5 rounded-lg border border-slate-200 bg-white p-5"
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    >
      <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {subtitle !== undefined && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EmptyState({ children, testId }: { readonly children: React.ReactNode; readonly testId?: string }) {
  return (
    <p
      className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600"
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    >
      {children}
    </p>
  );
}

function Bar({ rate }: { readonly rate: number | null }) {
  // Decoration for a row that already states its number in text.
  return (
    <span aria-hidden="true" className="block h-2 w-full rounded-full bg-slate-100">
      <span
        className="block h-2 rounded-full bg-slate-500"
        style={{ width: `${Math.max(0, Math.min(1, rate ?? 0)) * 100}%` }}
      />
    </span>
  );
}

interface FrequencyTableProps {
  readonly caption: string;
  readonly distribution: DistributionResult;
  /** Rank by frequency rather than keeping the survey's option order. */
  readonly ranked?: boolean;
  readonly limit?: number;
  readonly emptyMessage: string;
  readonly testId?: string;
}

/**
 * A distribution as a real table. Percentages are of respondents who answered
 * the question; for multi-selects they deliberately do not sum to 100.
 */
export function FrequencyTable({
  caption,
  distribution,
  ranked = false,
  limit,
  emptyMessage,
  testId,
}: FrequencyTableProps) {
  const rows = ranked ? rankedOptions(distribution, limit) : labelledOptions(distribution);
  const visible = rows.filter((row) => ranked || row.count > 0);

  if (visible.length === 0) {
    return (
      <EmptyState {...(testId === undefined ? {} : { testId })}>{emptyMessage}</EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto" {...(testId === undefined ? {} : { 'data-testid': testId })}>
      <table className="w-full min-w-80 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Response
            </th>
            <th scope="col" className="w-24 py-2 pr-3 text-right font-semibold">
              Count
            </th>
            <th scope="col" className="w-40 py-2 text-right font-semibold">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.optionId} className="border-b border-slate-100 last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-800">
                {row.label}
              </th>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{row.count}</td>
              <td className="py-2 text-right">
                <span className="flex items-center justify-end gap-2">
                  <span className="w-16 shrink-0 tabular-nums text-slate-700">
                    {formatRate(row.rate)}
                  </span>
                  <span className="w-20 shrink-0">
                    <Bar rate={row.rate} />
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Share of the {formatCount(distribution.answeredCount, 'respondent')} who answered this
        question.
      </p>
    </div>
  );
}

/**
 * Band distribution for one dimension.
 *
 * Presenting only the mean hides the shape: an organization split between Low
 * and Strong averages to Developing and looks unremarkable. Spec 21.
 */
export function BandDistribution({
  distribution,
  scoredCount,
  testId,
}: {
  readonly distribution: Readonly<Record<ScoreBand, number>>;
  readonly scoredCount: number;
  readonly testId?: string;
}) {
  if (scoredCount === 0) {
    return <EmptyState>No respondent could be scored on this dimension.</EmptyState>;
  }

  return (
    <table className="w-full text-sm" {...(testId === undefined ? {} : { 'data-testid': testId })}>
      <caption className="sr-only">Distribution of respondent scores across bands</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th scope="col" className="py-1.5 pr-3 font-semibold">
            Band
          </th>
          <th scope="col" className="w-20 py-1.5 pr-3 text-right font-semibold">
            People
          </th>
          <th scope="col" className="w-36 py-1.5 text-right font-semibold">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {SCORE_BANDS.map((band) => {
          const count = distribution[band];
          const rate = scoredCount === 0 ? null : count / scoredCount;
          return (
            <tr key={band} className="border-b border-slate-100 last:border-b-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-800">
                {bandLabel(band)}
              </th>
              <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{count}</td>
              <td className="py-1.5 text-right">
                <span className="flex items-center justify-end gap-2">
                  <span className="w-12 shrink-0 tabular-nums text-slate-700">
                    {formatRate(rate)}
                  </span>
                  <span className="w-20 shrink-0">
                    <Bar rate={rate} />
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Mean, median, band, coverage and the Unsure rate, in one block. */
export function DimensionSummary({
  result,
  meaning,
  limit,
  testId,
}: {
  readonly result: DimensionResult;
  readonly meaning: string;
  readonly limit?: string | null;
  readonly testId?: string;
}) {
  return (
    <div {...(testId === undefined ? {} : { 'data-testid': testId })}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-semibold tabular-nums text-slate-900" data-testid={`score-${result.dimension}`}>
          {formatScore(result.mean)}
        </p>
        <p
          data-testid={`band-${result.dimension}`}
          className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
        >
          {bandLabel(result.band)}
        </p>
        <p className="text-sm text-slate-600">
          Median {formatScore(result.median)}
        </p>
      </div>

      <p className="mt-2 text-sm text-slate-700">{meaning}</p>
      {limit !== undefined && limit !== null && (
        <p className="mt-1 text-sm text-slate-600">{limit}</p>
      )}

      <p className="mt-2 text-xs text-slate-500" data-testid={`coverage-${result.dimension}`}>
        {result.scoredCount} of {result.scoredCount + result.notAssessedCount} respondents scored
        {result.notAssessedCount > 0 && `, ${result.notAssessedCount} not assessed`}
        {result.unsureRate !== null && (
          <>
            {' · '}
            <span data-testid={`unsure-${result.dimension}`}>
              {formatRate(result.unsureRate)} selected Unsure or unclear responses
            </span>
            {result.unsureRateBasis !== null && ` (${result.unsureRateBasis})`}
          </>
        )}
      </p>
    </div>
  );
}

export function LabelledValue({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className="text-sm font-semibold tabular-nums text-slate-900"
        {...(testId === undefined ? {} : { 'data-testid': testId })}
      >
        {value}
      </span>
    </div>
  );
}
