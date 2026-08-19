/**
 * Public Pulse identifiers.
 *
 * The public id is the ONLY thing standing between an outsider and an
 * organization's survey, so it must be unguessable rather than merely unique:
 * 16 bytes (128 bits) from the runtime CSPRNG, encoded base64url into 22
 * URL-safe characters. Spec 41, 59.
 *
 * Nothing derived from the Pulse name, the organization, a counter, or a clock
 * is used as input - those would make one link a hint about the next.
 *
 * The unique index on `pulses.public_id` remains the final collision guard;
 * generation retries a small bounded number of times if the database ever
 * reports one.
 */

import { randomBytes, toBase64Url } from './encoding.js';

export const PUBLIC_ID_ENTROPY_BYTES = 16;
/** base64url of 16 bytes, unpadded. */
export const PUBLIC_ID_LENGTH = 22;
export const PUBLIC_ID_MAX_ATTEMPTS = 5;

export function generatePublicId(): string {
  return toBase64Url(randomBytes(PUBLIC_ID_ENTROPY_BYTES));
}

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Shape check for generated ids. Seeded `dev-*` ids intentionally fail it. */
export function isGeneratedPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}
