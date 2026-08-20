/**
 * Organization results API.
 *
 * These run the real Hono app against real SQLite with the project's real
 * migrations, seeded from the committed 75-response fixture. That matters
 * because the numbers asserted here are the same numbers the Phase 0
 * pipeline-regression test pins: if the API ever reshapes, rounds, or
 * re-derives something on its way out, these two files disagree.
 *
 * The privacy assertions are the point of this file. Phase 0's aggregate
 * carries a per-respondent array; every test that checks "no raw response
 * content" is checking that the DTO boundary is doing its job.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../../src/server/index.js';
import type { Env } from '../../src/server/env.js';
import { issueSession, SESSION_COOKIE_NAME } from '../../src/server/lib/session.js';
import { createSqliteD1, type SqliteD1 } from '../support/sqliteD1.js';
import type { SurveyResponse } from '../../src/core/survey/answers.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import { runAnalysis } from '../../src/core/analysis/runAnalysis.js';
import { roundTo } from '../../src/core/util/number.js';
import type { ResultsOk, ResultsResponse, FreeTextResponse } from '../../src/core/results/contracts.js';
import { answers } from '../helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, '../../demo/sample-responses.json'), 'utf8'),
) as { readonly responses: readonly SurveyResponse[] };

const FIXTURE_RESPONSES = fixture.responses;

const ORIGIN = 'http://localhost';
const SESSION_SECRET = 'test-session-secret-that-is-long-enough';

let sessionCookie: string;

beforeAll(async () => {
  const session = await issueSession(SESSION_SECRET, Date.now());
  sessionCookie = `${SESSION_COOKIE_NAME}=${session.token}`;
});

let db: SqliteD1;
let env: Env;

beforeEach(() => {
  db = createSqliteD1();
  env = { DB: db, ENVIRONMENT: 'test', SESSION_SECRET } as unknown as Env;

  db.raw.exec("INSERT INTO organizations (name) VALUES ('Northwind Trading')");
});

// --- seeding ---------------------------------------------------------------

/** Creates a Pulse row directly; the admin creation path has its own tests. */
function createPulse(surveyVersion: string = SURVEY_VERSION): number {
  db.raw
    .prepare(
      `INSERT INTO pulses (organization_id, public_id, name, status,
                           survey_version, scoring_version, recommendation_version, opens_on)
       VALUES (1, ?, 'Q3 Pulse', 'open', ?, '1.1.0', '1.1.0', '2026-01-01')`,
    )
    .run(`public-${Math.floor(performance.now() * 1000) % 1_000_000}-${surveyVersion}`, surveyVersion);
  const row = db.raw.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
  return row.id;
}

function insertResponses(
  pulseId: number,
  responses: readonly SurveyResponse[],
  surveyVersion: string = SURVEY_VERSION,
): void {
  const statement = db.raw.prepare(
    `INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json)
     VALUES (?, ?, ?, ?)`,
  );
  for (const response of responses) {
    statement.run(pulseId, '2026-08-19', surveyVersion, JSON.stringify(response.answers));
  }
}

function seedFixture(count: number = FIXTURE_RESPONSES.length): number {
  const pulseId = createPulse();
  insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, count));
  return pulseId;
}

// --- requests --------------------------------------------------------------

function get(path: string, options: { cookie?: string | null } = {}) {
  const headers: Record<string, string> = { origin: ORIGIN };
  const cookie = options.cookie === undefined ? sessionCookie : options.cookie;
  if (cookie !== null) headers['cookie'] = cookie;
  return app.request(path, { method: 'GET', headers }, env);
}

