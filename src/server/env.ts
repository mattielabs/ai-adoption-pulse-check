/**
 * Worker environment bindings.
 *
 * Secrets live only in `.dev.vars` locally and in `wrangler secret put` in
 * production. They are never committed, never written to D1, and never logged.
 * Spec 38, 59.
 *
 * `DB` is typed structurally (see lib/d1.ts) so server code is unit-testable
 * without the Workers global type surface; the real binding satisfies the
 * interface as-is.
 */

import type { D1DatabaseLike } from './lib/d1.js';
import type { RateLimitBinding } from './lib/throttle.js';

export interface Env {
  /** D1 binding. All queries are parameterized. */
  readonly DB: D1DatabaseLike;

  /**
   * Static asset binding for the built SPA. The platform serves assets before
   * the Worker for non-/api/* paths (run_worker_first), so application code
   * never calls this directly; it exists here to mirror wrangler.jsonc.
   */
  readonly ASSETS?: unknown;

  /** Non-secret configuration. */
  readonly ENVIRONMENT: string;

  // --- Secrets. ---
  /**
   * PBKDF2-HMAC-SHA256 salted hash of the deployment admin passcode, in the
   * single encoded format defined by lib/passcode.ts. There is deliberately no
   * plaintext `ADMIN_PASSCODE` variable anywhere in the application.
   */
  readonly ADMIN_PASSCODE_HASH?: string;
  /** HMAC key for signing short-lived admin session cookies. */
  readonly SESSION_SECRET?: string;

  /**
   * Cloudflare Rate Limiting binding protecting admin login. Optional because
   * it is a remote-only binding: `wrangler dev --local` cannot service it, so
   * local development runs without throttling (see lib/throttle.ts).
   */
  readonly ADMIN_LOGIN_LIMITER?: RateLimitBinding;
}

export type AppBindings = { Bindings: Env };

/**
 * Reports whether a secret is configured WITHOUT revealing any part of it.
 * Used by the health endpoint so a deployment can be checked without exposing
 * values in a response body or a log line.
 */
export function secretConfigured(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}
