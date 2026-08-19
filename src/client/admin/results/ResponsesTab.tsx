/**
 * Written opportunity responses (Q27).
 *
 * Deliberately the plainest screen in the dashboard. Each entry is rendered on
 * its own with nothing beside it: no department, no role, no work type, no
 * date, no classification, no scores, no other answers. There is no filter
 * control here at all, because free text is never segmentable - pairing a
 * sentence somebody wrote with the group they belong to is precisely the
 * re-identification path the privacy model exists to close. Spec 34.4, 47.
 *
 * Text is rendered as text. React escapes it; nothing on this page interprets
 * markup, and no model reads it.
 */

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FreeTextResponse } from '../../../core/results/contracts.js';
import { FREE_TEXT_PRIVACY_WARNING } from '../../../core/results/methodology.js';
import { fetchFreeText } from '../../lib/adminApi.js';
import type { ResultsOutletContext } from './ResultsLayout.js';
import { Card, EmptyState } from './components.js';
import { formatCount, questionPrompt } from './display.js';
import { ErrorAlert } from '../ui.js';

export function ResponsesTab() {
  const { pulseId } = useOutletContext<ResultsOutletContext>();

  const [payload, setPayload] = useState<FreeTextResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchFreeText(pulseId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPayload(result.value);
      else setFailed(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [pulseId]);

  const entries = payload !== null && payload.status === 'ok' ? payload.responses : [];

  return (
    <Card title="Written responses" subtitle={questionPrompt('q27')} testId="free-text">
      <p
        role="note"
        data-testid="free-text-warning"
        className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        {FREE_TEXT_PRIVACY_WARNING}
      </p>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading responses&hellip;
        </p>
      )}
      {failed && <ErrorAlert>Written responses could not be loaded.</ErrorAlert>}

      {payload !== null && payload.status === 'insufficient_sample' && (
        <EmptyState testId="free-text-insufficient">
          Written responses become available once the minimum reporting threshold of{' '}
          {payload.sample.minimumRequired} responses is reached.
        </EmptyState>
      )}

      {payload !== null && payload.status === 'ok' && entries.length === 0 && (
        <EmptyState testId="free-text-empty">No written opportunity responses were submitted.</EmptyState>
      )}

      {entries.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-600" data-testid="free-text-count">
            {formatCount(entries.length, 'written response')} of{' '}
            {formatCount(payload?.sample.responseCount ?? 0, 'total response')}. Order is
            randomised, so position says nothing about who submitted when.
          </p>
          <ul data-testid="free-text-list" className="space-y-3">
            {entries.map((entry, index) => (
              <li
                // Free text has no id by design; there is nothing stable to key on.
                key={`${index}-${entry.slice(0, 24)}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap break-words text-slate-800"
              >
                {entry}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        These are shown exactly as written, with no filtering, no grouping and no automated
        analysis. Nothing on this page can be linked to any other answer.
      </p>
    </Card>
  );
}
