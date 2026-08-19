/**
 * The admin authorization boundary.
 *
 * React route guards are navigation convenience only. THIS is the boundary:
 * every protected endpoint runs `requireAdmin`, and every state-changing admin
 * request runs `adminOriginGuard`. Both fail closed.
 */

import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../env.js';
import { checkRequestOrigin, isMutatingMethod } from '../lib/origin.js';
import { readSessionCookie, verifySession } from '../lib/session.js';

export const UNAUTHORIZED_BODY = { error: 'unauthorized' } as const;

/**
 * Rejects cross-origin state-changing requests before anything else runs, so a
 * rejected request never reaches validation, the database, or the passcode
 * derivation.
 */
export const adminOriginGuard: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (isMutatingMethod(c.req.method)) {
    const origin = c.req.header('origin') ?? null;
    if (checkRequestOrigin(c.req.url, origin) === 'rejected') {
      // The rejected origin is not echoed back.
      return c.json({ error: 'cross_origin_request_rejected' }, 403);
    }
  }
  await next();
  return;
};

/**
 * Requires a valid, unexpired, correctly signed session cookie.
 *
 * Expired, forged, malformed and absent sessions are all a plain 401 - the
 * client has nothing useful to do with the difference, and reporting it would
 * describe the deployment's state to an anonymous caller. A missing or unusable
 * SESSION_SECRET is also a 401: without a signing key no session can be valid.
 */
export const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = readSessionCookie(c.req.header('cookie'));
  const outcome = await verifySession(token, c.env.SESSION_SECRET, Date.now());

  if (outcome === 'misconfigured') {
    // Operational signal only. No secret, no cookie, no request body.
    console.error('Admin session secret is not configured');
    return c.json(UNAUTHORIZED_BODY, 401);
  }

  if (outcome !== 'valid') return c.json(UNAUTHORIZED_BODY, 401);

  await next();
  return;
};
