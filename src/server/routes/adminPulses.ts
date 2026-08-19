/**
 * Pulse lifecycle management.
 *
 *   GET    /api/admin/pulses          list
 *   POST   /api/admin/pulses          create (also the duplication path)
 *   GET    /api/admin/pulses/:id      operational detail
 *   PATCH  /api/admin/pulses/:id      edit what is still safe to edit
 *   POST   /api/admin/pulses/:id/close
 *   DELETE /api/admin/pulses/:id
 *
 * Two things this file is careful about:
 *
 *   1. Nothing here reads response CONTENT. The admin surface gets a count.
 *      Scores, recommendations, opportunities and free text are Phase 3.
 *
 *   2. Configuration that shaped what respondents actually saw is locked once
 *      the first response arrives, and the lock is enforced here rather than
 *      by disabling a React control. Collected data must stay interpretable
 *      against the configuration it was collected under (brief 31).
 *
 * Duplication has no endpoint of its own: the client prefills the create form
 * from an existing Pulse's detail and posts it through this same create path,
 * so there is exactly one implementation of "a Pulse comes into existence".
 */

import { Hono, type Context } from 'hono';
import type { AppBindings } from '../env.js';
import { parseJsonBody } from '../lib/validation.js';
import {
  MAX_ADMIN_PAYLOAD_BYTES,
  pulseCreateSchema,
  pulseUpdateSchema,
  type PulseUpdateInput,
} from '../../core/admin/schemas.js';
import {
  closePulse,
  countResponses,
  createPulse,
  deletePulse,
  findAdminPulse,
  findOrganization,
  listAdminCustomQuestions,
  listAdminPulses,
  replaceCustomQuestions,
  updatePulseFields,
  type AdminPulseRow,
  type PulseFieldUpdates,
} from '../lib/adminRepo.js';
import { todayUtcDate } from '../lib/dates.js';
import { computeOperationalState } from '../../core/pulse/status.js';
import {
  LOCKED_AFTER_FIRST_RESPONSE,
  type AdminPulseDetail,
  type AdminPulseSummary,
} from '../../core/admin/contracts.js';

export const adminPulseRoutes = new Hono<AppBindings>();

const PULSE_NOT_FOUND = { error: 'pulse_not_found' } as const;

function parsePulseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function toSummary(row: AdminPulseRow, today: string): AdminPulseSummary {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    state: computeOperationalState(
      { status: row.status, opensOn: row.opens_on, closesOn: row.closes_on },
      today,
    ),
    opensOn: row.opens_on,
    closesOn: row.closes_on,
    responseCount: row.response_count,
  };
}

async function loadPulse(c: Context<AppBindings>): Promise<AdminPulseRow | null> {
  const id = parsePulseId(c.req.param('id') ?? '');
  return id === null ? null : findAdminPulse(c.env.DB, id);
}

// --- list ------------------------------------------------------------------

adminPulseRoutes.get('/', async (c) => {
  const organization = await findOrganization(c.env.DB);
  if (organization === null) return c.json({ pulses: [] });

  const today = todayUtcDate();
  const rows = await listAdminPulses(c.env.DB, organization.id);
  return c.json({ pulses: rows.map((row) => toSummary(row, today)) });
});

// --- create ----------------------------------------------------------------

adminPulseRoutes.post('/', async (c) => {
  const body = await parseJsonBody(c, pulseCreateSchema, MAX_ADMIN_PAYLOAD_BYTES);
  if (!body.ok) return c.json(body.body, body.status);

  const organization = await findOrganization(c.env.DB);
  if (organization === null) return c.json({ error: 'organization_not_configured' }, 409);

  const publicId = await createPulse(c.env.DB, {
    organizationId: organization.id,
    name: body.value.name,
    description: body.value.description,
    opensOn: body.value.opensOn,
    closesOn: body.value.closesOn,
    personalResultsEnabled: body.value.personalResultsEnabled,
    customQuestions: body.value.customQuestions,
  });

  const created = await c.env.DB.prepare('SELECT id FROM pulses WHERE public_id = ?')
    .bind(publicId)
    .first<{ id: number }>();

  return c.json({ id: created?.id ?? null, publicId }, 201);
});

