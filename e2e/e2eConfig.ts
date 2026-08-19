/**
 * Shared configuration for the end-to-end run.
 *
 * The passcode below is a LOCAL TEST FIXTURE, not a credential. It never
 * reaches a deployment: `scripts/e2e-server.ts` derives a throwaway hash from
 * it at start-up and passes that to a throwaway local Worker, against a
 * throwaway D1 database in `.wrangler/e2e-state`. Nothing here is used by
 * `npm run dev`, by a build, or by anything that ships.
 */

export const E2E_PORT = 8788;

export const E2E_ADMIN_PASSCODE = 'local-e2e-passcode-not-a-secret';

/** Where the setup project records the Pulses it provisioned. */
export const E2E_PULSE_IDS_FILE = 'e2e/.pulse-ids.json';

/**
 * The Pulses the suite provisions.
 *
 * The three `results*` entries carry real responses so the dashboard can be
 * exercised at each sample state: below the reporting threshold, in the
 * early-directional band, and with the full canonical fixture.
 */
export const E2E_PULSE_KEYS = [
  'active',
  'plain',
  'noResult',
  'closed',
  'future',
  'results',
  'resultsSmall',
  'resultsEarly',
] as const;

export type E2EPulseKey = (typeof E2E_PULSE_KEYS)[number];
