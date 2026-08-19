/**
 * Admin session endpoints.
 *
 *   POST /api/admin/login    exchange the deployment passcode for a session
 *   POST /api/admin/logout   clear the session cookie
 *   GET  /api/admin/session  report authentication + first-run state
 *
 * Nothing in this file logs the submitted passcode, the stored hash, the
 * session secret, or the issued cookie. Spec 38, 59; brief 45.
 */

import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { parseJsonBody } from '../lib/validation.js';
import { adminLoginSchema, MAX_ADMIN_PAYLOAD_BYTES } from '../../core/admin/schemas.js';
import { verifyPasscode } from '../lib/passcode.js';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  isUsableSessionSecret,
  issueSession,
} from '../lib/session.js';
import {
  cloudflareLoginThrottle,
  loginThrottleKey,
  openLoginThrottle,
  type LoginThrottle,
} from '../lib/throttle.js';
import { findOrganization } from '../lib/adminRepo.js';
import type { AdminSessionState } from '../../core/admin/contracts.js';

export const adminAuthRoutes = new Hono<AppBindings>();

/**
 * One generic failure for every credential outcome: wrong passcode, a passcode
 * that failed the length gate, a malformed field. Nothing distinguishes them.
 */
const INVALID_CREDENTIALS = { error: 'invalid_credentials' } as const;

/** Logged at most once per isolate so a limiter outage cannot flood the logs. */
let limiterFailureLogged = false;

function throttleFor(env: AppBindings['Bindings']): LoginThrottle {
  const binding = env.ADMIN_LOGIN_LIMITER;
  if (binding === undefined) return openLoginThrottle;

  return cloudflareLoginThrottle(binding, () => {
    if (limiterFailureLogged) return;
    limiterFailureLogged = true;
    // No key, no address, no request data - just the operational fact.
    console.error('Admin login rate limiter unavailable; login proceeded unthrottled');
  });
}

adminAuthRoutes.post('/login', async (c) => {
  const body = await parseJsonBody(c, adminLoginSchema, MAX_ADMIN_PAYLOAD_BYTES);
  if (!body.ok) {
    // Size and syntax problems are reported honestly; anything that says
    // something about the passcode itself collapses to the generic failure.
    if (body.body.error === 'validation_failed') return c.json(INVALID_CREDENTIALS, 401);
    return c.json(body.body, body.status);
  }

  const throttle = throttleFor(c.env);
  const key = await loginThrottleKey(
    c.req.header('cf-connecting-ip') ?? null,
    c.env.SESSION_SECRET ?? 'pulse-check',
  );

  if (!(await throttle.consume(key))) {
    return c.json({ error: 'too_many_attempts' }, 429);
  }

  const outcome = await verifyPasscode(body.value.passcode, c.env.ADMIN_PASSCODE_HASH);

  if (outcome === 'misconfigured' || !isUsableSessionSecret(c.env.SESSION_SECRET)) {
    // The operator needs to know their deployment is incomplete. The client is
    // told only that the server failed.
    console.error('Admin authentication is not configured correctly');
    return c.json({ error: 'server_not_configured' }, 500);
  }

  if (outcome === 'invalid') {
    // A failed attempt costs a second unit of budget, so guessing exhausts the
    // allowance roughly twice as fast as legitimate use.
    await throttle.consume(key);
    return c.json(INVALID_CREDENTIALS, 401);
  }

  const session = await issueSession(c.env.SESSION_SECRET, Date.now());
  c.header('Set-Cookie', buildSessionCookie(session.token, session.maxAgeSeconds));

  const organization = await findOrganization(c.env.DB);
  const state: AdminSessionState = {
    authenticated: true,
    organizationConfigured: organization !== null,
  };
  return c.json(state);
});

adminAuthRoutes.post('/logout', (c) => {
  // Unconditional: clearing a cookie needs no session, and refusing an expired
  // one would leave the stale cookie in place.
  c.header('Set-Cookie', buildClearedSessionCookie());
  return c.json({ ok: true });
});

// Protection comes from the router in admin.ts, which applies `requireAdmin`
// to every admin path outside its explicit allowlist.
adminAuthRoutes.get('/session', async (c) => {
  const organization = await findOrganization(c.env.DB);
  const state: AdminSessionState = {
    authenticated: true,
    organizationConfigured: organization !== null,
  };
  return c.json(state);
});