async function results(pulseId: number, query = ''): Promise<ResultsResponse> {
  const response = await get(`/api/admin/pulses/${pulseId}/results${query}`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as ResultsResponse;
}

async function okResults(pulseId: number, query = ''): Promise<ResultsOk> {
  const payload = await results(pulseId, query);
  expect(payload.status).toBe('ok');
  return payload as ResultsOk;
}

/**
 * Every object key appearing anywhere in a payload.
 *
 * Substring searches are not enough here: recommendation rationale legitimately
 * contains words like "respondents". What must not appear is a per-respondent
 * FIELD, so the assertion is structural.
 */
function allKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) allKeys(entry, found);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      found.add(key);
      allKeys(entry, found);
    }
  }
  return found;
}

function dimension(payload: ResultsOk, name: string) {
  const found = payload.dimensions.find((d) => d.dimension === name);
  expect(found, `dimension ${name} missing`).toBeDefined();
  return found!;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

describe('results endpoints require an admin session', () => {
  it.each([
    ['results', '/results'],
    ['free text', '/results/free-text'],
  ])('%s returns 401 without a cookie', async (_label, suffix) => {
    const pulseId = seedFixture();
    const response = await get(`/api/admin/pulses/${pulseId}${suffix}`, { cookie: null });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it.each([
    ['results', '/results'],
    ['free text', '/results/free-text'],
  ])('%s returns 401 with a forged session', async (_label, suffix) => {
    const pulseId = seedFixture();
    const response = await get(`/api/admin/pulses/${pulseId}${suffix}`, {
      cookie: `${SESSION_COOKIE_NAME}=forged.token`,
    });
    expect(response.status).toBe(401);
  });

  it('returns no analysis body at all when unauthorized', async () => {
    const pulseId = seedFixture();
    const body = await (await get(`/api/admin/pulses/${pulseId}/results`, { cookie: null })).text();

    expect(body).not.toMatch(/adoption|safety|recommendation|opportunit/i);
  });

  it('is not reachable through any public route', async () => {
    const pulseId = seedFixture();
    const publicId = (
      db.raw.prepare('SELECT public_id FROM pulses WHERE id = ?').get(pulseId) as {
        public_id: string;
      }
    ).public_id;

    // The employee endpoint serves configuration, never analysis.
    const body = await (await app.request(`/api/pulses/${publicId}`, {}, env)).text();
    expect(body).not.toMatch(/adoption|recommendation|opportunit|classification/i);
  });

  it('returns 404 for a Pulse that does not exist', async () => {
    expect((await get('/api/admin/pulses/9999/results')).status).toBe(404);
    expect((await get('/api/admin/pulses/9999/results/free-text')).status).toBe(404);
    expect((await get('/api/admin/pulses/not-a-number/results')).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Minimum sample gate
// ---------------------------------------------------------------------------

describe('minimum sample gate', () => {
  it.each([0, 1, 4])('returns no analysis for n=%i', async (count) => {
    const pulseId = seedFixture(count);
    const payload = await results(pulseId);

    expect(payload).toMatchObject({
      status: 'insufficient_sample',
      sample: {
        responseCount: count,
        minimumRequired: 5,
        sufficient: false,
        earlyDirectional: false,
      },
    });

    // Nothing beyond the sample state exists on the payload.
    expect(Object.keys(payload).sort()).toEqual(['pulse', 'sample', 'status']);
  });

  it('sends no hidden aggregate for the browser to obscure at n=4', async () => {
    const pulseId = seedFixture(4);
    const body = await (await get(`/api/admin/pulses/${pulseId}/results`)).text();

    expect(body).not.toMatch(
      /"dimensions"|"recommendations"|"opportunities"|"classification"|"diagnostics"|mean/i,
    );
  });

  it('returns analysis at exactly n=5, flagged early directional', async () => {
    const payload = await okResults(seedFixture(5));

    expect(payload.sample).toMatchObject({
      responseCount: 5,
      sufficient: true,
      earlyDirectional: true,
    });
    expect(payload.sample.caveat).toBe('Early directional results - interpret cautiously.');
    expect(payload.dimensions).toHaveLength(5);
  });

  it('is still early directional at n=9', async () => {
    const payload = await okResults(seedFixture(9));
    expect(payload.sample.earlyDirectional).toBe(true);
  });

  it('is no longer early directional at n=10', async () => {
    const payload = await okResults(seedFixture(10));
    expect(payload.sample).toMatchObject({ responseCount: 10, earlyDirectional: false });
  });

  it('gates free text on the same threshold', async () => {
    const small = (await (
      await get(`/api/admin/pulses/${seedFixture(4)}/results/free-text`)
    ).json()) as FreeTextResponse;
    expect(small.status).toBe('insufficient_sample');
    expect(small).not.toHaveProperty('responses');

    const enough = (await (
      await get(`/api/admin/pulses/${seedFixture(5)}/results/free-text`)
    ).json()) as FreeTextResponse;
    expect(enough.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// The analysis payload
// ---------------------------------------------------------------------------

describe('results payload', () => {
  it('reports the five dimensions with the engine values', async () => {
    const pulseId = seedFixture();
    const payload = await okResults(pulseId);
    const engine = runAnalysis(FIXTURE_RESPONSES);
    if (engine.suppressed) throw new Error('fixture should not be suppressed');

    expect(payload.dimensions.map((d) => d.dimension)).toEqual([
      'adoption',
      'confidence',
      'workflow',
      'safety',
      'enablement',
    ]);

    for (const result of payload.dimensions) {
      const expected = engine.aggregate.dimensions[result.dimension];
      expect(result.mean).toBeCloseTo(expected.mean ?? Number.NaN, 10);
      expect(result.median).toBeCloseTo(expected.median ?? Number.NaN, 10);
      expect(result.distribution).toEqual(expected.distribution);
      expect(result.scoredCount).toBe(expected.scoredCount);
      expect(result.notAssessedCount).toBe(expected.notAssessedCount);
      expect(result.unsureRate).toBe(expected.unsureRate);
    }
  });

  it('pins the fixture dimensions, so an API reshape cannot quietly move a number', async () => {
    const payload = await okResults(seedFixture());
    const rounded = Object.fromEntries(
      payload.dimensions.map((d) => [d.dimension, roundTo(d.mean ?? 0, 2)]),
    );

    expect(rounded).toEqual({
      adoption: 62.71,
      confidence: 48.67,
      workflow: 39.03,
      safety: 47.94,
      enablement: 24.87,
    });
    expect(dimension(payload, 'safety').band).toBe('emerging');
    // 24.87 is below 25, so it bands as Low. Bands come from the raw score,
    // never from the one-decimal display value ("24.9") beside it.
    expect(dimension(payload, 'enablement').band).toBe('low');
  });

  it('carries the unsure rate and its basis beside the score', async () => {
    const payload = await okResults(seedFixture());
    const enablement = dimension(payload, 'enablement');

    expect(enablement.unsureRate).toBeGreaterThan(0);
    expect(enablement.unsureRateBasis).toContain('Q19');
    // Adoption has no Unsure option, and says so rather than reporting zero.
    expect(dimension(payload, 'adoption').unsureRate).toBeNull();
  });

  it('sends unrounded values so the client cannot compare a rounded number to a threshold', async () => {
    const payload = await okResults(seedFixture());
    const safety = dimension(payload, 'safety');

    expect(safety.mean).not.toBe(Math.round(safety.mean ?? 0));
    expect(String(safety.mean).length).toBeGreaterThan(5);
  });

  it('reports interest separately from the dimensions', async () => {
    const payload = await okResults(seedFixture());

    expect(payload.dimensions.map((d) => d.dimension)).not.toContain('interest');
    expect(payload.interest.mean).toBeGreaterThan(0);
    expect(payload.interest.band).not.toBeNull();
  });

  it('reports the classification distribution without identifying anybody', async () => {
    const payload = await okResults(seedFixture());
    const byKey = Object.fromEntries(payload.classification.buckets.map((b) => [b.key, b.count]));

    expect(byKey).toEqual({
      non_user: 4,
      explorer: 18,
      regular_user: 36,
      workflow_user: 12,
      builder_champion: 5,
    });
    expect(payload.classification.classifiedCount).toBe(75);
    expect(payload.classification.championSignal.active).toBe(true);
    expect(payload.classification.championSignal.display).toBeTruthy();
  });

  it('carries the diagnostics the detail views need', async () => {
    const payload = await okResults(seedFixture());
    const { diagnostics } = payload;

    for (const key of [
      'generalAiFrequency',
      'workAiFrequency',
      'tools',
      'useCases',
      'workflowArtifacts',
      'barriers',
      'trainingDemand',
      'learningPreferences',
      'painAreas',
    ] as const) {
      expect(diagnostics[key].options.length).toBeGreaterThan(0);
      expect(diagnostics[key].answeredCount).toBeGreaterThan(0);
    }

    expect(diagnostics.unmanagedTools.validCount).toBe(70);
    expect(diagnostics.unmanagedTools.preferNotToSayCount).toBe(5);
    expect(diagnostics.unmanagedTools.sometimesOrOftenRate).toBeGreaterThan(0);
  });

  it('carries per-question organization means for the detail views', async () => {
    const payload = await okResults(seedFixture());
    const q16 = payload.questionScores.find((q) => q.questionId === 'q16');

    expect(q16?.mean).toBeGreaterThan(0);
    // Aggregates only - there is no per-response value anywhere in this shape.
    expect(Object.keys(q16 ?? {}).sort()).toEqual([
      'mean',
      'median',
      'missingCount',
      'notAssessedCount',
      'questionId',
      'scoredCount',
    ]);
  });

  it('stamps the engine versions', async () => {
    const payload = await okResults(seedFixture());
    expect(payload.versions).toEqual({
      surveyVersion: '1.1.0',
      scoringVersion: '1.1.0',
      recommendationEngineVersion: '1.1.0',
    });
  });
});

// ---------------------------------------------------------------------------
// Raw response data never leaves the server
// ---------------------------------------------------------------------------

describe('raw respondent data never reaches the client', () => {
  it('returns no per-respondent records', async () => {
    const pulseId = seedFixture();
    const body = await (await get(`/api/admin/pulses/${pulseId}/results`)).text();
    const payload = JSON.parse(body) as Record<string, unknown>;

    // The core aggregate has a `respondents` array. The DTO must not, and the
    // check is on FIELD NAMES because prose legitimately uses the word.
    const keys = allKeys(payload);
    for (const forbidden of [
      'respondents',
      'responseId',
      'answers',
      'answers_json',
      'isPotentialChampion',
      'submittedOn',
      'submitted_on',
      'scores',
      'qualifyingCount',
    ]) {
      expect([...keys], `payload must not contain a "${forbidden}" field`).not.toContain(forbidden);
    }
    expect(Object.keys(payload).sort()).toEqual([
      'classification',
      'diagnostics',
      'dimensions',
      'interest',
      'opportunities',
      'pulse',
      'questionScores',
      'recommendations',
      'sample',
      'segmentation',
      'status',
      'versions',
    ]);
  });

  it('never includes Q27 free text in the main results payload', async () => {
    const pulseId = createPulse();
    insertResponses(pulseId, [
      ...FIXTURE_RESPONSES.slice(0, 9),
      {
        id: 'marker',
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q27: 'UNIQUE-FREE-TEXT-MARKER-STRING' }),
      },
    ]);

    const body = await (await get(`/api/admin/pulses/${pulseId}/results`)).text();
    expect(body).not.toContain('UNIQUE-FREE-TEXT-MARKER-STRING');
    expect(body).not.toContain('q27');

    // ...but the isolated endpoint does return it.
    const freeText = (await (
      await get(`/api/admin/pulses/${pulseId}/results/free-text`)
    ).json()) as FreeTextResponse;
    expect(freeText.status).toBe('ok');
    expect((freeText as unknown as { responses: string[] }).responses).toContain(
      'UNIQUE-FREE-TEXT-MARKER-STRING',
    );
  });

  it('produces identical analysis with and without Q27 present', async () => {
    // Free text is stripped from the analysis read. That is only safe if no
    // part of the engine consumes it - this proves it does not.
    const withText = runAnalysis(FIXTURE_RESPONSES);
    const withoutText = runAnalysis(
      FIXTURE_RESPONSES.map((r) => {
        const { q27: _q27, ...rest } = r.answers;
        return { ...r, answers: rest };
      }),
    );

    expect(JSON.stringify(withoutText)).toBe(JSON.stringify(withText));
  });

  it('exposes no champion identities', async () => {
    const payload = await okResults(seedFixture());
    const keys = [...allKeys(payload.classification)];

    // The organization-level signal only: no exact qualifying count, no ids.
    expect(keys).not.toContain('qualifyingCount');
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('respondents');
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('recommendations', () => {
  it('surfaces ranked primary recommendations with evidence and confidence', async () => {
    const payload = await okResults(seedFixture());
    const { primary, additional } = payload.recommendations;

    expect(primary.map((r) => r.id)).toEqual(['R02', 'R01', 'R04']);
    expect(primary.length).toBeLessThanOrEqual(3);
    expect(additional.length).toBeLessThanOrEqual(3);

    for (const card of primary) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.whatWeFound.length).toBeGreaterThan(0);
      expect(card.whyItMatters.length).toBeGreaterThan(0);
      expect(card.recommendedAction.length).toBeGreaterThan(0);
      expect(card.evidence.length).toBeGreaterThan(0);
      expect(card.confidenceLabelCopy).toBeTruthy();
      expect(card.priorityLabel.length).toBeGreaterThan(0);
    }
  });

  it('reports measured findings rather than generated prose', async () => {
    const payload = await okResults(seedFixture());
    const safety = payload.recommendations.primary.find((r) => r.id === 'R01');

    // Every "what we found" line is a condition that actually fired, with the
    // measured value beside the threshold it was compared against.
    expect(safety?.whatWeFound.map((f) => f.id).sort()).toEqual(['adoption_high', 'safety_low']);
    for (const finding of safety?.whatWeFound ?? []) {
      expect(finding.actual).not.toBeNull();
      expect(typeof finding.threshold).toBe('number');
    }

    const safetyEvidence = safety?.evidence.find((e) => e.metric === 'safety_mean');
    expect(safetyEvidence?.value).toBeCloseTo(47.94, 1);
    expect(safetyEvidence?.threshold).toBe(50);
  });

  it('folds R10 into R01 instead of showing a second safety card', async () => {
    const payload = await okResults(seedFixture());
    const cards = [...payload.recommendations.primary, ...payload.recommendations.additional];

    expect(cards.filter((c) => c.id === 'R10')).toHaveLength(0);

    const merged = payload.recommendations.primary.find((r) => r.id === 'R01')?.mergedFindings;
    expect(merged?.map((m) => m.sourceId)).toEqual(['R10']);
    expect(merged?.[0]?.evidence.length).toBeGreaterThan(0);
  });

  it('shows at most one primary card per family', async () => {
    const payload = await okResults(seedFixture());
    const families = payload.recommendations.primary.map((r) => r.family);

    expect(new Set(families).size).toBe(families.length);
  });

  it('never forwards the engine audit lists', async () => {
    const payload = await okResults(seedFixture());

    expect(Object.keys(payload.recommendations).sort()).toEqual([
      'additional',
      'engineVersion',
      'primary',
    ]);
  });

  it('labels findings Early Signal on a small sample', async () => {
    const payload = await okResults(seedFixture(6));
    const cards = [...payload.recommendations.primary, ...payload.recommendations.additional];

    for (const card of cards) {
      expect(card.confidenceLabel).toBe('early_signal');
    }
  });
});

// ---------------------------------------------------------------------------
// Opportunity Map
// ---------------------------------------------------------------------------

describe('opportunity map', () => {
  it('returns the shared categories with the pain-group denominator', async () => {
    const payload = await okResults(seedFixture());
    const { opportunities } = payload;

    expect(opportunities.denominator).toBe(75);
    expect(opportunities.rows).toHaveLength(12);

    const email = opportunities.rows.find((r) => r.categoryId === 'email_communication');
    expect(email?.painCount).toBe(32);
    // AI use is measured among the pain group, not against everybody.
    expect(email?.aiUseAmongPainCount).toBe(14);
    expect(email?.aiUseAmongPainRate).toBeCloseTo(14 / 32, 6);
  });

  it('assigns only Explore and Standardize', async () => {
    const payload = await okResults(seedFixture());
    const statuses = new Set(payload.opportunities.rows.map((r) => r.status));

    expect([...statuses].sort()).toEqual(['explore', null, 'standardize']);
    expect(JSON.stringify(payload.opportunities)).not.toMatch(/enable|scale/i);
  });

  it('includes rows that meet neither threshold, with a null status', async () => {
    const payload = await okResults(seedFixture());
    const unlabelled = payload.opportunities.rows.filter((r) => r.status === null);

    expect(unlabelled.length).toBeGreaterThan(0);
    expect(unlabelled.map((r) => r.categoryId)).toContain('creating_content');
  });

  it('raises the organization-wide guardrail when Safety is below 50', async () => {
    const payload = await okResults(seedFixture());

    expect(payload.opportunities.guardrail.active).toBe(true);
    expect(payload.opportunities.guardrail.message).toContain('Strengthen safe-use practices');
    // One organization-wide signal, never a per-row label.
    for (const row of payload.opportunities.rows) {
      expect(Object.keys(row)).not.toContain('guardrail');
    }
  });

  it('leaves the guardrail inactive when Safety is at or above 50', async () => {
    const pulseId = createPulse();
    insertResponses(
      pulseId,
      Array.from({ length: 10 }, (_, index) => ({
        id: `safe-${index}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q16: 'always', q17: 'always', q18: 'extremely_confident' }),
      })),
    );

    const payload = await okResults(pulseId);
    expect(dimension(payload, 'safety').mean).toBeGreaterThanOrEqual(50);
    expect(payload.opportunities.guardrail.active).toBe(false);
    expect(payload.opportunities.guardrail.message).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

describe('segmentation', () => {
  it('lists availability as booleans, never as group sizes', async () => {
    const payload = await okResults(seedFixture());
    const departments = payload.segmentation.available.find((d) => d.dimension === 'department');

    expect(payload.segmentation.available.map((d) => d.dimension)).toEqual([
      'department',
      'role_level',
      'work_type',
    ]);
    expect(payload.segmentation.maxActiveDimensions).toBe(1);
    expect(payload.segmentation.active).toBeNull();

    for (const option of departments?.options ?? []) {
      expect(Object.keys(option).sort()).toEqual(['reportable', 'value']);
      expect(typeof option.reportable).toBe('boolean');
    }
    expect(departments?.options.some((o) => o.reportable)).toBe(true);
    expect(departments?.options.some((o) => !o.reportable)).toBe(true);
  });

  it('returns a reportable segment scoped to that group', async () => {
    const pulseId = seedFixture();
    const payload = await okResults(pulseId, '?dimension=department&value=it_technology');

    expect(payload.segmentation.active).toEqual({
      dimension: 'department',
      value: 'it_technology',
    });
    expect(payload.sample.responseCount).toBe(12);
    // Whole-Pulse context is still reported alongside the segment.
    expect(payload.pulse.responseCount).toBe(75);
    expect(dimension(payload, 'adoption').mean).not.toBe(
      // The segment result differs from the organization result.
      (await okResults(pulseId)).dimensions[0]?.mean,
    );
  });

  it('suppresses a segment smaller than the minimum group', async () => {
    const payload = await results(seedFixture(), '?dimension=department&value=legal_compliance');

    expect(payload.status).toBe('suppressed');
    expect(payload).toMatchObject({ reason: 'minimum_group_or_complement_size' });
  });

  it('returns no aggregate whatsoever for a suppressed segment', async () => {
    const pulseId = seedFixture();
    const body = await (
      await get(`/api/admin/pulses/${pulseId}/results?dimension=department&value=legal_compliance`)
    ).text();
    const payload = JSON.parse(body) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(['pulse', 'reason', 'segmentation', 'status']);
    expect(body).not.toMatch(/"dimensions"|"recommendations"|"opportunities"|"diagnostics"/);
    // No count for the hidden group, in any form.
    expect(body).not.toContain('segmentCount');
    expect(body).not.toContain('complementCount');
  });

  it('suppresses a segment whose complement is too small', async () => {
    const pulseId = createPulse();
    // 8 in one department, 4 in the other: the segment passes, the complement
    // does not, and reporting it would expose the four by differencing.
    insertResponses(pulseId, [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `a-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q1: 'it_technology' }),
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `b-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q1: 'finance_accounting' }),
      })),
    ]);

    const payload = await results(pulseId, '?dimension=department&value=it_technology');
    expect(payload.status).toBe('suppressed');
    expect(payload).toMatchObject({ reason: 'minimum_group_or_complement_size' });
  });

  it('allows a segment of exactly five with a complement of exactly five', async () => {
    const pulseId = createPulse();
    insertResponses(pulseId, [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q1: 'it_technology' }),
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `b-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q1: 'finance_accounting' }),
      })),
    ]);

    const payload = await okResults(pulseId, '?dimension=department&value=it_technology');
    expect(payload.sample.responseCount).toBe(5);
  });

  it('refuses two segmentation dimensions at once', async () => {
    const payload = await results(
      seedFixture(),
      '?dimension=department&value=it_technology&dimension=role_level&value=manager',
    );

    expect(payload.status).toBe('suppressed');
    expect(payload).toMatchObject({ reason: 'multiple_segmentation_dimensions' });
  });

  it('refuses an unknown segmentation dimension', async () => {
    const payload = await results(seedFixture(), '?dimension=favourite_colour&value=blue');
    expect(payload).toMatchObject({
      status: 'suppressed',
      reason: 'unknown_segmentation_dimension',
    });
  });

  it('rejects a dimension without a matching value', async () => {
    const response = await get(`/api/admin/pulses/${seedFixture()}/results?dimension=department`);
    expect(response.status).toBe(400);
  });

  it('offers the segmentation control again on a suppressed response', async () => {
    const payload = await results(seedFixture(), '?dimension=department&value=legal_compliance');
    expect(
      (payload as unknown as { segmentation: { available: unknown[] } }).segmentation.available,
    ).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Free text
// ---------------------------------------------------------------------------

describe('free text', () => {
  async function freeText(pulseId: number, query = ''): Promise<FreeTextResponse> {
    const response = await get(`/api/admin/pulses/${pulseId}/results/free-text${query}`);
    expect(response.status).toBe(200);
    return (await response.json()) as FreeTextResponse;
  }

  it('returns plain strings and nothing else', async () => {
    const pulseId = seedFixture();
    const payload = (await freeText(pulseId)) as unknown as { status: string; responses: string[] };

    expect(payload.status).toBe('ok');
    expect(payload.responses).toHaveLength(20);
    for (const entry of payload.responses) {
      expect(typeof entry).toBe('string');
    }
  });

  it('carries no respondent context of any kind', async () => {
    const pulseId = seedFixture();
    const body = await (await get(`/api/admin/pulses/${pulseId}/results/free-text`)).text();
    const payload = JSON.parse(body) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(['responses', 'sample', 'status']);
    // No id, no date, no work context, no scores, no other answers.
    expect(body).not.toMatch(/"id"|responseId|submitted|department|role_level|work_type/);
    expect(body).not.toMatch(/q1|q2|q3|q5|q19b|adoption|safety|classification/);
  });

  it('cannot be segmented', async () => {
    const pulseId = seedFixture();
    const all = (await freeText(pulseId)) as unknown as { responses: string[] };
    const attempted = (await freeText(
      pulseId,
      '?dimension=department&value=it_technology',
    )) as unknown as { responses: string[] };

    // The filter is not merely refused - it has no effect, because the
    // endpoint takes no filter at all.
    expect(attempted.responses).toHaveLength(all.responses.length);
  });

  it('returns an empty collection rather than an error when nobody wrote anything', async () => {
    const pulseId = createPulse();
    insertResponses(
      pulseId,
      Array.from({ length: 6 }, (_, i) => ({
        id: `x-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q27: undefined }),
      })),
    );

    const payload = (await freeText(pulseId)) as unknown as { status: string; responses: string[] };
    expect(payload.status).toBe('ok');
    expect(payload.responses).toEqual([]);
  });

  it('omits blank and whitespace-only entries', async () => {
    const pulseId = createPulse();
    insertResponses(pulseId, [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `blank-${i}`,
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q27: '   ' }),
      })),
      {
        id: 'real',
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q27: 'Cleaning recurring spreadsheet exports.' }),
      },
    ]);

    const payload = (await freeText(pulseId)) as unknown as { responses: string[] };
    expect(payload.responses).toEqual(['Cleaning recurring spreadsheet exports.']);
  });

  it('returns text verbatim, leaving escaping to the renderer', async () => {
    const pulseId = createPulse();
    insertResponses(pulseId, [
      ...FIXTURE_RESPONSES.slice(0, 5),
      {
        id: 'html',
        submittedOn: '2026-08-19',
        surveyVersion: SURVEY_VERSION,
        answers: answers({ q27: '<script>alert(1)</script> summarising tickets' }),
      },
    ]);

    const payload = (await freeText(pulseId)) as unknown as { responses: string[] };
    expect(payload.responses).toContain('<script>alert(1)</script> summarising tickets');
  });
});

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

describe('analysis failures', () => {
  it('fails safely rather than scoring an unsupported survey version', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pulseId = createPulse('0.9.0');
    insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, 10), '0.9.0');

    const response = await get(`/api/admin/pulses/${pulseId}/results`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'analysis_failed',
      reason: 'unsupported_survey_version',
    });
    errors.mockRestore();
  });

  it('refuses to mix survey versions within one Pulse', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pulseId = createPulse();
    insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, 8));
    // A row that does not match the Pulse's version.
    db.raw
      .prepare(
        `INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json)
         VALUES (?, '2026-08-19', '1.0.0', ?)`,
      )
      .run(pulseId, JSON.stringify(answers()));

    const response = await get(`/api/admin/pulses/${pulseId}/results`);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ reason: 'unsupported_survey_version' });
    errors.mockRestore();
  });

  it('fails loudly on a corrupt stored response rather than dropping it', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pulseId = createPulse();
    insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, 8));
    db.raw
      .prepare(
        `INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json)
         VALUES (?, '2026-08-19', ?, '{"q5":"not_a_real_option"}')`,
      )
      .run(pulseId, SURVEY_VERSION);

    const response = await get(`/api/admin/pulses/${pulseId}/results`);
    // Dropping the row would silently change every denominator on the page.
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ reason: 'corrupt_response' });
    errors.mockRestore();
  });

  it('logs the failure without any answer content', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pulseId = createPulse();
    insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, 8));
    db.raw
      .prepare(
        `INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json)
         VALUES (?, '2026-08-19', ?, '{"q5":"not_a_real_option","q27":"SECRET-TEXT"}')`,
      )
      .run(pulseId, SURVEY_VERSION);

    await get(`/api/admin/pulses/${pulseId}/results`);

    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain('Pulse analysis failed');
    expect(logged).not.toContain('SECRET-TEXT');
    expect(logged).not.toContain('answers_json');
    errors.mockRestore();
  });
});
