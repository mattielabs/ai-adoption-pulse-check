/**
 * The public demo API.
 *
 *   GET /api/demo/results            the synthetic organization's analysis
 *   GET /api/demo/results/free-text  the synthetic written responses
 *
 * Public on purpose - the demo exists so that a reviewer can understand the
 * product without an account, a Cloudflare project, or a local checkout.
 *
 * That is only safe because of what these handlers cannot do. Neither takes a
 * path parameter, a query parameter or a body; neither touches `c.env.DB`; and
 * the module they call holds no reference to a database at all. There is no
 * `/api/demo/results?pulseId=...` to add later without deleting that property
 * on purpose. Phase 4 brief 29-30.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { buildDemoFreeText, buildDemoResults } from '../lib/demo.js';

export const demoRoutes = new Hono<AppBindings>();

demoRoutes.get('/results', (c) => c.json(buildDemoResults()));

demoRoutes.get('/results/free-text', (c) => c.json(buildDemoFreeText()));
