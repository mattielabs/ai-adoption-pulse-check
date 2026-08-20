/**
 * The admin home: every Pulse this organization has run.
 *
 * Operational only - status, dates, and how many responses have arrived.
 * There are no scores, no recommendations and no charts here; interpreting
 * collected data is Phase 3. The list state comes from the server so it can
 * never disagree with what the submission endpoint will actually do.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminPulseSummary } from '../../core/admin/contracts.js';
import { formatCalendarDay } from '../../core/pulse/day.js';
import { fetchOrganization, fetchPulses } from '../lib/adminApi.js';
import { useHeadingFocus } from '../lib/focus.js';
import { ErrorAlert, StatusBadge } from '../ui.js';
import { BUTTON_STYLES } from '../uiTokens.js';

const CURRENT_STATES = new Set(['open', 'upcoming', 'not_published']);

export function PulseListPage() {
  const heading = useHeadingFocus<HTMLHeadingElement>();

  const [pulses, setPulses] = useState<readonly AdminPulseSummary[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchPulses(), fetchOrganization()]).then(([list, organization]) => {
      if (cancelled) return;
      if (list.ok) setPulses(list.value.pulses);
      else setFailed(true);
      if (organization.ok) setOrganizationName(organization.value.organization?.name ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const current = pulses.filter((pulse) => CURRENT_STATES.has(pulse.state));
  const previous = pulses.filter((pulse) => !CURRENT_STATES.has(pulse.state));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 tabIndex={-1} ref={heading} className="text-xl font-semibold text-slate-900 focus:outline-none">
            Pulses
          </h1>
          {organizationName !== null && (
            <p data-testid="organization-name" className="mt-1 text-sm text-slate-600">
              {organizationName}
            </p>
          )}
        </div>
        <Link to="/admin/pulses/new" data-testid="create-pulse" className={BUTTON_STYLES.primary}>
          Create Pulse
        </Link>
      </div>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading&hellip;
        </p>
      )}
      {failed && <ErrorAlert>Could not load your Pulses.</ErrorAlert>}

      {!loading && !failed && pulses.length === 0 && (
        <div data-testid="no-pulses" className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">No Pulses yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Create one to get a survey link you can share with employees. Nothing is collected until
            somebody opens that link and submits.
          </p>
        </div>
      )}

      {current.length > 0 && <PulseGroup title="Active and upcoming" pulses={current} testId="current-pulses" />}
      {previous.length > 0 && <PulseGroup title="Previous" pulses={previous} testId="previous-pulses" />}
    </div>
  );
}

function PulseGroup({
  title,
  pulses,
  testId,
}: {
  readonly title: string;
  readonly pulses: readonly AdminPulseSummary[];
  readonly testId: string;
}) {
  return (
    <section aria-labelledby={`${testId}-heading`} className="mb-8" data-testid={testId}>
      <h2 id={`${testId}-heading`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <ul className="space-y-3">
        {pulses.map((pulse) => (
          <li key={pulse.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to={`/admin/pulses/${pulse.id}`}
                  data-testid={`pulse-link-${pulse.id}`}
                  className="text-base font-semibold text-slate-900 underline underline-offset-4"
                >
                  {pulse.name}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {pulse.opensOn === null ? 'No opening date' : `Opens ${formatCalendarDay(pulse.opensOn)}`}
                  {' · '}
                  {pulse.closesOn === null ? 'No closing date' : `Closes ${formatCalendarDay(pulse.closesOn)}`}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge state={pulse.state} />
                <p data-testid={`response-count-${pulse.id}`} className="mt-1 text-sm text-slate-700">
                  {pulse.responseCount} {pulse.responseCount === 1 ? 'response' : 'responses'}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
