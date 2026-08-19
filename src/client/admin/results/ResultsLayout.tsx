/**
 * The results shell: loads the analysis once, decides which state to show, and
 * hosts the dashboard views.
 *
 * One fetch serves every tab. The whole dashboard is one analysis pass over
 * one set of responses, so re-requesting per tab would re-read and re-analyse
 * the same rows to render the same numbers.
 *
 * The three states below the happy path are all server decisions, rendered
 * faithfully: too few responses, a suppressed segment, or an analysis failure.
 * None of them is a client-side hiding of data that arrived anyway.
 */

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ResultsOk, ResultsResponse } from '../../../core/results/contracts.js';
import { MINIMUM_REPORTABLE_RESPONSES } from '../../../core/results/contracts.js';
import {
  EARLY_DIRECTIONAL_NOTE,
  NO_SINGLE_SCORE_NOTE,
  SEGMENTATION_PRIVACY_NOTE,
} from '../../../core/results/methodology.js';
import { isSegmentationDimension, type SegmentationDimension } from '../../../core/privacy/thresholds.js';
import { formatCount } from './display.js';
import { fetchResults, type ApiError, type SegmentSelection } from '../../lib/adminApi.js';
import { useHeadingFocus } from '../adminContext.js';
import { ErrorAlert, StatusBadge } from '../ui.js';
import { BUTTON_STYLES } from '../uiTokens.js';
import { SegmentControl } from './SegmentControl.js';

export interface ResultsOutletContext {
  readonly results: ResultsOk;
  readonly pulseId: string;
}

const TABS = [
  { to: '.', label: 'Overview', end: true },
  { to: 'adoption', label: 'Adoption', end: false },
  { to: 'confidence', label: 'Confidence', end: false },
  { to: 'workflow', label: 'Workflow', end: false },
  { to: 'safety', label: 'Safety', end: false },
  { to: 'enablement', label: 'Enablement', end: false },
  { to: 'opportunities', label: 'Opportunities', end: false },
  { to: 'responses', label: 'Written responses', end: false },
] as const;

function tabClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'whitespace-nowrap border-b-2 border-slate-900 px-1 pb-2 text-sm font-semibold text-slate-900'
    : 'whitespace-nowrap border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-slate-600 hover:text-slate-900';
}

