/**
 * Public Pulse API tests.
 *
 * These exercise the real Hono app end to end - routing, size gate, Zod
 * validation, availability, version checks, custom-question validation, and
 * the exact values written to the responses table - against an in-memory
 * fake of the minimal D1 surface (src/server/lib/d1.ts).
 *
 * Real-D1 persistence is additionally proven by the Playwright flows and the
 * wrangler d1 verification in the quality gate.
 */

import { describe, expect, it } from 'vitest';
import app from '../../src/server/index.js';
import type { D1DatabaseLike, D1BoundStatement } from '../../src/server/lib/d1.js';
import type { Env } from '../../src/server/env.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import { answers } from '../helpers.js';

// --- fake D1 ---------------------------------------------------------------

interface PulseSeed {
  readonly id: number;
  readonly public_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly survey_version: string;
  readonly opens_on: string | null;
  readonly closes_on: string | null;
  readonly personal_results_enabled: number;
  readonly org_name: string;
  readonly logo_url: string | null;
  readonly accent_color: string | null;
  readonly survey_intro: string | null;
}

interface CustomSeed {
  readonly pulse_id: number;
  readonly position: number;
  readonly type: string;
  readonly question_text: string;
  readonly options_json: string | null;
}

interface InsertedResponse {
  readonly pulse_id: unknown;
  readonly submitted_on: unknown;
  readonly survey_version: unknown;
  readonly answers_json: unknown;
  readonly custom_answers_json: unknown;
}

function fakeDb(pulses: readonly PulseSeed[], customs: readonly CustomSeed[] = []) {
  const inserted: InsertedResponse[] = [];

  const db: D1DatabaseLike = {
    prepare(sql: string) {
      const exec = (params: readonly unknown[]): D1BoundStatement => ({
        async first<T>() {
          if (sql.includes('FROM pulses')) {
            return (pulses.find((p) => p.public_id === params[0]) ?? null) as T | null;
          }
          if (sql.includes('sqlite_master')) return { n: 4 } as T;
          throw new Error(`Unexpected first() for SQL: ${sql}`);
        },
        async all<T>() {
          if (sql.includes('FROM custom_questions')) {
            const results = customs
              .filter((q) => q.pulse_id === params[0])
              .sort((a, b) => a.position - b.position) as T[];
            return { results };
          }
          throw new Error(`Unexpected all() for SQL: ${sql}`);
        },
        async run() {
          if (sql.includes('INSERT INTO responses')) {
            // Capture exactly what the route binds, positionally - this is the
            // record the "no identifiers stored" assertions run against.
            inserted.push({
              pulse_id: params[0],
              submitted_on: params[1],
              survey_version: params[2],
              answers_json: params[3],
              custom_answers_json: params[4],
            });
            if (params.length !== 5) throw new Error('responses INSERT must bind exactly 5 values');
            return {};
          }
          throw new Error(`Unexpected run() for SQL: ${sql}`);
        },
      });

      return { bind: (...values: unknown[]) => exec(values), ...exec([]) };
    },
    // The public routes never batch; admin creation does (see adminApi tests).
    batch() {
      throw new Error('batch() is not used by the public API');
    },
  };

  const env = { DB: db, ENVIRONMENT: 'test' } as Env;
  return { env, inserted };
}

// --- seeds ------------------------------------------------------------------

const OPEN_PULSE: PulseSeed = {
  id: 7,
  public_id: 'test-open-pulse',
  name: 'Q3 Pulse',
  description: 'A test pulse',
  status: 'open',
  survey_version: SURVEY_VERSION,
  opens_on: null,
  closes_on: null,
  personal_results_enabled: 1,
  org_name: 'Test Org',
  logo_url: null,
  accent_color: '#0f766e',
  survey_intro: null,
};

const CUSTOM_QUESTIONS: readonly CustomSeed[] = [
  {
    pulse_id: 7,
    position: 1,
    type: 'single_select',
    question_text: 'Which location?',
    options_json: JSON.stringify([
      { id: 'hq', label: 'Headquarters' },
      { id: 'remote', label: 'Remote' },
    ]),
  },
  { pulse_id: 7, position: 2, type: 'free_text', question_text: 'Anything else?', options_json: null },
];

function get(env: Env, publicId: string) {
  return app.request(`/api/pulses/${publicId}`, {}, env);
}

function post(env: Env, publicId: string, body: unknown) {
  return app.request(
    `/api/pulses/${publicId}/responses`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env,
  );
}

function submission(overrides: Partial<Record<string, unknown>> = {}) {
  return { surveyVersion: SURVEY_VERSION, answers: answers(), ...overrides };
}

