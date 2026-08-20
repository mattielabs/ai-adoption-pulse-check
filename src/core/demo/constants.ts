/**
 * The public demo's fixed, synthetic identity.
 *
 * Shared by the client and the Worker so the labelling cannot drift between
 * the page and the payload. Every string here describes an organization that
 * does not exist: no customer, no employer, no Mattie Labs client, and no
 * invented outcome. Phase 4 brief 26-28, 55.
 */

export const DEMO_ORGANIZATION_NAME = 'Northstar Services';

export const DEMO_PULSE_NAME = 'Northstar Services AI Adoption Pulse';

/** Shown wherever demo data is displayed. Short enough to sit in a badge. */
export const DEMO_BADGE = 'Synthetic demo organization';

export const DEMO_DATA_NOTICE =
  'Northstar Services is not a real company. Every response in this demo was generated from a committed synthetic fixture, and the analysis you see is produced by the same deterministic engine a self-hosted deployment runs.';

/**
 * The demo survey's local-only draft namespace.
 *
 * Real public Pulse ids are 128-bit values encoded in 22 URL-safe characters,
 * so this four-letter key cannot collide with one - the demo survey can never
 * read or write a real Pulse's draft, result snapshot or submission marker.
 */
export const DEMO_PULSE_PUBLIC_ID = 'demo';

export const DEMO_SURVEY_NOTICE = 'Demo only - your answers are not submitted.';
