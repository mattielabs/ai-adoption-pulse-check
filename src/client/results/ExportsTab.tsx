/**
 * Downloads.
 *
 * Three files, three different privacy positions, and the copy says which is
 * which. The point of this screen is that an administrator can tell - before
 * clicking - what leaves the server and what does not. Nothing here is hidden
 * behind an icon or softened into "anonymised data", because the product's
 * claim is "no direct identifiers and small groups suppressed", not anonymity.
 * Spec 35.1; Phase 4 brief 18, 23.
 *
 * These are plain links to GET endpoints. The Worker shapes and gates every
 * file; the browser never assembles one from raw responses, and there is no
 * client-side export path at all.
 */

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FREE_TEXT_EXPORT_WARNING } from '../../core/privacy/exports.js';
import type { ResultsOutletContext } from './ResultsLayout.js';
import { Card } from './components.js';
import { formatCount } from './display.js';

const LINK_CLASS =
  'inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800';

const DISABLED_CLASS =
  'inline-flex min-h-11 items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500';

interface DownloadProps {
  readonly href: string;
  readonly label: string;
  readonly testId: string;
  readonly available: boolean;
  readonly unavailableCopy?: string;
  readonly children: React.ReactNode;
}

function Download({ href, label, testId, available, unavailableCopy, children }: DownloadProps) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0">
      {available ? (
        <a className={LINK_CLASS} href={href} data-testid={testId} download>
          {label}
        </a>
      ) : (
        <span className={DISABLED_CLASS} data-testid={`${testId}-disabled`} aria-disabled="true">
          {label}
        </span>
      )}
      <div className="mt-2 max-w-2xl text-sm text-slate-700">{children}</div>
      {!available && unavailableCopy !== undefined && (
        <p className="mt-2 text-sm font-medium text-slate-600" data-testid={`${testId}-unavailable`}>
          {unavailableCopy}
        </p>
      )}
    </div>
  );
}

export function ExportsTab() {
  const { results, pulseId, loadFreeText } = useOutletContext<ResultsOutletContext>();
  const base = `/api/admin/pulses/${encodeURIComponent(pulseId)}/export`;

  /**
   * Whether there is anything to put in the free-text file.
   *
   * Read from the free-text endpoint rather than from the results payload,
   * because Q27 is deliberately absent from the results payload and adding a
   * count to it would put free text and segmented aggregates back in the same
   * response. Until it answers, the link is offered: the server refuses an
   * export the browser should not have anyway.
   */
  const [writtenCount, setWrittenCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadFreeText().then((result) => {
      if (cancelled) return;
      setWrittenCount(result.ok && result.value.status === 'ok' ? result.value.responses.length : null);
    });
    return () => {
      cancelled = true;
    };
  }, [loadFreeText]);

  const freeTextAvailable = writtenCount === null || writtenCount > 0;

  return (
    <div className="space-y-5">
      <Card
        title="Exports"
        subtitle="Every file is shaped and gated on the server. None of them contains a respondent identifier."
        testId="exports"
      >
        <Download
          href={`${base}/responses.csv`}
          label="Download response CSV"
          testId="export-responses"
          available
        >
          <p>
            One row per response, in randomised order. <strong>Excluded:</strong> department, role
            level, work type, written responses, submission dates and row identifiers. Multi-select
            answers are joined with <code className="rounded bg-slate-100 px-1">|</code>.
          </p>
          <p className="mt-2 text-slate-600">
            This is a <strong>limited</strong> response export, not fully anonymous data. Work-context
            answers are deliberately unavailable at row level in V1, because department plus role plus
            work type on one row is a practical way to recognise somebody in a small organization.
          </p>
        </Download>

        <Download
          href={`${base}/free-text.csv`}
          label="Download written responses CSV"
          testId="export-free-text"
          available={freeTextAvailable}
          unavailableCopy="No written opportunity responses were submitted."
        >
          <p
            role="note"
            data-testid="export-free-text-warning"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
          >
            {FREE_TEXT_EXPORT_WARNING}
          </p>
          <p className="mt-2 text-slate-600">
            The file contains the written answer and a per-file row token, and nothing else - no
            department, no role, no date, no other answer, no score. The token is generated at
            download time and is not stored, so two exports cannot be lined up against each other.
          </p>
        </Download>

        <Download
          href={`${base}/results.json`}
          label="Download aggregate results JSON"
          testId="export-results-json"
          available
        >
          <p>
            The same organization-level analysis this dashboard renders, unsegmented, stamped with
            the survey, scoring and recommendation-engine versions that produced it.
          </p>
          <p className="mt-2 text-slate-600">
            No response rows, no written responses, no per-person scores, and no counts for
            suppressed groups.
          </p>
        </Download>
      </Card>

      <Card title="What is not exportable" testId="exports-limits">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <strong>Work-context answers at row level.</strong> Q1-Q3 are used for aggregate
            grouping only, and only where the group and its complement both meet the reporting
            threshold.
          </li>
          <li>
            <strong>Written responses joined to anything.</strong> Q27 has its own file for the same
            reason it has its own screen.
          </li>
          <li>
            <strong>Anything below {results.sample.minimumRequired} responses.</strong> Exports are
            refused by the server, not merely hidden here.
          </li>
          <li>
            <strong>Custom free-text answers.</strong> Organization-specific select questions appear
            in the response CSV; a custom free-text question collects prose, which carries the same
            re-identification risk as Q27 without a separate file to keep it in.
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Based on {formatCount(results.sample.responseCount, 'response')} in the current view.
          Selecting a segment does not change what an export contains - every file is built from the
          whole Pulse.
        </p>
      </Card>
    </div>
  );
}
