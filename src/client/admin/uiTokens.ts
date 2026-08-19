/**
 * Presentation constants shared by the admin components.
 *
 * They live in their own module so the component files export components only,
 * which keeps fast refresh working during development.
 */

import type { PulseOperationalState } from '../../core/pulse/status.js';

export const STATE_LABELS: Record<PulseOperationalState, string> = {
  not_published: 'Not published',
  upcoming: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
  collection_ended: 'Collection ended',
};

/** Colour is decoration here; every badge also carries its own words. */
export const STATE_STYLES: Record<PulseOperationalState, string> = {
  not_published: 'border-slate-300 bg-slate-50 text-slate-700',
  upcoming: 'border-sky-300 bg-sky-50 text-sky-900',
  open: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  closed: 'border-slate-400 bg-slate-100 text-slate-800',
  collection_ended: 'border-amber-300 bg-amber-50 text-amber-900',
};

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-slate-700 disabled:opacity-60';

export const BUTTON_STYLES = {
  primary: `${BUTTON_BASE} bg-slate-900 text-white hover:bg-slate-800`,
  secondary: `${BUTTON_BASE} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`,
  danger: `${BUTTON_BASE} bg-red-700 text-white hover:bg-red-800`,
} as const;

export const INPUT_CLASS =
  'block w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-slate-700';
