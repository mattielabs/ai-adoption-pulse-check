/**
 * The API validation pattern every write endpoint will use.
 *
 * Two gates, in this order:
 *   1. a hard byte cap on the raw body, checked before any parsing;
 *   2. Zod schema validation of the parsed value.
 *
 * The size gate comes first so an oversized or malformed payload is rejected
 * without allocating a parse tree for it. Spec 59.
 */

import type { Context } from 'hono';
import type { z } from 'zod';
import { MAX_RESPONSE_PAYLOAD_BYTES } from '../../core/survey/answers.js';

export interface ParsedBody<T> {
  readonly ok: true;
  readonly value: T;
}

export interface RejectedBody {
  readonly ok: false;
  readonly status: 400 | 413;
  readonly body: { readonly error: string; readonly issues?: readonly { path: string; message: string }[] };
}

export type BodyResult<T> = ParsedBody<T> | RejectedBody;

export async function parseJsonBody<T>(
  c: Context,
  schema: z.ZodType<T>,
  maxBytes: number = MAX_RESPONSE_PAYLOAD_BYTES,
): Promise<BodyResult<T>> {
  const raw = await c.req.text();

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, status: 413, body: { error: 'payload_too_large' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, body: { error: 'invalid_json' } };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'validation_failed',
        // Field paths and messages only. Never echo the submitted values back:
        // a validation error should not become a way to reflect content.
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      },
    };
  }

  return { ok: true, value: result.data };
}
