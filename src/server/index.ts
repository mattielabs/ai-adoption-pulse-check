/**
 * The single Cloudflare Worker.
 *
 * It serves the API under /api/* and, via the `assets` binding configured in
 * wrangler.jsonc, the built SPA plus SPA fallback routing. There is no second
 * Worker, no separate API application, and no SSR. Spec 53.
 */

import { Hono } from 'hono';
import type { AppBindings } from './env.js';
import { systemRoutes } from './routes/system.js';

const app = new Hono<AppBindings>();

/**
 * Baseline response headers.
 *
 * The application renders organization names, custom question text and
 * free-text answers, so the defence-in-depth headers are set from the start
 * rather than retrofitted. Spec 59.
 */
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
});

app.route('/api', systemRoutes);

// Unknown API paths must not fall through to the SPA shell.
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

app.onError((error, c) => {
  // Log the class of failure, never the request body: a survey payload must not
  // reach the logs. Spec 59.
  console.error('Unhandled worker error', { name: error.name, message: error.message });
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
