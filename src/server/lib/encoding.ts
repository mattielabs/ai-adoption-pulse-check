/**
 * Byte/string encoding and constant-time comparison.
 *
 * Everything here uses only APIs present in BOTH the Worker runtime and plain
 * Node, so the authentication code that depends on it is unit-testable without
 * a Workers harness.
 */

const encoder = new TextEncoder();

export function utf8(value: string): Uint8Array {
  return encoder.encode(value);
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns null for anything that is not valid unpadded base64url. */
export function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;

  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    '=',
  );

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Timing-resistant byte comparison.
 *
 * The Worker runtime provides `crypto.subtle.timingSafeEqual`, which is what
 * runs in production and in `wrangler dev`. Plain Node (where the unit tests
 * run) does not expose it on SubtleCrypto, so a constant-time XOR accumulation
 * is used there instead. Both paths are tested.
 *
 * A length mismatch returns false immediately. That leaks only the length of
 * the STORED derived key - a fixed 32 bytes for every deployment - and never
 * anything about the submitted passcode.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;

  const native = (crypto.subtle as { timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean })
    .timingSafeEqual;
  if (typeof native === 'function') return native.call(crypto.subtle, a, b);

  let difference = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    difference |= (a[i] as number) ^ (b[i] as number);
  }
  return difference === 0;
}

/** Constant-time comparison of two ASCII/base64url strings of equal length. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  return timingSafeEqualBytes(utf8(a), utf8(b));
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return new Uint8Array(digest);
}

/** Cryptographically secure random bytes. Never `Math.random`. */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
