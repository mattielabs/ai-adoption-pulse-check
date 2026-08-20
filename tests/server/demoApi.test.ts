/**
 * The public demo API.
 *
 * The demo is the only unauthenticated route in the product that returns an
 * organization analysis, so what matters is not that it works but that it
 * cannot be talked into working on somebody else's data. Two of these tests
 * establish that structurally: one runs the demo endpoints against a database
 * binding that throws on any use at all, and one runs them with no binding.
 * A demo route that ever reads D1 fails both. Phase 4 brief 30, 50.
 *
 * The rest check that it is the real engine rather than a fixture of
 * pre-computed numbers, by comparing against `runAnalysis` directly.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import app from '../../src/server/index.js';
import type { Env } from '../../src/server/env.js';
import { runAnalysis } from '../../src/core/analysis/runAnalysis.js';
import type { SurveyResponse } from '../../src/core/survey/answers.js';
import type { FreeTextResponse, ResultsOk } from '../../src/core/results/contracts.js';
import { DEMO_PULSE_NAME } from '../../src/core/demo/constants.js';
import { ENGINE_VERSIONS } from '../../src/core/versions.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, '../../demo/sample-responses.json'), 'utf8'),
) as { readonly responses: readonly SurveyResponse[]; readonly responseCount: number };

/**
 * A binding that fails on contact.
 *
 * Anything that so much as prepares a statement blows up, so a demo handler
 * that reached for the database could not quietly succeed.
 */
function hostileDb(): unknown {
  const fail = () => {
    throw new Error('The demo must never touch D1');
  };
  return new Proxy({}, { get: fail, apply: fail, has: fail });
}

function demoEnv(): Env {
  return { DB: hostileDb(), ENVIRONMENT: 'test', SESSION_SECRET: 'unused' } as unknown as Env;
}

function get(path: string, env: Env = demoEnv()) {
  return app.request(path, { method: 'GET' }, env);
}

async function demoResults(): Promise<ResultsOk> {
  const response = await get('/api/demo/results');
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as ResultsOk;
}

describe('demo isolation', () => {
  it('serves results without ever touching the database binding', async () => {
    const payload = await demoResults();
    expect(payload.status).toBe('ok');
    expect(payload.pulse.name).toBe(DEMO_PULSE_NAME);
  });

  it('serves free text without ever touching the database binding', async () => {
    const response = await get('/api/demo/results/free-text');
    expect(response.status).toBe(200);
    expect(((await response.json()) as FreeTextResponse).status).toBe('ok');
  });

  it('works with no database binding at all', async () => {
    const env = { ENVIRONMENT: 'test' } as unknown as Env;
    expect((await get('/api/demo/results', env)).status).toBe(200);
    expect((await get('/api/demo/results/free-text', env)).status).toBe(200);
  });

  it('needs no session', async () => {
    // No cookie, no origin header, nothing. The admin routes 401 on the same
    // request; these do not, and that difference is deliberate.
    expect((await get('/api/demo/results')).status).toBe(200);
    expect((await app.request('/api/admin/pulses/1/results', { method: 'GET' }, demoEnv())).status).toBe(401);
  });

  it('accepts no identifier that could select a real Pulse', async () => {
    // Every shape somebody might try. None of them is a route, and the query
    // string cannot change the response because nothing reads it.
    for (const path of [
      '/api/demo/results/1',
      '/api/demo/pulses/1/results',
      '/api/demo/1/results',
    ]) {
      expect((await get(path)).status, path).toBe(404);
    }

    const plain = await (await get('/api/demo/results')).text();
    const withQuery = await (await get('/api/demo/results?pulseId=1&id=1&dimension=department&value=it_technology')).text();
    expect(withQuery).toBe(plain);
  });

  it('rejects a write to the demo endpoints', async () => {
    const response = await app.request('/api/demo/results', { method: 'POST' }, demoEnv());
    expect(response.status).toBe(404);
  });
});

describe('demo analysis', () => {
  it('is the real engine over the committed fixture', async () => {
    const payload = await demoResults();
    const expected = runAnalysis(fixture.responses, { filters: [] });
    expect(expected.suppressed).toBe(false);
    if (expected.suppressed) return;

    for (const dimension of payload.dimensions) {
      expect(dimension.mean, dimension.dimension).toBe(
        expected.aggregate.dimensions[dimension.dimension].mean,
      );
    }
    expect(payload.recommendations.primary.map((card) => card.id)).toEqual(
      expected.recommendations.primary.map((card) => card.id),
    );
    expect(payload.opportunities.rows.map((row) => row.status)).toEqual(
      expected.opportunities.categories.map((row) => row.opportunityLabel),
    );
    expect(payload.pulse.responseCount).toBe(fixture.responseCount);
  });

  it('exercises the parts of the product the demo exists to show', async () => {
    const payload = await demoResults();

    expect(payload.dimensions).toHaveLength(5);
    expect(payload.recommendations.primary.length).toBeGreaterThan(0);
    expect(payload.classification.buckets.some((bucket) => bucket.count > 0)).toBe(true);
    expect(payload.diagnostics.barriers.answeredCount).toBeGreaterThan(0);
    expect(payload.diagnostics.trainingDemand.answeredCount).toBeGreaterThan(0);

    const statuses = payload.opportunities.rows.map((row) => row.status);
    expect(statuses).toContain('explore');
    expect(statuses).toContain('standardize');
    expect(payload.opportunities.guardrail.active).toBe(true);
  });

  it('stamps the engine versions', async () => {
    const payload = await demoResults();
    expect(payload.versions).toEqual(ENGINE_VERSIONS);
  });

  it('offers no segmentation, because there is no real group to protect', async () => {
    const payload = await demoResults();
    expect(payload.segmentation.available).toEqual([]);
    expect(payload.segmentation.active).toBeNull();
  });
});

describe('demo free text', () => {
  it('returns plain strings and nothing else', async () => {
    const response = await get('/api/demo/results/free-text');
    const payload = (await response.json()) as FreeTextResponse;
    expect(payload.status).toBe('ok');
    if (payload.status !== 'ok') return;

    expect(payload.responses.length).toBeGreaterThan(0);
    for (const entry of payload.responses) {
      expect(typeof entry).toBe('string');
    }
    expect(Object.keys(payload).sort()).toEqual(['responses', 'sample', 'status']);
  });

  it('carries no work context', async () => {
    const text = await (await get('/api/demo/results/free-text')).text();
    for (const leak of ['it_technology', 'executive_owner', 'people_customers', 'few_times_week']) {
      expect(text, leak).not.toContain(leak);
    }
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('randomises order between requests', async () => {
    const read = async () => {
      const payload = (await (await get('/api/demo/results/free-text')).json()) as FreeTextResponse;
      return payload.status === 'ok' ? payload.responses.join('|') : '';
    };
    // Deliberately compared across several reads: two shuffles can coincide,
    // ten identical ones would mean it is not shuffling.
    const reads = await Promise.all(Array.from({ length: 10 }, read));
    expect(new Set(reads).size).toBeGreaterThan(1);
  });
});
