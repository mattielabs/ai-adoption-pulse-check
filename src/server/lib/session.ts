/**
 * Stateless admin sessions.
 *
 * There is no admin session table. A session is a signed statement of "an
 * administrator authenticated at T and that statement stops being accepted at
 * T+8h", and D1 holds survey data only. That keeps every login-related write
 * out of the database the employee responses live in.
 *
 * Token shape:  <base64url(payload JSON)>.<base64url(HMAC-SHA256)>
 * Payload:      { v, iat, exp }  - version and two unix timestamps, nothing else.
 *
 * The payload deliberately carries NO employee data, NO passcode material, and
 * no organization state. It is not encrypted, only signed: anyone holding the
 * cookie can read the two timestamps, which are not secrets.
 *
 * Consequences worth stating plainly:
 *   - rotating SESSION_SECRET invalidates every issued session immediately;
 *   - rotating only the admin passcode does NOT, because nothing in the token
 *     is derived from the passcode. An already-issued session stays valid
 *     until it expires (spec 38, brief 14).
 */

import { fromBase64Url, timingSafeEqualBytes, toBase64Url, utf8 } from './encoding.js';

export const SESSION_COOKIE_NAME = 'pulse_admin_session';

/** 8 hours. Long enough for a working session, short enough to matter. */
export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

export const SESSION_VERSION = 1;

/** A signing key shorter than this is treated as misconfiguration. */
const MIN_SESSION_SECRET_LENGTH = 32;

/** Bounds the work done on an attacker-supplied cookie. */
const MAX_TOKEN_LENGTH = 512;

interface SessionPayload {
  readonly v: number;
  readonly iat: number;
  readonly exp: number;
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    utf8(secret) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sign(payloadPart: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, utf8(payloadPart) as unknown as ArrayBuffer);
  return toBase64Url(new Uint8Array(signature));
}

export function isUsableSessionSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= MIN_SESSION_SECRET_LENGTH;
}

export interface IssuedSession {
  readonly token: string;
  /** Unix seconds. Also the cookie's expiry. */
  readonly expiresAt: number;
  readonly maxAgeSeconds: number;
}

export async function issueSession(secret: string, nowMs: number): Promise<IssuedSession> {
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + SESSION_LIFETIME_SECONDS;

  const payload: SessionPayload = { v: SESSION_VERSION, iat: issuedAt, exp: expiresAt };
  const payloadPart = toBase64Url(utf8(JSON.stringify(payload)));
  const signature = await sign(payloadPart, secret);

  return {
    token: `${payloadPart}.${signature}`,
    expiresAt,
    maxAgeSeconds: SESSION_LIFETIME_SECONDS,
  };
}

export type SessionVerification = 'valid' | 'invalid' | 'expired' | 'misconfigured';

/**
 * Verifies a session token.
 *
 * The signature is checked BEFORE the payload is trusted, with a
 * timing-resistant comparison, so a forged payload never reaches the expiry
 * logic. Every rejection reason collapses to a 401 at the API boundary; the
 * distinction exists only so the server can log an operator misconfiguration
 * differently from an ordinary expired cookie.
 */
export async function verifySession(
  token: string | null,
  secret: string | undefined,
  nowMs: number,
): Promise<SessionVerification> {
  if (!isUsableSessionSecret(secret)) return 'misconfigured';
  if (token === null || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return 'invalid';

  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return 'invalid';

  const payloadPart = token.slice(0, separator);
  const signaturePart = token.slice(separator + 1);

  const expected = await sign(payloadPart, secret);
  const provided = fromBase64Url(signaturePart);
  const expectedBytes = fromBase64Url(expected);
  if (provided === null || expectedBytes === null) return 'invalid';
  if (!timingSafeEqualBytes(provided, expectedBytes)) return 'invalid';

  const decoded = fromBase64Url(payloadPart);
  if (decoded === null) return 'invalid';

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decoded)) as SessionPayload;
  } catch {
    return 'invalid';
  }

  if (payload === null || typeof payload !== 'object') return 'invalid';
  if (payload.v !== SESSION_VERSION) return 'invalid';
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return 'invalid';
  if (payload.exp <= payload.iat) return 'invalid';
  // A session may not outlive the configured lifetime even if signed.
  if (payload.exp - payload.iat > SESSION_LIFETIME_SECONDS) return 'invalid';

  return Math.floor(nowMs / 1000) >= payload.exp ? 'expired' : 'valid';
}

// --- cookie handling -------------------------------------------------------

/**
 * `Secure` is set unconditionally. Browsers treat http://localhost and
 * http://127.0.0.1 as trustworthy origins and accept Secure cookies there, so
 * local development works without weakening the production attribute set.
 */
function cookieAttributes(maxAgeSeconds: number): string {
  return [
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${token}; ${cookieAttributes(maxAgeSeconds)}`;
}

export function buildClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`;
}

/** Extracts the session token from a raw Cookie header. */
export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    return value.length === 0 ? null : value;
  }

  return null;
}
