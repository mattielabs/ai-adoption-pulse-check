/**
 * The Opportunity Map.
 *
 * Two things this view is careful about:
 *
 *   1. The denominator. "AI use" for a workflow is measured among the people
 *      who reported THAT workflow as painful, never against a global usage
 *      percentage - that is what makes the comparison exact by construction,
 *      and the column header says so. Spec 30.
 *
 *   2. What a status does not mean. Explore and Standardize point at where a
 *      conversation is worth having. They are not automation-readiness, ROI,
 *      or a feasibility judgement, and the copy says that rather than letting
 *      a green chip imply it. Spec 31.
 *
 * Guardrail is one organization-wide banner driven by the Safety score, never
 * a per-row label. Enable and Scale were removed in V1.1 and do not exist.
 */

import { useOutletContext } from 'react-router-dom';
import {
  OPPORTUNITY_LABEL_COPY,
  type OpportunityLabel,
} from '../../core/opportunities/analyze.js';
import type { OpportunityRowResult } from '../../core/results/contracts.js';
import type { ResultsOutletContext } from './ResultsLayout.js';
import { Card, EmptyState } from './components.js';
import { formatCount, formatRate } from './display.js';

const STATUS_STYLES: Readonly<Record<OpportunityLabel, string>> = {
  explore: 'border-sky-300 bg-sky-50 text-sky-900',
  standardize: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

function StatusChip({ status }: { readonly status: OpportunityLabel | null }) {
  if (status === null) {
    return <span className="text-xs text-slate-500">Below threshold</span>;
  }
  return (
    <span
      data-testid={`opportunity-status-${status}`}
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {OPPORTUNITY_LABEL_COPY[status].title}
    </span>
  );
}

function OpportunityDetail({ row }: { readonly row: OpportunityRowResult }) {
  if (row.status === null) return null;
  const copy = OPPORTUNITY_LABEL_COPY[row.status];

  return (
    <details
      data-testid={`opportunity-detail-${row.categoryId}`}
      className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <summary className="cursor-pointer text-sm font-medium text-slate-800">
        What this means, and what to do next
      </summary>
      <p className="mt-2 text-sm text-slate-700">{copy.meaning}</p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold">Suggested next step: </span>
        {copy.action}
      </p>
      <dl className="mt-3 text-sm text-slate-700">
        <div className="flex justify-between gap-4 border-b border-slate-200 py-1">
          <dt>Reported this workflow as time-consuming</dt>
          <dd className="tabular-nums">
            {row.painCount} ({formatRate(row.painRate)})
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt>Of those, already using AI for it</dt>
          <dd className="tabular-nums">
            {row.aiUseAmongPainCount} ({formatRate(row.aiUseAmongPainRate)})
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        This identifies where deeper discovery may be worthwhile. It does not establish automation
        feasibility, time savings, or return on investment.
      </p>
    </details>
  );
}

export function OpportunitiesTab() {
  const { results } = useOutletContext<ResultsOutletContext>();
  const { opportunities } = results;
  const labelled = opportunities.rows.filter((row) => row.status !== null);

  return (
    <div>
      {opportunities.guardrail.active && (
        <p
          role="status"
          data-testid="guardrail-banner"
          className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
        >
          {opportunities.guardrail.message}
        </p>
      )}

      <Card
        title="Opportunity Map"
        subtitle="Only the workflow categories shared by Q7 and Q26, so reported pain and current AI use describe the same thing."
        testId="opportunity-map"
      >
        {labelled.length === 0 ? (
          <EmptyState testId="no-opportunities">
            No workflow currently meets the V1 Explore or Standardize threshold.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                Workflow pain and current AI use among the people reporting that pain
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Workflow
                  </th>
                  <th scope="col" className="w-28 py-2 pr-3 text-right font-semibold">
                    Reported pain
                  </th>
                  <th scope="col" className="w-40 py-2 pr-3 text-right font-semibold">
                    AI use within that group
                  </th>
                  <th scope="col" className="w-32 py-2 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {opportunities.rows.map((row) => (
                  <tr
                    key={row.categoryId}
                    data-testid={`opportunity-row-${row.categoryId}`}
                    className="border-b border-slate-100 last:border-b-0 align-top"
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-800">
                      {row.label}
                      <OpportunityDetail row={row} />
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {formatRate(row.painRate)}
                      <span className="block text-xs text-slate-500">{row.painCount} people</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {formatRate(row.aiUseAmongPainRate)}
                      <span className="block text-xs text-slate-500">
                        {row.aiUseAmongPainCount} of {row.painCount}
                      </span>
                    </td>
                    <td className="py-2">
                      <StatusChip status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Reported pain is a share of the {formatCount(opportunities.denominator, 'respondent')} who
          answered the workflow question. AI use is measured only among the people who reported that
          same workflow as time-consuming.
        </p>
      </Card>
    </div>
  );
}
