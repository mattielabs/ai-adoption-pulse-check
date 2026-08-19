/**
 * Phase 0 system routes.
 *
 * These exist to prove the infrastructure works end to end: Hono routing, the
 * D1 binding, environment handling, and JSON responses. Product endpoints from
 * spec section 58 are deliberately NOT implemented yet - they arrive with the
 * features that consume them.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { secretConfigured } from '../env.js';
import { checkDatabase } from '../lib/db.js';
import { ENGINE_VERSIONS, SUPPORTED_SURVEY_VERSIONS } from '../../core/versions.js';
import { SURVEY_QUESTIONS } from '../../core/survey/questions.js';

export const systemRoutes = new Hono<AppBindings>();

systemRoutes.get('/health', async (c) => {
  const database = await checkDatabase(c.env);
  const healthy = database.reachable && database.migrated;

  return c.json(
    {
      status: healthy ? 'ok' : 'degraded',
      environment: c.env.ENVIRONMENT ?? 'unknown',
      database,
      // Booleans only. The values themselves are never exposed or logged.
      secrets: {
        adminPasscodeHashConfigured: secretConfigured(c.env.ADMIN_PASSCODE_HASH),
        sessionSecretConfigured: secretConfigured(c.env.SESSION_SECRET),
      },
    },
    healthy ? 200 : 503,
  );
});

systemRoutes.get('/version', (c) =>
  c.json({
    ...ENGINE_VERSIONS,
    supportedSurveyVersions: SUPPORTED_SURVEY_VERSIONS,
    questionCount: SURVEY_QUESTIONS.length,
  }),
);
