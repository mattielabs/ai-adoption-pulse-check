/**
 * Export API.
 *
 * Downloads are the easiest way to undo every other privacy control, so these
 * assertions are written against the bytes a browser would actually receive -
 * the parsed CSV text and the real response headers - rather than against the
 * shaping helpers, which have their own unit tests. A helper that behaves
 * correctly while the route hands out something else is exactly the failure
 * this file exists to catch. Phase 4 brief 15, 49.
 *
 * Real Hono app, real SQLite, real migrations, the committed fixture.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/server/index.js';
import type { Env } from '../../src/server/env.js';
import { issueSession, SESSION_COOKIE_NAME } from '../../src/server/lib/session.js';
import { createSqliteD1, type SqliteD1 } from '../support/sqliteD1.js';
import type { SurveyResponse } from '../../src/core/survey/answers.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import { WORK_CONTEXT_QUESTION_IDS } from '../../src/core/survey/questions.js';

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

let pulseSequence = 0;

function createPulse(name = 'Q3 Pulse'): number {
  pulseSequence += 1;
  db.raw
    .prepare(
      `INSERT INTO pulses (organization_id, public_id, name, status,
                           survey_version, scoring_version, recommendation_version, opens_on)
       VALUES (1, ?, ?, 'open', ?, '1.1.0', '1.1.0', '2026-01-01')`,
    )
    .run(`export-public-${pulseSequence}`, name, SURVEY_VERSION);
  return (db.raw.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
}

function insertResponses(
  pulseId: number,
  responses: readonly SurveyResponse[],
  customAnswers: readonly (Record<string, unknown> | null)[] = [],
): void {
  const statement = db.raw.prepare(
    `INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json, custom_answers_json)
     VALUES (?, ?, ?, ?, ?)`,
  );
  responses.forEach((response, index) => {
    const custom = customAnswers[index] ?? null;
    statement.run(
      pulseId,
      `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
      SURVEY_VERSION,
      JSON.stringify(response.answers),
      custom === null ? null : JSON.stringify(custom),
    );
  });
}

function seedFixture(count: number = FIXTURE_RESPONSES.length, name = 'Q3 Pulse'): number {
  const pulseId = createPulse(name);
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

const EXPORT_PATHS = ['responses.csv', 'free-text.csv', 'results.json'] as const;

/**
 * Parses CSV that follows the strict shape this project emits: every field
 * quoted, CRLF between records, doubled quotes inside a field.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

async function csv(path: string): Promise<{ headers: string[]; rows: string[][]; text: string; response: Response }> {
  const response = await get(path);
  expect(response.status, await response.clone().text()).toBe(200);
  const text = await response.text();
  const parsed = parseCsv(text);
  return { headers: parsed[0] as string[], rows: parsed.slice(1), text, response };
}

// --- authorization ---------------------------------------------------------

describe('export authorization', () => {
  it('refuses every export without a session', async () => {
    const pulseId = seedFixture();
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/${pulseId}/export/${path}`, { cookie: null });
      expect(response.status, path).toBe(401);
      expect(await response.text(), path).not.toMatch(/few_times_week/);
    }
  });

  it('refuses a forged session', async () => {
    const pulseId = seedFixture();
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/${pulseId}/export/${path}`, {
        cookie: `${SESSION_COOKIE_NAME}=not.a.real.token`,
      });
      expect(response.status, path).toBe(401);
    }
  });

  it('404s an unknown Pulse rather than describing it', async () => {
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/9999/export/${path}`);
      expect(response.status, path).toBe(404);
      expect(await response.json()).toEqual({ error: 'pulse_not_found' });
    }
  });

  it('is not reachable from the public API surface', async () => {
    const pulseId = seedFixture();
    const response = await get(`/api/pulses/${pulseId}/export/responses.csv`, { cookie: null });
    expect(response.status).toBe(404);
  });
});

// --- minimum sample --------------------------------------------------------

describe('minimum sample gate', () => {
  it('refuses every export below five responses', async () => {
    const pulseId = seedFixture(4);
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/${pulseId}/export/${path}`);
      expect(response.status, path).toBe(409);
      expect(await response.json()).toEqual({
        error: 'insufficient_sample',
        minimumRequired: 5,
        responseCount: 4,
      });
    }
  });

  it('refuses every export for a Pulse with no responses at all', async () => {
    const pulseId = createPulse();
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/${pulseId}/export/${path}`);
      expect(response.status, path).toBe(409);
    }
  });

  it('releases them at exactly five', async () => {
    const pulseId = seedFixture(5);
    for (const path of EXPORT_PATHS) {
      const response = await get(`/api/admin/pulses/${pulseId}/export/${path}`);
      expect(response.status, path).toBe(200);
    }
  });

  it('leaks no answer content in the refusal body', async () => {
    const pulseId = seedFixture(4);
    const response = await get(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    const body = await response.text();
    for (const leak of ['few_times_week', 'it_technology', 'q5', 'answers']) {
      expect(body, leak).not.toContain(leak);
    }
  });
});

// --- response CSV ----------------------------------------------------------

describe('response CSV', () => {
  it('serves a download with the right headers and a safe filename', async () => {
    const pulseId = seedFixture(FIXTURE_RESPONSES.length, 'Q3 "Autumn" Pulse; 2026');
    const { response } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);

    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="q3-autumn-pulse-2026-responses.csv"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    // The administrator-supplied name cannot terminate the parameter or start
    // a second header.
    expect(response.headers.get('content-disposition')).not.toMatch(/[";\r\n]{2}/);
  });

  it('excludes Q1, Q2 and Q3 as columns and as values', async () => {
    const pulseId = seedFixture();
    const { headers, text } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);

    for (const id of WORK_CONTEXT_QUESTION_IDS) {
      expect(headers.some((h) => h.startsWith(`${id}_`)), id).toBe(false);
    }
    // Option ids that only Q1-Q3 can produce.
    for (const value of ['it_technology', 'legal_compliance', 'executive_owner', 'people_customers']) {
      expect(text, value).not.toContain(value);
    }
  });

  it('excludes Q27 as a column and as content', async () => {
    const pulseId = createPulse();
    const marker = 'PLEASE-DO-NOT-EXPORT-THIS-SENTENCE';
    const withText = FIXTURE_RESPONSES.slice(0, 10).map((response, index) => ({
      ...response,
      answers: { ...response.answers, q27: index === 0 ? marker : response.answers.q27 },
    }));
    insertResponses(pulseId, withText);

    const { headers, text } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    expect(headers.some((h) => h.startsWith('q27'))).toBe(false);
    expect(text).not.toContain(marker);
  });

  it('carries no date, no row id and no other identifier', async () => {
    const pulseId = seedFixture();
    const { headers, text } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);

    expect(headers).not.toContain('submitted_on');
    expect(headers).not.toContain('id');
    for (const forbidden of ['response_id', 'ip', 'user_agent', 'email', 'device']) {
      expect(headers, forbidden).not.toContain(forbidden);
    }
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('names columns readably and keeps them aligned with the rows', async () => {
    const pulseId = seedFixture();
    const { headers, rows } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);

    expect(headers[0]).toBe('survey_version');
    expect(headers).toContain('q5_work_ai_frequency');
    expect(headers).toContain('q19b_unmanaged_tool_use');
    expect(rows).toHaveLength(FIXTURE_RESPONSES.length);
    for (const row of rows) {
      expect(row).toHaveLength(headers.length);
    }
  });

  it('joins multi-selects with a pipe rather than an ambiguous comma', async () => {
    const pulseId = seedFixture();
    const { headers, rows } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    const q7 = headers.indexOf('q7_work_use_cases');

    const multi = rows.map((row) => row[q7] as string).filter((cell) => cell.includes('|'));
    expect(multi.length).toBeGreaterThan(0);
    for (const cell of multi) {
      for (const part of cell.split('|')) {
        expect(part, cell).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });

  it('does not preserve submission order', async () => {
    const pulseId = seedFixture();
    const { headers, rows } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    const q5 = headers.indexOf('q5_work_ai_frequency');

    const exported = rows.map((row) => row[q5]).join(',');
    const stored = FIXTURE_RESPONSES.map((response) => response.answers.q5 ?? '').join(',');
    expect(exported).not.toBe(stored);

    // And not the same order twice, so it is genuinely shuffled per request.
    const second = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    expect(second.rows.map((row) => row[q5]).join(',')).not.toBe(exported);
  });

  it('escapes a spreadsheet formula in a custom answer end to end', async () => {
    const pulseId = createPulse();
    db.raw
      .prepare(
        `INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
         VALUES (?, 'single_select', 'Which office?', ?, 1)`,
      )
      .run(pulseId, JSON.stringify([{ id: '=cmd', label: 'HQ' }, { id: 'remote', label: 'Remote' }]));

    insertResponses(
      pulseId,
      FIXTURE_RESPONSES.slice(0, 6),
      [{ c1: '=cmd|calc' }, { c1: 'remote' }, null, null, null, null],
    );

    const { headers, text } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    expect(headers).toContain('c1_which-office');
    // Guarded with a leading apostrophe, still inside one quoted field.
    expect(text).toContain('"\'=cmd|calc"');
    expect(text).not.toContain(',"=cmd');
  });

  it('includes organization-specific select answers but never custom free text', async () => {
    const pulseId = createPulse();
    db.raw
      .prepare(
        `INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
         VALUES (?, 'single_select', 'Which office?', ?, 1)`,
      )
      .run(pulseId, JSON.stringify([{ id: 'hq', label: 'HQ' }]));
    db.raw
      .prepare(
        `INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
         VALUES (?, 'free_text', 'Anything else?', NULL, 2)`,
      )
      .run(pulseId);

    insertResponses(pulseId, FIXTURE_RESPONSES.slice(0, 6), [
      { c1: 'hq', c2: 'A SENTENCE THAT MUST NOT BE EXPORTED' },
    ]);

    const { headers, text } = await csv(`/api/admin/pulses/${pulseId}/export/responses.csv`);
    expect(headers).toContain('c1_which-office');
    expect(headers.some((h) => h.startsWith('c2'))).toBe(false);
    expect(text).toContain('"hq"');
    expect(text).not.toContain('A SENTENCE THAT MUST NOT BE EXPORTED');
  });
});

// --- free-text CSV ---------------------------------------------------------

describe('free-text CSV', () => {
  it('serves a download with the right headers', async () => {
    const pulseId = seedFixture();
    const { response, headers } = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);

    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="q3-pulse-written-responses.csv"',
    );
    expect(headers).toEqual(['row_token', 'response_text']);
  });

  it('contains the written answer and a row token, and nothing else', async () => {
    const pulseId = seedFixture();
    const { rows, text } = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveLength(2);
      expect(row[0]).toMatch(/^t\d{4}$/);
      expect((row[1] as string).length).toBeGreaterThan(0);
    }

    // No context of any kind: no work-context option id, no date, no other
    // answer's option id, no score.
    for (const leak of [
      'it_technology', 'legal_compliance', 'executive_owner', 'people_customers',
      'few_times_week', 'multiple_times_day', 'strongly_agree', '2026-08',
    ]) {
      expect(text, leak).not.toContain(leak);
    }
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('randomises order between requests', async () => {
    const pulseId = seedFixture();
    const a = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);
    const b = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);

    const column = (parsed: typeof a) => parsed.rows.map((row) => row[1]).join('|');
    expect(column(a)).not.toBe(column(b));
    expect(a.rows).toHaveLength(b.rows.length);
  });

  it('escapes a formula written by a respondent', async () => {
    const pulseId = createPulse();
    const hostile = FIXTURE_RESPONSES.slice(0, 6).map((response, index) => ({
      ...response,
      answers: {
        ...response.answers,
        q27: index === 0 ? '=HYPERLINK("http://evil.example","click")' : 'ordinary answer',
      },
    }));
    insertResponses(pulseId, hostile);

    const { text } = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);
    expect(text).toContain('"\'=HYPERLINK(""http://evil.example"",""click"")"');
    expect(text).not.toMatch(/,"=HYPERLINK/);
  });

  it('returns a header-only file when nobody wrote anything', async () => {
    const pulseId = createPulse();
    const silent = FIXTURE_RESPONSES.slice(0, 8).map((response) => ({
      ...response,
      answers: { ...response.answers, q27: undefined },
    }));
    insertResponses(pulseId, silent);

    const { headers, rows, text } = await csv(`/api/admin/pulses/${pulseId}/export/free-text.csv`);
    expect(headers).toEqual(['row_token', 'response_text']);
    expect(rows).toEqual([]);
    // A header row and nothing else, rather than a file of empty rows.
    expect(text).toBe('"row_token","response_text"');
  });
});

// --- aggregate JSON --------------------------------------------------------

describe('aggregate results JSON', () => {
  it('serves a download with version stamps and no segment', async () => {
    const pulseId = seedFixture();
    const response = await get(`/api/admin/pulses/${pulseId}/export/results.json`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="q3-pulse-results.json"',
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.generated).toEqual({
      surveyVersion: '1.1.0',
      scoringVersion: '1.1.0',
      recommendationEngineVersion: '1.1.0',
    });
    expect(body.segment).toBeNull();
  });

  it('matches the results endpoint field for field', async () => {
    const pulseId = seedFixture();
    const exported = (await (
      await get(`/api/admin/pulses/${pulseId}/export/results.json`)
    ).json()) as { data: unknown };
    const live = await (await get(`/api/admin/pulses/${pulseId}/results`)).json();

    expect(exported.data).toEqual(live);
  });

  it('contains no response rows, no free text and no per-person data', async () => {
    const pulseId = createPulse();
    const marker = 'PLEASE-DO-NOT-EXPORT-THIS-SENTENCE';
    insertResponses(
      pulseId,
      FIXTURE_RESPONSES.slice(0, 20).map((entry, index) => ({
        ...entry,
        answers: { ...entry.answers, q27: index === 0 ? marker : entry.answers.q27 },
      })),
    );
    const response = await get(`/api/admin/pulses/${pulseId}/export/results.json`);
    const text = await response.clone().text();
    const body = (await response.json()) as unknown;

    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          walk(entry);
        }
      }
    };
    walk(body);

    for (const forbidden of ['respondents', 'answers', 'answers_json', 'submittedOn', 'q27', 'freeText']) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    // No written answer content. Segment VALUES such as `it_technology` do
    // appear, in the availability list the dashboard already shows - those are
    // option ids with a boolean beside them, never a group size or a row.
    expect(text).not.toContain(marker);
  });

  it('carries no respondent submission dates', async () => {
    const pulseId = seedFixture();
    const body = (await (
      await get(`/api/admin/pulses/${pulseId}/export/results.json`)
    ).json()) as { data: { pulse: Record<string, unknown> } };

    // The only dates in the file are the Pulse's own schedule, which is
    // configuration an administrator typed, not anything a respondent did.
    const dates = JSON.stringify(body).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    const scheduled = [body.data.pulse.opensOn, body.data.pulse.closesOn].filter(
      (value) => typeof value === 'string',
    );
    expect(new Set(dates)).toEqual(new Set(scheduled));
  });

  it('describes no suppressed group', async () => {
    const pulseId = seedFixture();
    const body = (await (
      await get(`/api/admin/pulses/${pulseId}/export/results.json`)
    ).json()) as { data: { segmentation: { available: { options: { reportable: boolean }[] }[] } } };

    // Availability is booleans only, exactly as on the dashboard: no group
    // sizes travel with the file.
    const options = body.data.segmentation.available.flatMap((entry) => entry.options);
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(Object.keys(option).sort()).toEqual(['reportable', 'value']);
    }
  });

  it('ignores a segment query parameter rather than honouring it', async () => {
    const pulseId = seedFixture();
    const plain = await (await get(`/api/admin/pulses/${pulseId}/export/results.json`)).text();
    const filtered = await (
      await get(`/api/admin/pulses/${pulseId}/export/results.json?dimension=department&value=it_technology`)
    ).text();

    expect(filtered).toBe(plain);
  });
});
