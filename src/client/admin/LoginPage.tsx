/**
 * Admin sign-in.
 *
 * One deployment passcode, one field. The failure message is deliberately the
 * same for a wrong passcode, a too-short passcode and a malformed request:
 * telling an anonymous visitor which one it was would help them guess.
 *
 * The passcode is held in component state only while the form is open and is
 * cleared as soon as the request settles. It is never persisted, never put in
 * the URL, and never sent anywhere but this deployment's own login endpoint.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/adminApi.js';
import { useAdmin } from './adminContext.js';
import { useHeadingFocus } from '../lib/focus.js';
import { ErrorAlert, TextField } from '../ui.js';
import { BUTTON_STYLES } from '../uiTokens.js';

const GENERIC_FAILURE = 'Unable to sign in with that passcode.';
const THROTTLED = 'Too many sign-in attempts. Try again later.';
const UNAVAILABLE = 'Sign-in is unavailable. Check the deployment configuration.';
const OFFLINE = 'Could not reach the server. Check your connection and try again.';

export function LoginPage() {
  const { setSession } = useAdmin();
  const navigate = useNavigate();
  const heading = useHeadingFocus<HTMLHeadingElement>();

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    void login(passcode).then((result) => {
      // Release the passcode as soon as the request has been made, whatever
      // the outcome.
      setPasscode('');
      setPending(false);

      if (result.ok) {
        setSession(result.value);
        void navigate(result.value.organizationConfigured ? '/admin/pulses' : '/admin/setup', {
          replace: true,
        });
        return;
      }

      if (result.error.kind === 'rate_limited') setError(THROTTLED);
      else if (result.error.kind === 'network') setError(OFFLINE);
      else if (result.error.kind === 'server' || result.error.kind === 'forbidden') setError(UNAVAILABLE);
      else setError(GENERIC_FAILURE);
    });
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-slate-200 bg-white p-6">
      <h1 tabIndex={-1} ref={heading} className="text-xl font-semibold text-slate-900 focus:outline-none">
        Admin access
      </h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        Enter the passcode for this deployment.
      </p>

      {error !== null && <ErrorAlert testId="login-error">{error}</ErrorAlert>}

      <form onSubmit={submit} noValidate>
        <TextField
          label="Passcode"
          type="password"
          value={passcode}
          onChange={setPasscode}
          required
          testId="passcode"
          autoComplete="current-password"
        />
        <button type="submit" data-testid="sign-in" disabled={pending} className={`${BUTTON_STYLES.primary} w-full`}>
          {pending ? 'Checking…' : 'Continue'}
        </button>
      </form>

      <p className="mt-5 text-xs text-slate-500">
        There is one passcode per deployment and no recovery flow. If it is lost, generate a new hash
        with <code className="font-mono">npm run admin:hash-passcode</code> and update the
        deployment secret.
      </p>
    </div>
  );
}
