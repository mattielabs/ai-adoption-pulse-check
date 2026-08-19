/**
 * Organization configuration.
 *
 *   GET   /api/admin/organization  read the single organization (null on first run)
 *   POST  /api/admin/organization  first-run setup
 *   PATCH /api/admin/organization  edit settings
 *
 * V1 is a single-organization deployment (spec 37, brief 7). That is enforced
 * HERE, on the server: POST refuses once a row exists, and PATCH addresses the
 * existing row rather than one named in the request, so no admin call can
 * create or reach a second organization.
 *
 * Changing settings affects how future employee pages render. It never
 * rewrites stored responses.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { parseJsonBody } from '../lib/validation.js';
import { organizationInputSchema, MAX_ADMIN_PAYLOAD_BYTES } from '../../core/admin/schemas.js';
import { findOrganization, insertOrganization, updateOrganization } from '../lib/adminRepo.js';
import type { AdminOrganization } from '../../core/admin/contracts.js';

export const adminOrganizationRoutes = new Hono<AppBindings>();

adminOrganizationRoutes.get('/', async (c) => {
  const row = await findOrganization(c.env.DB);
  const organization: AdminOrganization | null =
    row === null
      ? null
      : {
          name: row.name,
          logoUrl: row.logo_url,
          accentColor: row.accent_color,
          surveyIntro: row.survey_intro,
        };

  return c.json({ organization });
});

adminOrganizationRoutes.post('/', async (c) => {
  const body = await parseJsonBody(c, organizationInputSchema, MAX_ADMIN_PAYLOAD_BYTES);
  if (!body.ok) return c.json(body.body, body.status);

  if ((await findOrganization(c.env.DB)) !== null) {
    return c.json({ error: 'organization_already_configured' }, 409);
  }

  await insertOrganization(c.env.DB, body.value);
  return c.json({ ok: true }, 201);
});

adminOrganizationRoutes.patch('/', async (c) => {
  const body = await parseJsonBody(c, organizationInputSchema, MAX_ADMIN_PAYLOAD_BYTES);
  if (!body.ok) return c.json(body.body, body.status);

  const existing = await findOrganization(c.env.DB);
  if (existing === null) return c.json({ error: 'organization_not_configured' }, 404);

  await updateOrganization(c.env.DB, existing.id, body.value);
  return c.json({ ok: true });
});
