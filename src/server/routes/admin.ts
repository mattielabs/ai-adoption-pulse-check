/**
 * The admin API router.
 *
 * Structured so that protection is the DEFAULT: origin checking runs on every
 * state-changing request, and session verification runs on everything except a
 * short, explicit allowlist. A route added here later is protected unless
 * somebody deliberately adds its path to that list, which is the opposite of
 * the usual "remember to add the auth middleware" arrangement.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { adminOriginGuard, requireAdmin } from '../middleware/admin.js';
import { adminAuthRoutes } from './adminAuth.js';
import { adminOrganizationRoutes } from './adminOrganization.js';
import { adminPulseRoutes } from './adminPulses.js';
import { adminResultsRoutes } from './adminResults.js';

/**
 * The only admin endpoints reachable without a session.
 *
 *   /login  - by definition, it is how a session is obtained.
 *   /logout - clearing a cookie needs no proof of authentication, and
 *             requiring one would strand an expired cookie in the browser.
 */
export const UNAUTHENTICATED_ADMIN_PATHS: readonly string[] = [
  '/api/admin/login',
  '/api/admin/logout',
];

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.use('*', adminOriginGuard);

adminRoutes.use('*', async (c, next) => {
  if (UNAUTHENTICATED_ADMIN_PATHS.includes(c.req.path)) {
    await next();
    return;
  }
  return requireAdmin(c, next);
});

adminRoutes.route('/', adminAuthRoutes);
adminRoutes.route('/organization', adminOrganizationRoutes);
// Results first: both routers live under /pulses, and the more specific
// `/:id/results` paths must not be shadowed by the lifecycle routes.
adminRoutes.route('/pulses', adminResultsRoutes);
adminRoutes.route('/pulses', adminPulseRoutes);
