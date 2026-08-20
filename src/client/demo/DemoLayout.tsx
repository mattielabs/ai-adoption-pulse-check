/**
 * The public shell for /demo and /methodology.
 *
 * Separate from `AdminApp` on purpose: there is no session check here, nothing
 * reads the admin API, and there is no path from this layout into an
 * administrative screen. A visitor gets the product's reasoning and a
 * synthetic organization, and nothing else.
 */

import { Link, NavLink, Outlet } from 'react-router-dom';
import { DEMO_BADGE } from '../../core/demo/constants.js';

const LINK_BASE = 'rounded px-2 py-1 text-sm font-medium';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${LINK_BASE} bg-slate-900 text-white`
    : `${LINK_BASE} text-slate-700 hover:bg-slate-200`;
}

export function DemoLayout() {
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/demo" className="text-sm font-semibold text-slate-900">
            AI Adoption Pulse Check
          </Link>
          <nav aria-label="Demo" className="flex flex-wrap items-center gap-1">
            <NavLink to="/demo" end className={navClass}>
              Overview
            </NavLink>
            <NavLink to="/demo/results" className={navClass}>
              Sample organization
            </NavLink>
            <NavLink to="/demo/survey" className={navClass}>
              Sample survey
            </NavLink>
            <NavLink to="/methodology" className={navClass}>
              Methodology
            </NavLink>
          </nav>
        </div>
        <p
          data-testid="synthetic-banner"
          className="border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900"
        >
          {DEMO_BADGE} &mdash; every response shown here is synthetic
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
        AI Adoption Pulse Check &mdash; open-source project by Mattie Labs. Released under the MIT
        licence.
      </footer>
    </div>
  );
}