// --- GET /api/pulses/:publicId ---------------------------------------------

describe('GET /api/pulses/:publicId', () => {
  it('returns 404 with the generic body for an unknown id', async () => {
    const { env } = fakeDb([]);
    const res = await get(env, 'does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns a draft pulse as an identical 404 - publishing state is not public', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, status: 'draft' }]);
    const res = await get(env, OPEN_PULSE.public_id);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns the public configuration for an open pulse', async () => {
    const { env } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const res = await get(env, OPEN_PULSE.public_id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      publicId: 'test-open-pulse',
      name: 'Q3 Pulse',
      description: 'A test pulse',
      availability: 'available',
      opensOn: null,
      closesOn: null,
      personalResultsEnabled: true,
      surveyVersion: SURVEY_VERSION,
      organization: { name: 'Test Org', logoUrl: null, accentColor: '#0f766e', surveyIntro: null },
      customQuestions: [
        {
          key: 'c1',
          type: 'single_select',
          questionText: 'Which location?',
          options: [
            { id: 'hq', label: 'Headquarters' },
            { id: 'remote', label: 'Remote' },
          ],
        },
        { key: 'c2', type: 'free_text', questionText: 'Anything else?', options: null },
      ],
    });
  });

  it('never exposes internal ids, counts, or admin data', async () => {
    const { env } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const body = (await (await get(env, OPEN_PULSE.public_id)).json()) as Record<string, unknown>;
    // No top-level internal row id (option ids inside customQuestions are
    // public identifiers, not database ids).
    expect(Object.keys(body)).not.toContain('id');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/responseCount|scoring_version|recommendation|organization_id|pulse_id/);
  });

  it('reports a closed pulse as closed, not as missing', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, status: 'closed' }]);
    const res = await get(env, OPEN_PULSE.public_id);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { availability: string }).availability).toBe('closed');
  });

  it('reports a date-expired pulse as closed', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, closes_on: '2000-01-01' }]);
    const body = (await (await get(env, OPEN_PULSE.public_id)).json()) as { availability: string };
    expect(body.availability).toBe('closed');
  });

  it('reports a future pulse as not_yet_open', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, opens_on: '2100-01-01' }]);
    const body = (await (await get(env, OPEN_PULSE.public_id)).json()) as { availability: string };
    expect(body.availability).toBe('not_yet_open');
  });

  it('maps personal_results_enabled = 0 to false', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, personal_results_enabled: 0 }]);
    const body = (await (await get(env, OPEN_PULSE.public_id)).json()) as { personalResultsEnabled: boolean };
    expect(body.personalResultsEnabled).toBe(false);
  });
});

// --- POST /api/pulses/:publicId/responses ----------------------------------

