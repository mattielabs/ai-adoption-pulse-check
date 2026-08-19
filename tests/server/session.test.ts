/**
 * Signed admin session tokens and the cookie that carries them.
 */

import { describe, expect, it } from 'vitest';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  isUsableSessionSecret,
  issueSession,
  readSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_SECONDS,
  verifySession,
} from '../../src/server/lib/session.js';
import { fromBase64Url, toBase64Url, utf8 } from '../../src/server/lib/encoding.js';

const SECRET = 'a'.repeat(48);
const OTHER_SECRET = 'b'.repeat(48);
const NOW = Date.UTC(2026, 7, 19, 9, 0, 0);

describe('issueSession', () => {
  it('produces a two-part token', async () => {
    const { token } = await issueSession(SECRET, NOW);
    expect(token.split('.')).toHaveLength(2);
  });

  it('expires eight hours after issue', async () => {
    const session = await issueSession(SECRET, NOW);
    expect(session.maxAgeSeconds).toBe(SESSION_LIFETIME_SECONDS);
    expect(session.expiresAt - Math.floor(NOW / 1000)).toBe(8 * 60 * 60);
  });

  it('carries only a version and two timestamps - no employee or admin data', async () => {
    const { token } = await issueSession(SECRET, NOW);
    const payload = fromBase64Url(token.split('.')[0] as string);
    const decoded = JSON.parse(new TextDecoder().decode(payload!)) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'v']);
    expect(JSON.stringify(decoded)).not.toContain(SECRET);
  });
});

describe('verifySession', () => {
  it('accepts a freshly issued token', async () => {
    const { token } = await issueSession(SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW)).toBe('valid');
  });

  it('rejects a token signed with a different secret', async () => {
    const { token } = await issueSession(OTHER_SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW)).toBe('invalid');
  });

  it('rejects a tampered payload', async () => {
    const { token } = await issueSession(SECRET, NOW);
    const signature = token.split('.')[1] as string;
    const forgedPayload = toBase64Url(
      utf8(JSON.stringify({ v: 1, iat: Math.floor(NOW / 1000), exp: Math.floor(NOW / 1000) + 60 })),
    );

    expect(await verifySession(`${forgedPayload}.${signature}`, SECRET, NOW)).toBe('invalid');
  });

  it('rejects a tampered signature', async () => {
    const { token } = await issueSession(SECRET, NOW);
    const [payload, signature] = token.split('.') as [string, string];
    const flipped = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

    expect(await verifySession(`${payload}.${flipped}`, SECRET, NOW)).toBe('invalid');
  });

  it('reports an expired token as expired', async () => {
    const { token } = await issueSession(SECRET, NOW);
    const later = NOW + (SESSION_LIFETIME_SECONDS + 1) * 1000;
    expect(await verifySession(token, SECRET, later)).toBe('expired');
  });

  it('is still valid one second before expiry', async () => {
    const { token } = await issueSession(SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW + (SESSION_LIFETIME_SECONDS - 1) * 1000)).toBe('valid');
  });

  it('rejects a self-signed token claiming a longer lifetime', async () => {
    const issuedAt = Math.floor(NOW / 1000);
    const payload = toBase64Url(
      utf8(JSON.stringify({ v: 1, iat: issuedAt, exp: issuedAt + 30 * 24 * 3600 })),
    );
    // Signed with the real secret, but the lifetime exceeds the maximum.
    const { token } = await issueSession(SECRET, NOW);
    const realSignature = token.split('.')[1] as string;

    // Even with a valid-looking structure the signature will not match the
    // forged payload, and the lifetime cap catches it if it ever did.
    expect(await verifySession(`${payload}.${realSignature}`, SECRET, NOW)).toBe('invalid');
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['no separator', 'not-a-token'],
    ['empty payload', '.signature'],
    ['empty signature', 'payload.'],
    ['non-base64url', 'pay!load.sig!nature'],
    ['absurdly long', `${'a'.repeat(600)}.${'b'.repeat(600)}`],
  ])('rejects a %s token', async (_label, token) => {
    expect(await verifySession(token, SECRET, NOW)).toBe('invalid');
  });

  it('reports a missing or weak signing secret as misconfigured', async () => {
    const { token } = await issueSession(SECRET, NOW);
    expect(await verifySession(token, undefined, NOW)).toBe('misconfigured');
    expect(await verifySession(token, 'short', NOW)).toBe('misconfigured');
  });

  it('accepts a secret of at least 32 characters', () => {
    expect(isUsableSessionSecret('x'.repeat(31))).toBe(false);
    expect(isUsableSessionSecret('x'.repeat(32))).toBe(true);
    expect(isUsableSessionSecret(undefined)).toBe(false);
  });
});

describe('session cookie', () => {
  it('is HttpOnly, Secure, SameSite=Strict and path-scoped', () => {
    const cookie = buildSessionCookie('token-value', 100);

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token-value`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=100');
  });

  it('is cleared with an immediate expiry', () => {
    const cookie = buildClearedSessionCookie();
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });

  it('reads the token out of a multi-cookie header', () => {
    expect(readSessionCookie(`other=1; ${SESSION_COOKIE_NAME}=abc.def; another=2`)).toBe('abc.def');
  });

  it('returns null when the cookie is absent, empty or malformed', () => {
    expect(readSessionCookie(null)).toBeNull();
    expect(readSessionCookie('')).toBeNull();
    expect(readSessionCookie('other=1')).toBeNull();
    expect(readSessionCookie(`${SESSION_COOKIE_NAME}=`)).toBeNull();
    expect(readSessionCookie('novalue')).toBeNull();
  });

  it('does not match a differently named cookie with the same suffix', () => {
    expect(readSessionCookie(`not_${SESSION_COOKIE_NAME}=abc`)).toBeNull();
  });
});
