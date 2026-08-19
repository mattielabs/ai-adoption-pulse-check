/**
 * Client access to the admin API.
 *
 * Authentication state lives entirely in the HttpOnly session cookie the
 * server sets. Nothing here reads, writes, or stores a token: no
 * localStorage, no sessionStorage, no query string, no React state holding a
 * credential. The passcode exists only as the argument to `login` and is
 * released when the request settles.
 *
 * Every failure is mapped to a typed result so screens can respond to a
 * configuration lock or an expired session without parsing status codes.
 */

import type {
  AdminOrganization,
  AdminPulseDetail,
  AdminPulseSummary,
  AdminSessionState,
} from '../../core/admin/contracts.js';
import type { CustomQuestionInput } from '../../core/admin/schemas.js';

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network';

export interface ApiIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiError {
  readonly kind: ApiErrorKind;
  /** The server's machine-readable error code, when it sent one. */
  readonly code: string | null;
  readonly issues: readonly ApiIssue[];
  /** Locked field names, for `pulse_configuration_locked`. */
  readonly fields: readonly string[];
}

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

function apiError(kind: ApiErrorKind, body?: Record<string, unknown>): ApiError {
  return {
    kind,
    code: typeof body?.error === 'string' ? body.error : null,
    issues: Array.isArray(body?.issues) ? (body.issues as ApiIssue[]) : [],
    fields: Array.isArray(body?.fields) ? (body.fields as string[]) : [],
  };
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 400 || status === 413) return 'validation';
  return 'server';
}

async function call<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      // Same-origin only: the session cookie must never be attached elsewhere.
      credentials: 'same-origin',
      headers:
        init.body === undefined ? (init.headers ?? {}) : { 'content-type': 'application/json', ...init.headers },
    });
  } catch {
    return { ok: false, error: apiError('network') };
  }

  let body: Record<string, unknown> | undefined;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = undefined;
  }

  if (!response.ok) return { ok: false, error: apiError(kindForStatus(response.status), body) };
  return { ok: true, value: (body ?? {}) as T };
}

// --- session ---------------------------------------------------------------

export function fetchSession(): Promise<ApiResult<AdminSessionState>> {
  return call<AdminSessionState>('/api/admin/session');
}

export function login(passcode: string): Promise<ApiResult<AdminSessionState>> {
  return call<AdminSessionState>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ passcode }),
  });
}

export function logout(): Promise<ApiResult<{ ok: boolean }>> {
  return call('/api/admin/logout', { method: 'POST' });
}

// --- organization ----------------------------------------------------------

export interface OrganizationPayload {
  readonly name: string;
  readonly logoUrl: string | null;
  readonly accentColor: string | null;
  readonly surveyIntro: string | null;
}

export function fetchOrganization(): Promise<ApiResult<{ organization: AdminOrganization | null }>> {
  return call('/api/admin/organization');
}

export function createOrganization(payload: OrganizationPayload): Promise<ApiResult<{ ok: boolean }>> {
  return call('/api/admin/organization', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateOrganization(payload: OrganizationPayload): Promise<ApiResult<{ ok: boolean }>> {
  return call('/api/admin/organization', { method: 'PATCH', body: JSON.stringify(payload) });
}

// --- pulses ----------------------------------------------------------------

export interface PulsePayload {
  readonly name: string;
  readonly description: string | null;
  readonly opensOn: string;
  readonly closesOn: string | null;
  readonly personalResultsEnabled: boolean;
  readonly customQuestions: readonly CustomQuestionInput[];
}

export function fetchPulses(): Promise<ApiResult<{ pulses: readonly AdminPulseSummary[] }>> {
  return call('/api/admin/pulses');
}

export function fetchPulse(id: string): Promise<ApiResult<AdminPulseDetail>> {
  return call(`/api/admin/pulses/${encodeURIComponent(id)}`);
}

export function createPulse(payload: PulsePayload): Promise<ApiResult<{ id: number; publicId: string }>> {
  return call('/api/admin/pulses', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Sends only the fields being changed. Locked fields are omitted entirely -
 * the server refuses a request that so much as mentions one after the first
 * response has arrived.
 */
export function updatePulse(
  id: string,
  updates: Partial<PulsePayload>,
): Promise<ApiResult<{ ok: boolean }>> {
  return call(`/api/admin/pulses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function closePulse(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return call(`/api/admin/pulses/${encodeURIComponent(id)}/close`, { method: 'POST' });
}

export function deletePulse(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return call(`/api/admin/pulses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