// --- detail ----------------------------------------------------------------

adminPulseRoutes.get('/:id', async (c) => {
  const row = await loadPulse(c);
  if (row === null) return c.json(PULSE_NOT_FOUND, 404);

  const customQuestions = await listAdminCustomQuestions(c.env.DB, row.id);
  const detail: AdminPulseDetail = {
    ...toSummary(row, todayUtcDate()),
    description: row.description,
    personalResultsEnabled: row.personal_results_enabled === 1,
    surveyVersion: row.survey_version,
    customQuestions,
    configurationEditable: row.response_count === 0,
  };

  return c.json(detail);
});

// --- edit ------------------------------------------------------------------

function lockedFieldsIn(updates: PulseUpdateInput): readonly string[] {
  return LOCKED_AFTER_FIRST_RESPONSE.filter((field) => field in updates);
}

adminPulseRoutes.patch('/:id', async (c) => {
  const body = await parseJsonBody(c, pulseUpdateSchema, MAX_ADMIN_PAYLOAD_BYTES);
  if (!body.ok) return c.json(body.body, body.status);

  const row = await loadPulse(c);
  if (row === null) return c.json(PULSE_NOT_FOUND, 404);

  const updates = body.value;

  // Re-read the count rather than trusting the joined value: this is the
  // decision that protects already-collected data.
  const responseCount = await countResponses(c.env.DB, row.id);
  if (responseCount > 0) {
    const locked = lockedFieldsIn(updates);
    if (locked.length > 0) {
      return c.json({ error: 'pulse_configuration_locked', fields: locked }, 409);
    }
  }

  // A closing date must still not precede the opening date the Pulse actually
  // has, which the request may not have restated.
  const effectiveOpensOn = updates.opensOn ?? row.opens_on;
  const effectiveClosesOn = updates.closesOn === undefined ? row.closes_on : updates.closesOn;
  if (
    effectiveOpensOn !== null &&
    effectiveClosesOn !== null &&
    effectiveClosesOn < effectiveOpensOn
  ) {
    return c.json(
      {
        error: 'validation_failed',
        issues: [{ path: 'closesOn', message: 'The closing date cannot be before the opening date' }],
      },
      400,
    );
  }

  const fields: PulseFieldUpdates = {};
  if ('name' in updates) fields.name = updates.name ?? null;
  if ('description' in updates) fields.description = updates.description ?? null;
  if ('opensOn' in updates) fields.opensOn = updates.opensOn ?? null;
  if ('closesOn' in updates) fields.closesOn = updates.closesOn ?? null;
  if ('personalResultsEnabled' in updates) {
    fields.personalResultsEnabled = updates.personalResultsEnabled === true ? 1 : 0;
  }

  await updatePulseFields(c.env.DB, row.id, fields);

  if (updates.customQuestions !== undefined) {
    await replaceCustomQuestions(c.env.DB, row.id, row.public_id, updates.customQuestions);
  }

  return c.json({ ok: true });
});

// --- close -----------------------------------------------------------------

adminPulseRoutes.post('/:id/close', async (c) => {
  const row = await loadPulse(c);
  if (row === null) return c.json(PULSE_NOT_FOUND, 404);

  // Closing is irreversible in V1, so a second close is reported rather than
  // silently re-stamping `closed_at`.
  if (row.status === 'closed') return c.json({ error: 'pulse_already_closed' }, 409);

  await closePulse(c.env.DB, row.id);
  return c.json({ ok: true });
});

// --- delete ----------------------------------------------------------------

adminPulseRoutes.delete('/:id', async (c) => {
  const row = await loadPulse(c);
  if (row === null) return c.json(PULSE_NOT_FOUND, 404);

  await deletePulse(c.env.DB, row.id);
  return c.json({ ok: true });
});
