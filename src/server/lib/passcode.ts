/**
 * Deployment admin passcode hashing and verification.
 *
 * V1 has ONE deployment-level passcode - no usernames, no account rows, no
 * recovery. The plaintext passcode never leaves the request handler, is never
 * stored, and is never logged. Only the derived hash configuration is held, as
 * the `ADMIN_PASSCODE_HASH` Worker secret. Spec 38, 59.
 *
 * Encoded format (one format, parsed in exactly one place):
 *
 *   pbkdf2-sha256$600000$<base64url salt>$<base64url derived key>
 *
 * PBKDF2-HMAC-SHA256 at 600,000 iterations costs roughly half a second of
 * Worker CPU per login attempt, measured against workerd. That is the point:
 * it is what makes an offline attack on a leaked hash expensive. It also means
 * login is deliberately the slowest endpoint in the application, and that
 * throttling matters (throttle.ts).
 */

import {
  fromBase64Url,
  randomBytes,
  timingSafeEqualBytes,
  toBase64Url,
  utf8,
} from './encoding.js';

export const PASSCODE_HASH_ALGORITHM = 'pbkdf2-sha256';
export const PBKDF2_ITERATIONS = 600_000;
export const PASSCODE_SALT_BYTES = 16;
export const PASSCODE_DERIVED_KEY_BYTES = 32;

/**
 * A stored hash weaker than the mandated work factor is treated as
 * misconfiguration rather than silently accepted. The upper bound stops a
 * corrupted or hostile secret from turning every login into a CPU bomb.
 */
const MAX_ACCEPTED_ITERATIONS = 2_000_000;

export interface ParsedPasscodeHash {
  readonly iterations: number;
  readonly salt: Uint8Array;
  readonly derivedKey: Uint8Array;
}

/**
 * Parses the stored configuration. Returns null for ANY malformed value - the
 * caller must not distinguish the reasons to the client, because "your hash is
 * malformed" told to an anonymous visitor is a deployment-state oracle.
 */
export function parsePasscodeHash(encoded: string): ParsedPasscodeHash | null {
  const parts = encoded.split('$');
  if (parts.length !== 4) return null;

  const [algorithm, iterationsRaw, saltRaw, keyRaw] = parts as [string, string, string, string];
  if (algorithm !== PASSCODE_HASH_ALGORITHM) return null;

  if (!/^\d+$/.test(iterationsRaw)) return null;
  const iterations = Number(iterationsRaw);
  if (iterations < PBKDF2_ITERATIONS || iterations > MAX_ACCEPTED_ITERATIONS) return null;

  const salt = fromBase64Url(saltRaw);
  const derivedKey = fromBase64Url(keyRaw);
  if (salt === null || derivedKey === null) return null;
  if (salt.byteLength < PASSCODE_SALT_BYTES) return null;
  if (derivedKey.byteLength !== PASSCODE_DERIVED_KEY_BYTES) return null;

  return { iterations, salt, derivedKey };
}

export function formatPasscodeHash(parsed: ParsedPasscodeHash): string {
  return [
    PASSCODE_HASH_ALGORITHM,
    String(parsed.iterations),
    toBase64Url(parsed.salt),
    toBase64Url(parsed.derivedKey),
  ].join('$');
}

async function deriveBits(
  passcode: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8(passcode) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      iterations,
    },
    keyMaterial,
    PASSCODE_DERIVED_KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
}

/** Generates a fresh salted hash. Used by the setup CLI and by tests. */
export async function createPasscodeHash(passcode: string): Promise<string> {
  const salt = randomBytes(PASSCODE_SALT_BYTES);
  const derivedKey = await deriveBits(passcode, salt, PBKDF2_ITERATIONS);
  return formatPasscodeHash({ iterations: PBKDF2_ITERATIONS, salt, derivedKey });
}

export type PasscodeVerification =
  /** The passcode matches. */
  | 'valid'
  /** The passcode does not match. Indistinguishable from every other failure. */
  | 'invalid'
  /** ADMIN_PASSCODE_HASH is absent or unparseable - an operator problem. */
  | 'misconfigured';

/**
 * Verifies a submitted passcode against the stored configuration.
 *
 * The derived bytes are compared with a timing-resistant primitive, never with
 * `===`. Nothing about the stored salt, work factor, or derived key is
 * revealed by the outcome.
 */
export async function verifyPasscode(
  passcode: string,
  storedHash: string | undefined,
): Promise<PasscodeVerification> {
  if (storedHash === undefined || storedHash.length === 0) return 'misconfigured';

  const parsed = parsePasscodeHash(storedHash);
  if (parsed === null) return 'misconfigured';

  const candidate = await deriveBits(passcode, parsed.salt, parsed.iterations);
  return timingSafeEqualBytes(candidate, parsed.derivedKey) ? 'valid' : 'invalid';
}
