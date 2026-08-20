/**
 * Client access to the public demo API.
 *
 * Deliberately separate from `adminApi.ts` and deliberately tiny. Neither
 * function takes an argument, so no demo screen can ask the server for a
 * particular Pulse - which is the client half of the guarantee the Worker
 * makes structurally in `routes/demo.ts`.
 */

import type { FreeTextResponse, ResultsResponse } from '../../core/results/contracts.js';
import type { ApiResult } from './adminApi.js';

async function get<T>(path: string): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'omit' });
  } catch {
    return { ok: false, error: { kind: 'network', code: null, issues: [], fields: [] } };
  }

  if (!response.ok) {
    return { ok: false, error: { kind: 'server', code: null, issues: [], fields: [] } };
  }

  return { ok: true, value: (await response.json()) as T };
}

export function fetchDemoResults(): Promise<ApiResult<ResultsResponse>> {
  return get<ResultsResponse>('/api/demo/results');
}

export function fetchDemoFreeText(): Promise<ApiResult<FreeTextResponse>> {
  return get<FreeTextResponse>('/api/demo/results/free-text');
}
