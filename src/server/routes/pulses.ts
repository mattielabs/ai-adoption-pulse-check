/**
 * Public Pulse routes - the only API surface the employee experience needs.
 *
 *   GET  /api/pulses/:publicId            public survey configuration
 *   POST /api/pulses/:publicId/responses  submit one completed response
 *
 * The server is authoritative for availability: an employee holding a page
 * that was loaded while the Pulse was open cannot submit after it closes.
 *
 * Invalid, unknown, and draft public ids all return the identical generic 404
 * used by every unknown /api path, so an id cannot be probed for existence.
 * Spec 8-9 (Phase 1 brief), 41-42, 59.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { parseJsonBody } from '../lib/validation.js';
import { todayUtcDate } from '../lib/dates.js';
import {
  findPulseByPublicId,
  insertResponse,
  listPublicCustomQuestions,
  type PulseRow,
} from '../lib/pulseRepo.js';
import { computeAvailability, type PulseAvailability } from '../../core/pulse/availability.js';
import type { PublicPulse } from '../../core/pulse/publicPulse.js';
import { validateCustomAnswers } from '../../core/survey/customQuestions.js';
import { responseSubmissionSchema } from '../../core/survey/validation.js';

export const pulseRoutes = new Hono<AppBindings>();

const NOT_FOUND_BODY = { error: 'not_found' } as const;

function availabilityOf(row: PulseRow): PulseAvailability {
  return computeAvailability(
    { status: row.status, opensOn: row.opens_on, closesOn: row.closes_on },
    todayUtcDate(),
  );
}

pulseRoutes.get('/:publicId', async (c) => {
  const publicId = c.req.param('publicId');
  const row = await findPulseByPublicId(c.env.DB, publicId);
  if (row === null) return c.json(NOT_FOUND_BODY, 404);

  const availability = availabilityOf(row);
  // Draft (or otherwise unpublished) Pulses are indistinguishable from ids
  // that never existed.
  if (availability === 'not_found') return c.json(NOT_FOUND_BODY, 404);

  const customQuestions = await listPublicCustomQuestions(c.env.DB, row.id);

  const pulse: PublicPulse = {
    publicId: row.public_id,
    name: row.name,
    description: row.description,
    availability,
    opensOn: row.opens_on,
    closesOn: row.closes_on,
    personalResultsEnabled: row.personal_results_enabled === 1,
    surveyVersion: row.survey_version,
    organization: {
      name: row.org_name,
      logoUrl: row.logo_url,
      accentColor: row.accent_color,
      surveyIntro: row.survey_intro,
    },
    customQuestions,
  };

  return c.json(pulse);
});

pulseRoutes.post('/:publicId/responses', async (c) => {
  // Size gate and schema validation run before any database work, so an
  // oversized or malformed payload costs nothing and reveals nothing.
  const body = await parseJsonBody(c, responseSubmissionSchema);
  if (!body.ok) return c.json(body.body, body.status);

  const publicId = c.req.param('publicId');
  const row = await findPulseByPublicId(c.env.DB, publicId);
  if (row === null) return c.json(NOT_FOUND_BODY, 404);

  const availability = availabilityOf(row);
  if (availability === 'not_found') return c.json(NOT_FOUND_BODY, 404);
  if (availability !== 'available') {
    return c.json({ error: 'not_accepting_responses', reason: availability }, 409);
  }

  // The response must have been collected under the survey version this Pulse
  // runs. A stale client (open across a version upgrade) must refresh rather
  // than store answers whose semantics do not match the Pulse's version.
  if (body.value.surveyVersion !== row.survey_version) {
    return c.json({ error: 'survey_version_mismatch' }, 409);
  }

  const customQuestions = await listPublicCustomQuestions(c.env.DB, row.id);
  const customAnswers = validateCustomAnswers(customQuestions, body.value.customAnswers);
  if (!customAnswers.ok) {
    // Keys and messages only - submitted values are never echoed back.
    return c.json(
      {
        error: 'validation_failed',
        issues: customAnswers.issues.map((i) => ({ path: `customAnswers.${i.key}`, message: i.message })),
      },
      400,
    );
  }

  const hasCustomAnswers = Object.keys(customAnswers.value).length > 0;

  await insertResponse(c.env.DB, {
    pulseId: row.id,
    submittedOn: todayUtcDate(),
    surveyVersion: body.value.surveyVersion,
    answersJson: JSON.stringify(body.value.answers),
    customAnswersJson: hasCustomAnswers ? JSON.stringify(customAnswers.value) : null,
  });

  return c.json({ ok: true }, 201);
});
