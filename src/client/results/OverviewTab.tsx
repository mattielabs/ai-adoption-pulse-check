/**
 * The overview.
 *
 * Order is deliberate and follows the brief: context, then the five
 * dimensions, then what to do about them, then the distribution behind the
 * averages, then barriers, training and the opportunity summary. The
 * recommendations sit near the top rather than beneath an analytics wall,
 * because "what should we investigate next" is the question this product
 * exists to answer.
 */

import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { DIMENSIONS } from '../../core/survey/questions.js';
import {
  DIMENSION_LABELS,
  DIMENSION_MEANINGS,
  SAFETY_CAVEAT,
  SELF_REPORT_NOTE,
} from '../../core/results/methodology.js';
import type { ResultsOutletContext } from './ResultsLayout.js';
import { Card, EmptyState, FrequencyTable, LabelledValue } from './components.js';
import { RecommendationList } from './RecommendationCards.js';
import { bandLabel, formatCount, formatRate, formatScore } from './display.js';

export function OverviewTab() {
  const { results } = useOutletContext<ResultsOutletContext>();
  // Inline links carry the active segment for the same reason the tabs do.
  const { search } = useLocation();
  const byDimension = Object.fromEntries(results.dimensions.map((d) => [d.dimension, d]));
  const opportunities = results.opportunities;
  const labelled = opportunities.rows.filter((row) => row.status !== null);

  return (
    <div>
      <Card
        title="The five dimensions"
        subtitle="Reported separately on purpose. One combined score would hide exactly the differences worth seeing."
        testId="dimension-summary"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSIONS.map((dimension) => {
            const result = byDimension[dimension];
            if (result === undefined) return null;
            return (
              <div
                key={dimension}
                data-testid={`dimension-card-${dimension}`}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {DIMENSION_LABELS[dimension]}
                  </h3>
                  <Link
                    to={{ pathname: dimension, search }}
                    className="text-xs font-medium text-slate-600 underline underline-offset-2"
                  >
                    Detail
                  </Link>
                </div>
                <p
                  data-testid={`overview-score-${dimension}`}
                  className="mt-1 text-2xl font-semibold tabular-nums text-slate-900"
                >
                  {formatScore(result.mean)}
                </p>
                <p className="text-xs font-semibold text-slate-600">{bandLabel(result.band)}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Median {formatScore(result.median)} &middot; {result.scoredCount} scored
                </p>
                {result.unsureRate !== null && (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatRate(result.unsureRate)} Unsure / unclear
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-600">{DIMENSION_MEANINGS[dimension]}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">{SELF_REPORT_NOTE}</p>
        <p data-testid="safety-caveat-overview" className="mt-1 text-xs text-slate-500">
          {SAFETY_CAVEAT}
        </p>
      </Card>

      <Card
        title="Top priorities"
        subtitle="Ranked by the deterministic recommendation engine. At most three, deduplicated by family."
        testId="primary-recommendations"
      >
        <RecommendationList
          cards={results.recommendations.primary}
          emptyMessage="No rule fired against these responses. That is a result, not an absence of one."
          testId="primary-recommendation-list"
        />
      </Card>

      {results.recommendations.additional.length > 0 && (
        <Card
          title="Additional signals"
          subtitle="Findings that fired but did not take a primary slot."
          testId="additional-recommendations"
        >
          <RecommendationList
            cards={results.recommendations.additional}
            emptyMessage="No additional signals."
            testId="additional-recommendation-list"
          />
        </Card>
      )}

      <Card
        title="Behaviour classification"
        subtitle="How respondents describe their current AI use. Counts only - no respondent is identified."
        testId="classification-distribution"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Respondents by behaviour classification</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Classification
              </th>
              <th scope="col" className="w-24 py-2 pr-3 text-right font-semibold">
                People
              </th>
              <th scope="col" className="w-24 py-2 text-right font-semibold">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {results.classification.buckets.map((bucket) => (
              <tr key={bucket.key} className="border-b border-slate-100 last:border-b-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-800">
                  {bucket.label}
                </th>
                <td
                  data-testid={`classification-count-${bucket.key}`}
                  className="py-2 pr-3 text-right tabular-nums text-slate-700"
                >
                  {bucket.count}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {formatRate(bucket.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.classification.championSignal.active && (
          <p data-testid="champion-signal" className="mt-3 text-sm text-slate-700">
            {results.classification.championSignal.display} identified. They are not listed: the
            signal is organization-level, and inviting volunteers to opt in separately is the
            intended next step.
          </p>
        )}
      </Card>

      <Card
        title="Top barriers"
        subtitle="What respondents say makes AI harder to use. Select up to three, so shares do not sum to 100%."
        testId="barriers"
      >
        <FrequencyTable
          caption="Reported barriers to using AI at work"
          distribution={results.diagnostics.barriers}
          ranked
          limit={8}
          emptyMessage="No major barriers were selected frequently enough to stand out."
          testId="barriers-table"
        />
      </Card>

      <Card
        title="Training demand"
        subtitle="Where respondents want help, and how they prefer to learn."
        testId="training"
      >
        <h3 className="text-sm font-semibold text-slate-800">Most requested topics</h3>
        <FrequencyTable
          caption="Requested training topics"
          distribution={results.diagnostics.trainingDemand}
          ranked
          limit={6}
          emptyMessage="No training topic clearly dominates the current responses."
          testId="training-demand-table"
        />

        <h3 className="mt-5 text-sm font-semibold text-slate-800">Preferred learning formats</h3>
        <FrequencyTable
          caption="Preferred ways to learn"
          distribution={results.diagnostics.learningPreferences}
          ranked
          limit={6}
          emptyMessage="No preferred learning format stands out in the current responses."
          testId="learning-preferences-table"
        />
      </Card>

      <Card
        title="Opportunity summary"
        subtitle="Workflows where reported pain meets the V1 threshold."
        testId="opportunity-summary"
      >
        {opportunities.guardrail.active && (
          <p
            role="status"
            data-testid="guardrail-banner-overview"
            className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
          >
            {opportunities.guardrail.message}
          </p>
        )}

        {labelled.length === 0 ? (
          <EmptyState testId="no-opportunities-overview">
            No workflow currently meets the V1 Explore or Standardize threshold.
          </EmptyState>
        ) : (
          <>
            <LabelledValue
              label="Workflows to explore"
              value={formatCount(
                labelled.filter((row) => row.status === 'explore').length,
                'workflow',
              )}
              testId="explore-count"
            />
            <LabelledValue
              label="Workflows to standardize"
              value={formatCount(
                labelled.filter((row) => row.status === 'standardize').length,
                'workflow',
              )}
              testId="standardize-count"
            />
            <p className="mt-3 text-sm">
              <Link
                to={{ pathname: 'opportunities', search }}
                className="font-medium text-slate-900 underline underline-offset-2"
              >
                Open the Opportunity Map
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
