/**
 * Operational detail for one Pulse: the link to share, how many responses have
 * arrived, the configuration it is running under, and the lifecycle actions.
 *
 * Not shown, on purpose: respondent rows, scores, free text, or anything that
 * would require reading response content to render this page.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  LOCKED_AFTER_FIRST_RESPONSE,
  type AdminPulseDetail,
  type LockedPulseField,
} from '../../core/admin/contracts.js';
import { formatCalendarDay } from '../../core/pulse/day.js';
import { isClosable } from '../../core/pulse/status.js';
import {
  closePulse,
  deletePulse,
  fetchPulse,
  updatePulse,
  type ApiError,
} from '../lib/adminApi.js';
import { useHeadingFocus } from './adminContext.js';
import { PulseForm } from './PulseForm.js';
import { fromDetail, QUESTION_TYPE_LABELS, toPayload, type PulseFormValues } from './pulseFormValues.js';
import { ConfirmDialog, CopyLinkButton, ErrorAlert, StatusBadge, SuccessNotice } from './ui.js';
import { BUTTON_STYLES } from './uiTokens.js';

const DELETE_CONFIRMATION = 'DELETE';

export function PulseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const [params, setParams] = useSearchParams();

  const [pulse, setPulse] = useState<AdminPulseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get('created') === '1' ? 'Pulse created.' : null);
  const [confirming, setConfirming] = useState<'close' | 'delete' | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

  // Bumped by the lifecycle actions to re-read the Pulse after a change.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => setReloadNonce((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;

    void fetchPulse(id).then((result) => {
      if (cancelled) return;
      if (result.ok) setPulse(result.value);
      else if (result.error.kind === 'not_found') setMissing(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, reloadNonce]);

  useEffect(() => {
    if (params.get('created') !== '1') return;
    // Keep the URL shareable and stop the notice reappearing on reload.
    const next = new URLSearchParams(params);
    next.delete('created');
    setParams(next, { replace: true });
  }, [params, setParams]);

  if (loading) {
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading&hellip;
      </p>
    );
  }

  if (missing || pulse === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 tabIndex={-1} ref={heading} className="text-xl font-semibold text-slate-900 focus:outline-none">
          Pulse not found
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          It may have been deleted.{' '}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => void navigate('/admin/pulses')}
          >
            Back to all Pulses
          </button>
        </p>
      </div>
    );
  }

  const lockedFields: readonly LockedPulseField[] = pulse.configurationEditable
    ? []
    : LOCKED_AFTER_FIRST_RESPONSE;
  const surveyUrl = `${window.location.origin}/p/${pulse.publicId}`;

  function saveEdits(values: PulseFormValues): void {
    if (pulse === null) return;
    setPending(true);
    setError(null);

    const payload = toPayload(values);
    // Locked fields are omitted rather than resent: the server refuses a
    // request that mentions one at all once responses exist.
    const updates = pulse.configurationEditable
      ? payload
      : {
          name: payload.name,
          description: payload.description,
          closesOn: payload.closesOn,
        };

    void updatePulse(id, updates).then((result) => {
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setNotice('Changes saved.');
      reload();
    });
  }

  function confirmClose(): void {
    setPending(true);
    void closePulse(id).then((result) => {
      setPending(false);
      setConfirming(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice('This Pulse is closed. It is no longer accepting responses.');
      reload();
    });
  }

  function confirmDelete(): void {
    setPending(true);
    void deletePulse(id).then((result) => {
      setPending(false);
      setConfirming(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void navigate('/admin/pulses', { replace: true });
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            tabIndex={-1}
            ref={heading}
            data-testid="pulse-title"
            className="text-xl font-semibold text-slate-900 focus:outline-none"
          >
            {pulse.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge state={pulse.state} />
            <span data-testid="detail-response-count" className="text-sm text-slate-700">
              {pulse.responseCount} {pulse.responseCount === 1 ? 'response' : 'responses'}
            </span>
          </div>
        </div>
        <button type="button" className={BUTTON_STYLES.secondary} onClick={() => void navigate('/admin/pulses')}>
          All Pulses
        </button>
      </div>

      {notice !== null && <SuccessNotice>{notice}</SuccessNotice>}
      {error !== null && !editing && (
        <ErrorAlert testId="pulse-action-error">
          {error.code === 'pulse_already_closed'
            ? 'This Pulse is already closed.'
            : 'That action could not be completed. Try again.'}
        </ErrorAlert>
      )}

      {editing ? (
        <PulseForm
          initial={fromDetail(pulse)}
          submitLabel="Save changes"
          pending={pending}
          serverError={error}
          lockedFields={lockedFields}
          onSubmit={saveEdits}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
        />
      ) : (
        <>
          <section aria-labelledby="link-heading" className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="link-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Survey link
            </h2>
            <p data-testid="survey-url" className="mt-2 break-all font-mono text-sm text-slate-800">
              {surveyUrl}
            </p>
            <div className="mt-3">
              <CopyLinkButton url={surveyUrl} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Anyone with this link can respond. It contains no organization name and cannot be guessed
              from another Pulse&rsquo;s link.
            </p>
          </section>

          <section aria-labelledby="config-heading" className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="config-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Configuration
            </h2>
            <dl className="mt-2 text-sm text-slate-700">
              <Row label="Description" value={pulse.description ?? 'None'} />
              <Row label="Opens on" value={pulse.opensOn === null ? 'Not set' : formatCalendarDay(pulse.opensOn)} />
              <Row
                label="Closes on"
                value={pulse.closesOn === null ? 'When you close it' : formatCalendarDay(pulse.closesOn)}
              />
              <Row
                label="Employee result"
                value={pulse.personalResultsEnabled ? 'Shown after submitting' : 'Not shown'}
              />
              <Row label="Survey version" value={pulse.surveyVersion} />
            </dl>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">Custom questions</h3>
            {pulse.customQuestions.length === 0 ? (
              <p data-testid="no-custom-questions" className="mt-1 text-sm text-slate-600">
                None. Employees answer the core survey only.
              </p>
            ) : (
              <ol data-testid="custom-question-list" className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {pulse.customQuestions.map((question) => (
                  <li key={question.position}>
                    {question.questionText}{' '}
                    <span className="text-slate-500">({QUESTION_TYPE_LABELS[question.type]})</span>
                    {question.options !== null && (
                      <span className="text-slate-500">
                        {' '}
                        &mdash; {question.options.map((option) => option.label).join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {!pulse.configurationEditable && (
              <p data-testid="configuration-locked" className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                This Pulse has responses, so the opening date, the employee-result setting and the custom
                questions can no longer change. Collected answers have to stay interpretable against the
                configuration respondents actually saw. Duplicate this Pulse to run a different
                configuration.
              </p>
            )}
          </section>

          <section aria-labelledby="actions-heading" className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="actions-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Actions
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="edit-pulse"
                className={BUTTON_STYLES.secondary}
                onClick={() => {
                  setEditing(true);
                  setNotice(null);
                  setError(null);
                }}
              >
                Edit configuration
              </button>
              <button
                type="button"
                data-testid="duplicate-pulse"
                className={BUTTON_STYLES.secondary}
                onClick={() => void navigate(`/admin/pulses/new?duplicateOf=${pulse.id}`)}
              >
                Duplicate
              </button>
              {isClosable(pulse.state) && (
                <button
                  type="button"
                  data-testid="close-pulse"
                  className={BUTTON_STYLES.secondary}
                  onClick={() => setConfirming('close')}
                >
                  Close Pulse
                </button>
              )}
              <button
                type="button"
                data-testid="delete-pulse"
                className={BUTTON_STYLES.danger}
                onClick={() => {
                  setDeleteInput('');
                  setConfirming('delete');
                }}
              >
                Delete
              </button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirming === 'close'}
        title="Close this Pulse?"
        confirmLabel="Close Pulse"
        testId="confirm-close"
        onCancel={() => setConfirming(null)}
        onConfirm={confirmClose}
        confirmDisabled={pending}
      >
        <p>
          Closing this Pulse stops new responses. Existing results remain available. To run another
          collection, duplicate the Pulse.
        </p>
        <p className="mt-2 font-medium">This cannot be undone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === 'delete'}
        title={`Delete "${pulse.name}"?`}
        confirmLabel="Delete permanently"
        testId="confirm-delete"
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDelete}
        confirmDisabled={pending || deleteInput.trim() !== DELETE_CONFIRMATION}
      >
        <p>
          This permanently removes the Pulse, its custom questions and all{' '}
          <strong>
            {pulse.responseCount} {pulse.responseCount === 1 ? 'response' : 'responses'}
          </strong>
          . The survey link stops working. This cannot be undone.
        </p>
        <label htmlFor="delete-confirm" className="mt-4 block text-sm font-medium text-slate-900">
          Type {DELETE_CONFIRMATION} to confirm
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={deleteInput}
          data-testid="delete-confirmation"
          onChange={(event) => setDeleteInput(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="font-medium text-slate-900">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
