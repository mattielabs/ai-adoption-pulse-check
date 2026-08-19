/**
 * Admin passcode hashing and verification.
 *
 * These test the APPLICATION'S USE of PBKDF2 - the encoded format, the work
 * factor, what counts as misconfiguration, and that comparison is not string
 * equality. They do not test PBKDF2 itself, which is the runtime's job.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPasscodeHash,
  formatPasscodeHash,
  parsePasscodeHash,
  PASSCODE_DERIVED_KEY_BYTES,
  PASSCODE_HASH_ALGORITHM,
  PASSCODE_SALT_BYTES,
  PBKDF2_ITERATIONS,
  verifyPasscode,
} from '../../src/server/lib/passcode.js';
import { fromBase64Url, timingSafeEqualBytes, toBase64Url } from '../../src/server/lib/encoding.js';

const PASSCODE = 'correct-horse-battery-staple';

// One derivation shared by the whole file: at 600,000 iterations each one
// costs real CPU, which is the entire point of the work factor.
let storedHash: string;

beforeAll(async () => {
  storedHash = await createPasscodeHash(PASSCODE);
}, 30_000);

describe('encoded hash format', () => {
  it('uses the single documented format', () => {
    const [algorithm, iterations, salt, key] = storedHash.split('$') as [string, string, string, string];

    expect(algorithm).toBe(PASSCODE_HASH_ALGORITHM);
    expect(iterations).toBe(String(PBKDF2_ITERATIONS));
    expect(fromBase64Url(salt)?.byteLength).toBe(PASSCODE_SALT_BYTES);
    expect(fromBase64Url(key)?.byteLength).toBe(PASSCODE_DERIVED_KEY_BYTES);
  });

  it('is URL-safe base64 with no padding', () => {
    expect(storedHash).toMatch(/^pbkdf2-sha256\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  });

  it('parses back to the mandated work factor', () => {
    const parsed = parsePasscodeHash(storedHash);
    expect(parsed?.iterations).toBe(600_000);
  });

  it('round-trips through format and parse', () => {
    const parsed = parsePasscodeHash(storedHash);
    expect(parsed).not.toBeNull();
    expect(formatPasscodeHash(parsed!)).toBe(storedHash);
  });

  it('uses a fresh random salt for every generated hash', async () => {
    const another = await createPasscodeHash(PASSCODE);
    expect(another).not.toBe(storedHash);
    expect(parsePasscodeHash(another)?.salt).not.toEqual(parsePasscodeHash(storedHash)?.salt);
  }, 30_000);
});

describe('parsePasscodeHash rejects malformed configuration', () => {
  const salt = toBase64Url(new Uint8Array(16));
  const key = toBase64Url(new Uint8Array(32));

  it.each([
    ['empty', ''],
    ['too few fields', `pbkdf2-sha256$600000$${salt}`],
    ['too many fields', `pbkdf2-sha256$600000$${salt}$${key}$extra`],
    ['unknown algorithm', `scrypt$600000$${salt}$${key}`],
    ['non-numeric iterations', `pbkdf2-sha256$many$${salt}$${key}`],
    ['work factor below the mandated minimum', `pbkdf2-sha256$100000$${salt}$${key}`],
    ['absurd work factor', `pbkdf2-sha256$99999999$${salt}$${key}`],
    ['salt too short', `pbkdf2-sha256$600000$${toBase64Url(new Uint8Array(8))}$${key}`],
    ['derived key of the wrong length', `pbkdf2-sha256$600000$${salt}$${toBase64Url(new Uint8Array(16))}`],
    ['non-base64url salt', `pbkdf2-sha256$600000$not+valid/base64url$${key}`],
  ])('rejects %s', (_label, encoded) => {
    expect(parsePasscodeHash(encoded)).toBeNull();
  });
});

describe('verifyPasscode', () => {
  it('accepts the correct passcode', async () => {
    expect(await verifyPasscode(PASSCODE, storedHash)).toBe('valid');
  }, 30_000);

  it('rejects an incorrect passcode', async () => {
    expect(await verifyPasscode('not-the-passcode-at-all', storedHash)).toBe('invalid');
  }, 30_000);

  it('rejects a passcode differing by one character', async () => {
    expect(await verifyPasscode(`${PASSCODE}!`, storedHash)).toBe('invalid');
  }, 30_000);

  it('reports missing configuration as misconfigured, not invalid', async () => {
    expect(await verifyPasscode(PASSCODE, undefined)).toBe('misconfigured');
    expect(await verifyPasscode(PASSCODE, '')).toBe('misconfigured');
  });

  it('reports a malformed stored hash as misconfigured', async () => {
    expect(await verifyPasscode(PASSCODE, 'pbkdf2-sha256$600000$bad')).toBe('misconfigured');
  });
});

describe('timing-resistant comparison', () => {
  it('matches identical byte strings', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeEqualBytes(a, b)).toBe(true);
  });

  it('rejects a difference in the final byte', () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2, 3, 5]))).toBe(false);
  });

  it('rejects a difference in the first byte', () => {
    expect(timingSafeEqualBytes(new Uint8Array([9, 2, 3, 4]), new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });

  it('rejects unequal lengths without throwing', () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('is used instead of string equality: a hash that differs only in the derived key fails', async () => {
    const parsed = parsePasscodeHash(storedHash)!;
    const tampered = new Uint8Array(parsed.derivedKey);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1]! ^ 0x01) & 0xff;

    const forged = formatPasscodeHash({ ...parsed, derivedKey: tampered });
    expect(await verifyPasscode(PASSCODE, forged)).toBe('invalid');
  }, 30_000);
});
