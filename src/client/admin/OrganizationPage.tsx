/**
 * Organization settings.
 *
 * Changes apply to how the employee survey page renders from now on. They do
 * not alter Pulses that already ran and they never touch stored responses.
 */

import { useEffect, useState } from 'react';
import type { AdminOrganization } from '../../core/admin/contracts.js';
import {
  fetchOrganization,
  updateOrganization,
  type ApiError,
  type OrganizationPayload,
} from '../lib/adminApi.js';
import { useHeadingFocus } from '../lib/focus.js';
import { OrganizationForm } from './OrganizationForm.js';
import { ErrorAlert, SuccessNotice } from '../ui.js';

export function OrganizationPage() {
  const heading = useHeadingFocus<HTMLHeadingElement>();

  const [organization, setOrganization] = useState<AdminOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchOrganization().then((result) => {
      if (cancelled) return;
      if (result.ok) setOrganization(result.value.organization);
      else setLoadFailed(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function save(payload: OrganizationPayload) {
    setPending(true);
    setError(null);
    setSaved(false);

    void updateOrganization(payload).then((result) => {
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrganization({ ...payload });
      setSaved(true);
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h1 tabIndex={-1} ref={heading} className="text-xl font-semibold text-slate-900 focus:outline-none">
        Organization
      </h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        These details appear on the employee survey page. Changing them affects future views of the
        survey; responses already collected are never rewritten.
      </p>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading&hellip;
        </p>
      )}
      {loadFailed && <ErrorAlert>Could not load your organization settings.</ErrorAlert>}
      {saved && <SuccessNotice>Organization settings saved.</SuccessNotice>}

      {!loading && !loadFailed && (
        <OrganizationForm
          // Remount when the loaded values arrive so the fields start populated.
          key={organization?.name ?? 'none'}
          initial={organization}
          submitLabel="Save changes"
          pending={pending}
          serverError={error}
          onSubmit={save}
        />
      )}
    </div>
  );
}
