/**
 * Organization results.
 *
 *   GET /api/admin/pulses/:id/results            the whole dashboard payload
 *   GET /api/admin/pulses/:id/results/free-text  Q27, isolated
 *
 * Both are read-only and both sit behind the admin session, applied by the
 * router in admin.ts rather than repeated here.
 *
 * One payload serves the whole dashboard rather than an endpoint per card:
 * every view is derived from a single `runAnalysis` pass over the same
 * responses, so splitting it would mean re-reading and re-analysing the same
 * rows several times to render one screen.
 *
 * Free text is the exception, and deliberately so. It has its own endpoint,
 * its own query, and its own type, because the only thing keeping a written
 * answer from being matched to a department is that they are never fetched
 * together.
 */

import { Hono, type Context } from 'hono';
import type { AppBindings } from '../env.js';
import { findAdminPulse } from '../lib/adminRepo.js';
import { buildFreeText, buildResults, type ResultsFailureReason } from '../lib/results.js';
import type { SegmentFilter } from '../../core/privacy/segmentation.js';
import type { SegmentationDimension } from '../../core/privacy/thresholds.js';

export const adminResultsRoutes = new Hono<AppBindings>();

const PULSE_NOT_FOUND = { error: 'pulse_not_found' } as const;

function parsePulseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadPulse(c: Context<AppBindings>) {
  const id = parsePulseId(c.req.param('id') ?? '');
  return id === null ? null : findAdminPulse(c.env.DB, id);
}

/**
 * Reads segment filters from the query string.
 *
 * Filters arrive as parallel `dimension` / `value` pairs, so a caller CAN
 * express a stacked request - and that matters: the one-dimension rule is
 * enforced by `applySegmentation`, and refusing to represent a second filter
 * here would mean the guard was never actually exercised. An unknown dimension
 * is likewise passed through for core to reject, so there is exactly one place
 * that decides what a valid segmentation request is.
 */
function parseFilters(c: Context<AppBindings>): readonly SegmentFilter[] | null {
  const dimensions = c.req.queries('dimension') ?? [];
  const values = c.req.queries('value') ?? [];

  if (dimensions.length === 0 && values.length === 0) return [];
  if (dimensions.length !== values.length) return null;

  return dimensions.map((dimension, index) => ({
    // Cast, not validation: core owns the definition of a valid dimension.
    dimension: dimension as SegmentationDimension,
    value: values[index] as string,
  }));
}

function analysisFailure(c: Context<AppBindings>, pulseId: number, reason: ResultsFailureReason) {
  // Pulse id and failure class only. Never an answer, never free text.
  console.error('Pulse analysis failed', { pulseId, reason });
  return c.json({ error: 'analysis_failed', reason }, 500);
}

adminResultsRoutes.get('/:id/results', async (c) => {
  const pulse = await loadPulse(c);
  if (pulse === null) return c.json(PULSE_NOT_FOUND, 404);

  const filters = parseFilters(c);
  if (filters === null) {
    return c.json(
      {
        error: 'validation_failed',
        issues: [{ path: 'value', message: 'Each dimension needs a matching value' }],
      },
      400,
    );
  }

  const outcome = await buildResults(c.env.DB, pulse, filters);
  if (!outcome.ok) return analysisFailure(c, pulse.id, outcome.reason);

  return c.json(outcome.value);
});

adminResultsRoutes.get('/:id/results/free-text', async (c) => {
  const pulse = await loadPulse(c);
  if (pulse === null) return c.json(PULSE_NOT_FOUND, 404);

  // Takes no filter arguments at all. Free text is never segmentable.
  return c.json(await buildFreeText(c.env.DB, pulse));
});