export function ResultsLayout() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // The selected segment lives in the URL so it survives tab navigation and a
  // reload. The chosen dimension does not: picking "Department" is not yet a
  // request, only picking a department is.
  const urlDimension = params.get('dimension');
  const urlValue = params.get('value');
  const segmentKey = urlDimension !== null && urlValue !== null ? `${urlDimension}:${urlValue}` : '';

  const [groupBy, setGroupBy] = useState<SegmentationDimension | ''>(
    urlDimension !== null && isSegmentationDimension(urlDimension) ? urlDimension : '',
  );

  /**
   * What was loaded, and for which request. Keeping the request key beside the
   * result lets `loading` be derived rather than stored, so changing segment
   * needs no synchronous setState inside the effect.
   */
  const requestKey = `${id}|${segmentKey}`;
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly payload: ResultsResponse | null;
    readonly error: ApiError | null;
  } | null>(null);

  const fresh = loaded !== null && loaded.key === requestKey;
  const loading = !fresh;
  const payload = fresh ? loaded.payload : null;
  const error = fresh ? loaded.error : null;

  useEffect(() => {
    let cancelled = false;

    void fetchResults(id, segmentKey === '' ? null : parseSegmentKey(segmentKey)).then((result) => {
      if (cancelled) return;
      setLoaded({
        key: `${id}|${segmentKey}`,
        payload: result.ok ? result.value : null,
        error: result.ok ? null : result.error,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [id, segmentKey]);

  function applySegment(next: SegmentSelection | null): void {
    const updated = new URLSearchParams(params);
    updated.delete('dimension');
    updated.delete('value');
    if (next !== null) {
      updated.set('dimension', next.dimension);
      updated.set('value', next.value);
    }
    setParams(updated, { replace: true });
  }

  const title = payload === null ? 'Results' : payload.pulse.name;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Results</p>
          <h1
            tabIndex={-1}
            ref={heading}
            data-testid="results-title"
            className="text-xl font-semibold text-slate-900 focus:outline-none"
          >
            {title}
          </h1>
          {payload !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge state={payload.pulse.state} />
              <span data-testid="results-response-count" className="text-sm text-slate-700">
                {formatCount(payload.pulse.responseCount, 'response')}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          className={BUTTON_STYLES.secondary}
          onClick={() => void navigate(`/admin/pulses/${id}`)}
        >
          Back to Pulse
        </button>
      </div>

      {loading && (
        <p role="status" data-testid="results-loading" className="text-sm text-slate-600">
          Loading results&hellip;
        </p>
      )}

      {error !== null && (
        <ErrorAlert testId="results-error">
          {error.code === 'analysis_failed'
            ? 'These responses could not be analysed. The stored data does not match the survey version this Pulse runs.'
            : error.kind === 'not_found'
              ? 'That Pulse no longer exists.'
              : 'Results could not be loaded. Try again.'}
        </ErrorAlert>
      )}

      {payload !== null && payload.status === 'insufficient_sample' && (
        <div
          data-testid="insufficient-sample"
          className="rounded-lg border border-slate-200 bg-white p-6"
        >
          <h2 className="text-base font-semibold text-slate-900">
            {formatCount(payload.sample.responseCount, 'response')}
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Results will become available once the minimum reporting threshold is reached.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {MINIMUM_REPORTABLE_RESPONSES} completed responses are required.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Nothing is calculated below this threshold, so there are no partial results to show.
            {' '}
            {SEGMENTATION_PRIVACY_NOTE}
          </p>
        </div>
      )}

      {payload !== null && payload.status !== 'insufficient_sample' && (
        <>
          <SegmentControl
            segmentation={payload.segmentation}
            groupBy={groupBy}
            onGroupByChange={(dimension) => {
              // Switching dimension always clears the segment: a value from the
              // previous dimension has no meaning under the new one.
              setGroupBy(dimension);
              applySegment(null);
            }}
            onSegmentChange={(value) => {
              applySegment(
                value === '' || groupBy === '' ? null : { dimension: groupBy, value },
              );
            }}
            disabled={loading}
          />

          {payload.status === 'suppressed' && (
            <div
              data-testid="segment-suppressed"
              className="rounded-lg border border-amber-300 bg-amber-50 p-5"
            >
              <h2 className="text-base font-semibold text-amber-900">
                {payload.reason === 'multiple_segmentation_dimensions'
                  ? 'Only one filter at a time'
                  : 'Not enough responses to report safely'}
              </h2>
              <p role="status" className="mt-2 text-sm text-amber-900">
                {payload.reason === 'multiple_segmentation_dimensions'
                  ? 'Results can be grouped by one dimension at a time. Combining two would produce groups small enough to identify people.'
                  : SEGMENTATION_PRIVACY_NOTE}
              </p>
              <p className="mt-2 text-xs text-amber-800">
                No results were calculated for this selection. Choose a different group, or view all
                respondents.
              </p>
            </div>
          )}

          {payload.status === 'ok' && (
            <>
              {payload.sample.earlyDirectional && (
                <p
                  role="status"
                  data-testid="early-directional"
                  className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                >
                  {EARLY_DIRECTIONAL_NOTE}
                </p>
              )}

              <p className="mb-4 text-sm text-slate-600" data-testid="viewing-count">
                Showing {formatCount(payload.sample.responseCount, 'response')}
                {payload.segmentation.active !== null && ' in the selected group'}. {NO_SINGLE_SCORE_NOTE}
              </p>

              <nav aria-label="Results sections" className="mb-5 border-b border-slate-200">
                <ul className="flex gap-4 overflow-x-auto">
                  {TABS.map((tab) => (
                    <li key={tab.label}>
                      {/*
                        The search string travels with the link so a selected
                        segment survives moving between views - otherwise
                        opening a detail tab would silently drop back to the
                        whole organization.
                      */}
                      <NavLink
                        to={{ pathname: tab.to, search: location.search }}
                        end={tab.end}
                        className={tabClass}
                        relative="path"
                      >
                        {tab.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <Outlet context={{ results: payload, pulseId: id } satisfies ResultsOutletContext} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function parseSegmentKey(key: string): SegmentSelection {
  const separator = key.indexOf(':');
  return {
    dimension: key.slice(0, separator) as SegmentSelection['dimension'],
    value: key.slice(separator + 1),
  };
}
