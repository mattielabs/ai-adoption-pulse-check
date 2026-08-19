/**
 * The admin layout and its session bootstrap.
 *
 * Protected content is never rendered before the session state is known: the
 * layout shows a "checking" state first, so nothing flashes into view and then
 * disappears. These redirects are navigation convenience only - the server
 * enforces authorization on every request, and would refuse the data even if
 * a screen were reached some other way.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { AdminSessionState } from '../../core/admin/contracts.js';
import { fetchSession, logout } from '../lib/adminApi.js';
import type { AdminOutletContext } from './adminContext.js';
import { BUTTON_STYLES } from './uiTokens.js';

const SIGNED_OUT: AdminSessionState = { authenticated: false, organizationConfigured: false };

const LOGIN_PATH = '/admin/login';
const SETUP_PATH = '/admin/setup';
const HOME_PATH = '/admin/pulses';

export function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<AdminSessionState>(SIGNED_OUT);
  const location = useLocation();
  const navigate = useNavigate();

  const refreshSession = useCallback(async () => {
    const result = await fetchSession();
    setSession(result.ok ? result.value : SIGNED_OUT);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchSession().then((result) => {
      if (cancelled) return;
      setSession(result.ok ? result.value : SIGNED_OUT);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const context: AdminOutletContext = { session, refreshSession, setSession };
  const path = location.pathname;

  if (checking) {
    return (
      <Shell>
        <p role="status" data-testid="admin-checking" className="text-sm text-slate-600">
          Checking your session&hellip;
        </p>
      </Shell>
    );
  }

  if (!session.authenticated && path !== LOGIN_PATH) {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  if (session.authenticated) {
    if (!session.organizationConfigured && path !== SETUP_PATH) {
      return <Navigate to={SETUP_PATH} replace />;
    }
    if (session.organizationConfigured && (path === SETUP_PATH || path === LOGIN_PATH)) {
      return <Navigate to={HOME_PATH} replace />;
    }
  }

  const showNav = session.authenticated && session.organizationConfigured;

  return (
    <Shell>
      {showNav && (
        <nav aria-label="Admin" className="mb-6 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4">
          <NavLink to={HOME_PATH} className={navLinkClass} end>
            Pulses
          </NavLink>
          <NavLink to="/admin/organization" className={navLinkClass}>
            Organization
          </NavLink>
          <button
            type="button"
            data-testid="sign-out"
            className={`${BUTTON_STYLES.secondary} ml-auto`}
            onClick={() => {
              void logout().then(() => {
                setSession(SIGNED_OUT);
                void navigate(LOGIN_PATH, { replace: true });
              });
            }}
          >
            Sign out
          </button>
        </nav>
      )}

      <Outlet context={context} />
    </Shell>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'text-sm font-semibold text-slate-900 underline underline-offset-4'
    : 'text-sm font-medium text-slate-600 hover:text-slate-900';
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Adoption Pulse Check &middot; Admin
        </p>
        <main>{children}</main>
        <footer className="mt-10 text-xs text-slate-400">
          <Link to="/status" className="hover:text-slate-600">
            System status
          </Link>
          <span className="mx-2">&middot;</span>
          AI Adoption Pulse Check &mdash; open-source project by Mattie Labs
        </footer>
      </div>
    </div>
  );
}
