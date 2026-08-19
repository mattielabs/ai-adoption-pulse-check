/**
 * Worker environment bindings.
 *
 * Secrets live only in `.dev.vars` locally and in `wrangler secret put` in
 * production. They are never committed, never written to D1, and never logged.
 * Spec 38, 59.
 */

export interface Env {
  /** D1 binding. All queries are parameterized. */
  readonly DB: D1Database;

  /** Static asset binding for the built SPA. */
  readonly ASSETS: Fetcher;

  /** Non-secret configuration. */
  readonly ENVIRONMENT: string;

  // --- Secrets. Consumed in Phase 2 (admin authentication). ---
  /** PBKDF2-HMAC-SHA256 salted hash of the deployment admin passcode. */
  readonly ADMIN_PASSCODE_HASH?: string;
  /** HMAC key for signing short-lived admin session cookies. */
  readonly SESSION_SECRET?: string;
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