describe('POST /api/pulses/:publicId/responses', () => {
  it('accepts a valid submission and stores exactly the schema columns', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const res = await post(env, OPEN_PULSE.public_id, submission({ customAnswers: { c1: 'hq' } }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(inserted).toHaveLength(1);

    const row = inserted[0] as InsertedResponse;
    expect(row.pulse_id).toBe(7);
    // Day granularity, and today's UTC day specifically.
    expect(row.submitted_on).toBe(new Date().toISOString().slice(0, 10));
    expect(row.submitted_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.survey_version).toBe(SURVEY_VERSION);
    expect(JSON.parse(row.answers_json as string)).toEqual(answers());
    expect(JSON.parse(row.custom_answers_json as string)).toEqual({ c1: 'hq' });
    // The exhaustive column list: nothing else is stored.
    expect(Object.keys(row).sort()).toEqual([
      'answers_json', 'custom_answers_json', 'pulse_id', 'submitted_on', 'survey_version',
    ]);
  });

  it('never stores identity-shaped data', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE]);
    await post(env, OPEN_PULSE.public_id, submission());
    const row = inserted[0] as InsertedResponse;
    // Column set is exhaustive - no ip/user-agent/email/fingerprint column can exist.
    expect(Object.keys(row).sort()).toEqual([
      'answers_json', 'custom_answers_json', 'pulse_id', 'submitted_on', 'survey_version',
    ]);
    // Stored answer keys are survey question ids only - nothing injected.
    const answerKeys = Object.keys(JSON.parse(row.answers_json as string));
    expect(answerKeys.every((k) => /^q\d+b?$/.test(k))).toBe(true);
    // No exact timestamp anywhere in the row.
    expect(JSON.stringify(row)).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('stores null custom answers when none were provided', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const res = await post(env, OPEN_PULSE.public_id, submission());
    expect(res.status).toBe(201);
    expect((inserted[0] as InsertedResponse).custom_answers_json).toBeNull();
  });

  it('returns the generic 404 for an unknown pulse', async () => {
    const { env, inserted } = fakeDb([]);
    const res = await post(env, 'nope', submission());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(inserted).toHaveLength(0);
  });

  it('rejects submission to a closed pulse', async () => {
    const { env, inserted } = fakeDb([{ ...OPEN_PULSE, status: 'closed' }]);
    const res = await post(env, OPEN_PULSE.public_id, submission());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_accepting_responses', reason: 'closed' });
    expect(inserted).toHaveLength(0);
  });

  it('rejects submission after the closing date even from an old loaded page', async () => {
    const { env, inserted } = fakeDb([{ ...OPEN_PULSE, closes_on: '2000-01-01' }]);
    const res = await post(env, OPEN_PULSE.public_id, submission());
    expect(res.status).toBe(409);
    expect(inserted).toHaveLength(0);
  });

  it('rejects submission to a not-yet-open pulse', async () => {
    const { env } = fakeDb([{ ...OPEN_PULSE, opens_on: '2100-01-01' }]);
    const res = await post(env, OPEN_PULSE.public_id, submission());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_accepting_responses', reason: 'not_yet_open' });
  });

  it('rejects a survey version that does not match the pulse', async () => {
    const { env, inserted } = fakeDb([{ ...OPEN_PULSE, survey_version: '9.9.9' }]);
    const res = await post(env, OPEN_PULSE.public_id, submission());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'survey_version_mismatch' });
    expect(inserted).toHaveLength(0);
  });

  it('rejects an unsupported survey version before touching the database', async () => {
    const { env } = fakeDb([OPEN_PULSE]);
    const res = await post(env, OPEN_PULSE.public_id, submission({ surveyVersion: '0.0.1' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing required answer with the field path only', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE]);
    const incomplete: Record<string, unknown> = { ...answers() };
    delete incomplete.q5;
    const res = await post(env, OPEN_PULSE.public_id, submission({ answers: incomplete }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: { path: string }[] };
    expect(body.error).toBe('validation_failed');
    expect(body.issues.some((i) => i.path === 'answers.q5')).toBe(true);
    expect(inserted).toHaveLength(0);
  });

  it('rejects an invalid option value', async () => {
    const { env } = fakeDb([OPEN_PULSE]);
    const res = await post(env, OPEN_PULSE.public_id, submission({ answers: { ...answers(), q5: 'hourly' } }));
    expect(res.status).toBe(400);
  });

  it('rejects more than the maximum selections', async () => {
    const { env } = fakeDb([OPEN_PULSE]);
    const res = await post(
      env,
      OPEN_PULSE.public_id,
      submission({
        answers: { ...answers(), q23: ['not_enough_time', 'accuracy_concern', 'policies_unclear', 'no_need'] },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects Q27 over the length cap', async () => {
    const { env } = fakeDb([OPEN_PULSE]);
    const res = await post(env, OPEN_PULSE.public_id, submission({ answers: { ...answers(), q27: 'a'.repeat(1001) } }));
    expect(res.status).toBe(400);
  });

  it('rejects custom answers for unconfigured questions', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE]); // no custom questions configured
    const res = await post(env, OPEN_PULSE.public_id, submission({ customAnswers: { c1: 'hq' } }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string; message: string }[] };
    expect(body.issues[0]?.path).toBe('customAnswers.c1');
    // The submitted value is not echoed back.
    expect(JSON.stringify(body)).not.toContain('hq');
    expect(inserted).toHaveLength(0);
  });

  it('rejects an invalid custom option', async () => {
    const { env } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const res = await post(env, OPEN_PULSE.public_id, submission({ customAnswers: { c1: 'moon_base' } }));
    expect(res.status).toBe(400);
  });

  it('rejects custom free text over the cap', async () => {
    const { env } = fakeDb([OPEN_PULSE], CUSTOM_QUESTIONS);
    const res = await post(env, OPEN_PULSE.public_id, submission({ customAnswers: { c2: 'a'.repeat(1001) } }));
    expect(res.status).toBe(400);
  });

  it('rejects an oversized body with 413 before parsing', async () => {
    const { env, inserted } = fakeDb([OPEN_PULSE]);
    const res = await post(env, OPEN_PULSE.public_id, `{"pad":"${'x'.repeat(33 * 1024)}"}`);
    expect(res.status).toBe(413);
    expect(inserted).toHaveLength(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const { env } = fakeDb([OPEN_PULSE]);
    const res = await post(env, OPEN_PULSE.public_id, '{not json');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });
});
