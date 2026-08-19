/**
 * Create a Pulse - including "duplicate", which is this same screen prefilled
 * from an existing Pulse via `?duplicateOf=<id>`.
 *
 * Duplication deliberately does not carry the old dates over: copying a
 * schedule that has already passed would produce a Pulse that is closed the
 * moment it is created. The configuration is prefilled; the schedule is asked
 * for again.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPulse, fetchPulse, type ApiError } from '../lib/adminApi.js';
import { useHeadingFocus } from './adminContext.js';
import { PulseForm } from './PulseForm.js';
import { blankPulse, duplicateOf, toPayload, type PulseFormValues } from './pulseFormValues.js';
import { ErrorAlert } from './ui.js';

export function PulseNewPage() {
  const navigate = useNavigate();
  const heading = useHeadingFocus<HTMLHeadingElement>();
  const [params] = useSearchParams();
  const duplicateSource = params.get('duplicateOf');

  const [initial, setInitial] = useState<PulseFormValues | null>(duplicateSource === null ? blankPulse() : null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (duplicateSource === null) return;
    let cancelled = false;

    void fetchPulse(duplicateSource).then((result) => {
      if (cancelled) return;
      if (result.ok) setInitial(duplicateOf(result.value));
      else setLoadFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [duplicateSource]);

  function save(values: PulseFormValues): void {
    setPending(true);
    setError(null);

    void createPulse(toPayload(values)).then((result) => {
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      void navigate(`/admin/pulses/${result.value.id}?created=1`, { replace: true });
    });
  }

  return (
    <div>
      <h1 tabIndex={-1} ref={heading} className="mb-1 text-xl font-semibold text-slate-900 focus:outline-none">
        {duplicateSource === null ? 'Create a Pulse' : 'Duplicate a Pulse'}
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        {duplicateSource === null
          ? 'A Pulse is one round of collection. You will get a survey link to share once it is created.'
          : 'The configuration has been copied. Choose new dates - responses and results are not copied.'}
      </p>

      {loadFailed && <ErrorAlert>Could not load the Pulse you are duplicating.</ErrorAlert>}

      {initial !== null && (
        <PulseForm
          initial={initial}
          submitLabel="Create Pulse"
          pending={pending}
          serverError={error}
          lockedFields={[]}
          onSubmit={save}
          onCancel={() => void navigate('/admin/pulses')}
        />
      )}
    </div>
  );
}
