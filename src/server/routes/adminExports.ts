/**
 * Downloads.
 *
 *   GET /api/admin/pulses/:id/export/responses.csv   privacy-limited rows
 *   GET /api/admin/pulses/:id/export/free-text.csv   Q27, isolated
 *   GET /api/admin/pulses/:id/export/results.json    the aggregate
 *
 * All three sit behind the admin session, applied by the router in admin.ts.
 * All three are GET and side-effect free: a download must never be a way to
 * change something.
 *
 * Nothing is shaped here. The route reads a pulse, calls the export service,
 * and turns the result into a response with the right headers - so there is no
 * second place where a privacy rule could be written down slightly
 * differently. Phase 4 brief 12.
 */

import { Hono, type Context } from 'hono';
import type { AppBindings } from '../env.js';
import { findAdminPulse, type AdminPulseRow } from '../lib/adminRepo.js';
import {
  exportFreeTextCsv,
  exportResponsesCsv,
  exportResultsJson,
  type ExportFailureReason,
  type ExportOutcome,
} from '../lib/exports.js';
import { MINIMUM_REPORTABLE_RESPONSES } from '../../core/results/contracts.js';

export const adminExportRoutes = new Hono<AppBindings>();

const PULSE_NOT_FOUND = { error: 'pulse_not_found' } as const;

function parsePulseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadPulse(c: Context<AppBindings>): Promise<AdminPulseRow | null> {
  const id = parsePulseId(c.req.param('id') ?? '');
  return id === null ? null : findAdminPulse(c.env.DB, id);
}

/**
 * Turns an export failure into a response.
 *
 * A too-small sample is a 409: the request is well formed and authorized, and
 * it is the current state of the Pulse that makes it impossible. The body
 * carries the threshold so the UI can explain it without hard-coding a number,
 * and the actual response count, which the administrator can already see on
 * every screen of their own Pulse.
 */
function exportFailure(
  c: Context<AppBindings>,
  pulseId: number,
  reason: ExportFailureReason,
  responseCount: number | undefined,
) {
  if (reason === 'insufficient_sample') {
    return c.json(
      {
        error: 'insufficient_sample',
        minimumRequired: MINIMUM_REPORTABLE_RESPONSES,
        responseCount: responseCount ?? 0,
      },
      409,
    );
  }

  // Failure class and pulse id only. Never an answer, never free text.
  console.error('Pulse export failed', { pulseId, reason });
  return c.json({ error: 'export_failed', reason }, 500);
}

/**
 * `Content-Disposition` for a download.
 *
 * The filename has already been reduced to lowercase letters, digits, hyphens
 * and one dot by `safeFilenameSlug`, so it cannot close the quoted parameter,
 * inject a second header, or contain a path separator. This asserts that
 * rather than assuming it: a header is the wrong place to discover that an
 * upstream allowlist was loosened.
 */
function attachment(filename: string): string {
  if (!/^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/.test(filename)) {
    throw new Error('Unsafe export filename');
  }
  return `attachment; filename="${filename}"`;
}

function download(
  c: Context<AppBindings>,
  body: string,
  filename: string,
  contentType: string,
): Response {
  return c.body(body, 200, {
    'Content-Type': contentType,
    'Content-Disposition': attachment(filename),
    // Downloads of survey data should not sit in a shared cache.
    'Cache-Control': 'no-store',
  });
}

async function csvRoute(
  c: Context<AppBindings>,
  build: (pulse: AdminPulseRow) => Promise<ExportOutcome<{ filename: string; csv: string }>>,
): Promise<Response> {
  const pulse = await loadPulse(c);
  if (pulse === null) return c.json(PULSE_NOT_FOUND, 404);

  const outcome = await build(pulse);
  if (!outcome.ok) return exportFailure(c, pulse.id, outcome.reason, outcome.responseCount);

  return download(c, outcome.value.csv, outcome.value.filename, 'text/csv; charset=utf-8');
}

adminExportRoutes.get('/:id/export/responses.csv', (c) =>
  csvRoute(c, (pulse) => exportResponsesCsv(c.env.DB, pulse)),
);

adminExportRoutes.get('/:id/export/free-text.csv', (c) =>
  csvRoute(c, (pulse) => exportFreeTextCsv(c.env.DB, pulse)),
);

adminExportRoutes.get('/:id/export/results.json', async (c) => {
  const pulse = await loadPulse(c);
  if (pulse === null) return c.json(PULSE_NOT_FOUND, 404);

  const outcome = await exportResultsJson(c.env.DB, pulse);
  if (!outcome.ok) return exportFailure(c, pulse.id, outcome.reason, outcome.responseCount);

  return download(
    c,
    JSON.stringify(outcome.value.body, null, 2),
    outcome.value.filename,
    'application/json; charset=utf-8',
  );
});
