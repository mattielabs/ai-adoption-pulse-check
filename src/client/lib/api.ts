/**
 * Client access to the public Pulse API.
 *
 * The client trusts nothing about availability - the server re-checks on
 * submission, and these helpers surface that refusal as a typed result so the
 * UI can explain what happened without losing the local draft.
 */

import type { PublicPulse } from '../../core/pulse/publicPulse.js';
import type { SurveyAnswers } from '../../core/survey/answers.js';

export type PulseFetchResult =
  | { readonly ok: true; readonly pulse: PublicPulse }
  | { readonly ok: false; readonly kind: 'not_found' | 'network' | 'server' };

export async function fetchPulse(publicId: string): Promise<PulseFetchResult> {
  let response: Response;
  try {
    response = await fetch(`/api/pulses/${encodeURIComponent(publicId)}`);
  } catch {
    return { ok: false, kind: 'network' };
  }

  if (response.status === 404) return { ok: false, kind: 'not_found' };
  if (!response.ok) return { ok: false, kind: 'server' };

  try {
    const pulse = (await response.json()) as PublicPulse;
    return { ok: true, pulse };
  } catch {
    return { ok: false, kind: 'server' };
  }
}

export interface SubmissionPayload {
  readonly surveyVersion: string;
  readonly answers: SurveyAnswers;
  readonly customAnswers?: Readonly<Record<string, string | readonly string[]>>;
}

export type SubmitFailureKind =
  | 'closed'
  | 'not_yet_open'
  | 'not_found'
  | 'version_mismatch'
  | 'validation'
  | 'network'
  | 'server';

export type SubmitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: SubmitFailureKind };

export async function submitResponse(
  publicId: string,
  payload: SubmissionPayload,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(`/api/pulses/${encodeURIComponent(publicId)}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: 'network' };
  }

  if (response.status === 201) return { ok: true };
  if (response.status === 404) return { ok: false, kind: 'not_found' };

  if (response.status === 409) {
    try {
      const body = (await response.json()) as { error?: string; reason?: string };
      if (body.error === 'survey_version_mismatch') return { ok: false, kind: 'version_mismatch' };
      if (body.reason === 'not_yet_open') return { ok: false, kind: 'not_yet_open' };
      return { ok: false, kind: 'closed' };
    } catch {
      return { ok: false, kind: 'closed' };
    }
  }

  if (response.status === 400 || response.status === 413) return { ok: false, kind: 'validation' };
  return { ok: false, kind: 'server' };
}
