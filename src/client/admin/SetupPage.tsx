/**
 * First-run organization setup.
 *
 * Reached only when an authenticated administrator has no organization yet.
 * The layout sends them here and refuses to leave until it exists.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrganization, type ApiError, type OrganizationPayload } from '../lib/adminApi.js';
import { useAdmin } from './adminContext.js';
import { useHeadingFocus } from '../lib/focus.js';
import { OrganizationForm } from './OrganizationForm.js';

export function SetupPage() {
  const { refreshSession } = useAdmin();
  const navigate = useNavigate();
  const heading = useHeadingFocus<HTMLHeadingElement>();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function save(payload: OrganizationPayload) {
    setPending(true);
    setError(null);

    void createOrganization(payload).then((result) => {
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void refreshSession().then(() => navigate('/admin/pulses', { replace: true }));
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h1 tabIndex={-1} ref={heading} className="text-xl font-semibold text-slate-900 focus:outline-none">
        Set up your organization
      </h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        This deployment serves one organization. These details appear on the employee survey page.
      </p>

      <OrganizationForm
        initial={null}
        submitLabel="Save organization"
        pending={pending}
        serverError={error}
        onSubmit={save}
      />
    </div>
  );
}
