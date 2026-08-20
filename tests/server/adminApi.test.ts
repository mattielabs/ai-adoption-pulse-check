/**
 * Admin API integration tests.
 *
 * These drive the real Hono application against real SQLite with the project's
 * real migrations (tests/support/sqliteD1.ts), so constraints, cascades and
 * transactional rollback are exercised rather than mocked.
 *
 * Sessions are minted directly with `issueSession` for everything except the
 * login tests. That is deliberate: PBKDF2 at 600,000 iterations costs about
 * half a second per verification, and paying it in every test would say
 * nothing that the login tests do not already say.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/server/index.js';
import type { Env } from '../../src/server/env.js';
import type { RateLimitBinding } from '../../src/server/lib/throttle.js';
import { createPasscodeHash } from '../../src/server/lib/passcode.js';
import { issueSession, SESSION_COOKIE_NAME } from '../../src/server/lib/session.js';
import { createPulse } from '../../src/server/lib/adminRepo.js';
import { isGeneratedPublicId } from '../../src/server/lib/publicId.js';
import { createSqliteD1, type SqliteD1 } from '../support/sqliteD1.js';
import { todayUtcDate } from '../../src/server/lib/dates.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import type { AdminPulseDetail, AdminPulseSummary } from '../../src/core/admin/contracts.js';
import { answers } from '../helpers.js';

const ORIGIN = 'http://localhost';
const SESSION_SECRET = 'test-session-secret-that-is-long-enough';
const PASSCODE = 'a-good-local-test-passcode';

let passcodeHash: string;
let sessionCookie: string;

beforeAll(async () => {
  passcodeHash = await createPasscodeHash(PASSCODE);
  const session = await issueSession(SESSION_SECRET, Date.now());
  sessionCookie = `${SESSION_COOKIE_NAME}=${session.token}`;
}, 60_000);

let db: SqliteD1;
let env: Env;

function makeEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DB: db,
    ENVIRONMENT: 'test',
    ADMIN_PASSCODE_HASH: passcodeHash,
    SESSION_SECRET,
    ...overrides,
  } as unknown as Env;
}

/**
 * Replaces the CSPRNG for one test so a public-id collision can be forced.
 * The real source is restored by the caller.
 */
function stubRandomBytes(fill: (bytes: Uint8Array) => Uint8Array | void) {
  return vi.spyOn(crypto, 'getRandomValues').mockImplementation(((view: Uint8Array) => {
    fill(view);
    return view;
  }) as unknown as typeof crypto.getRandomValues);
}

/** Decodes a base64url public id back to its raw bytes. */
function publicIdBytes(publicId: string): Uint8Array {
  const padded = publicId.replace(/-/g, '+').replace(/_/g, '/').padEnd(24, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

beforeEach(() => {
  db = createSqliteD1();
  env = makeEnv();
});

// --- request helpers -------------------------------------------------------

interface RequestOptions {
  readonly body?: unknown;
  readonly cookie?: string | null;
  readonly origin?: string | null;
  readonly env?: Env;
}

function request(method: string, path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const cookie = options.cookie === undefined ? sessionCookie : options.cookie;
  if (cookie !== null) headers['cookie'] = cookie;

  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers['origin'] = origin;

  return app.request(
    path,
    {
      method,
      headers,
      ...(options.body === undefined
        ? {}
        : { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }),
    },
    options.env ?? env,
  );
}

const get = (path: string, options?: RequestOptions) => request('GET', path, options);
const post = (path: string, body?: unknown, options?: RequestOptions) =>
  request('POST', path, { ...options, ...(body === undefined ? {} : { body }) });
const patch = (path: string, body: unknown, options?: RequestOptions) =>
  request('PATCH', path, { ...options, body });
const del = (path: string, options?: RequestOptions) => request('DELETE', path, options);

const ORGANIZATION = {
  name: 'Northwind Trading',
  logoUrl: 'https://example.org/logo.png',
  accentColor: '#0f766e',
  surveyIntro: 'A short note from our leadership team.',
};

async function setupOrganization(): Promise<void> {
  const res = await post('/api/admin/organization', ORGANIZATION);
  expect(res.status).toBe(201);
}

async function createPulseVia(
  body: Record<string, unknown> = {},
): Promise<{ id: number; publicId: string }> {
  const res = await post('/api/admin/pulses', {
    name: 'Q3 AI Adoption Pulse',
    opensOn: todayUtcDate(),
    ...body,
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: number; publicId: string };
}

async function submitResponse(publicId: string): Promise<Response> {
  return app.request(
    `/api/pulses/${publicId}/responses`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ surveyVersion: SURVEY_VERSION, answers: answers() }),
    },
    env,
  );
}

async function detail(id: number): Promise<AdminPulseDetail> {
  const res = await get(`/api/admin/pulses/${id}`);
  expect(res.status).toBe(200);
  return (await res.json()) as AdminPulseDetail;
}

// ---------------------------------------------------------------------------
// Authorization boundary
// ---------------------------------------------------------------------------

describe('admin endpoints fail closed without a session', () => {
  const protectedRequests: readonly [string, string, unknown?][] = [
    ['GET', '/api/admin/session'],
    ['GET', '/api/admin/organization'],
    ['POST', '/api/admin/organization', ORGANIZATION],
    ['PATCH', '/api/admin/organization', ORGANIZATION],
    ['GET', '/api/admin/pulses'],
    ['POST', '/api/admin/pulses', { name: 'X', opensOn: '2026-08-19' }],
    ['GET', '/api/admin/pulses/1'],
    ['PATCH', '/api/admin/pulses/1', { name: 'X' }],
    ['POST', '/api/admin/pulses/1/close'],
    ['DELETE', '/api/admin/pulses/1'],
  ];

  it.each(protectedRequests)('%s %s returns 401 with no cookie', async (method, path, body) => {
    const res = await request(method, path, { cookie: null, ...(body === undefined ? {} : { body }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it.each(protectedRequests)('%s %s returns 401 with a forged cookie', async (method, path, body) => {
    const res = await request(method, path, {
      cookie: `${SESSION_COOKIE_NAME}=forged.token`,
      ...(body === undefined ? {} : { body }),
    });
    expect(res.status).toBe(401);
  });

  it('refuses an expired session', async () => {
    const old = await issueSession(SESSION_SECRET, Date.now() - 9 * 60 * 60 * 1000);
    const res = await get('/api/admin/pulses', { cookie: `${SESSION_COOKIE_NAME}=${old.token}` });
    expect(res.status).toBe(401);
  });

  it('refuses a session signed with a rotated secret', async () => {
    const res = await get('/api/admin/pulses', {
      env: makeEnv({ SESSION_SECRET: 'a-completely-different-secret-value-here' }),
    });
    expect(res.status).toBe(401);
  });

  it('writes nothing when the request is unauthorized', async () => {
    await request('POST', '/api/admin/organization', { cookie: null, body: ORGANIZATION });
    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number };
    expect(count.n).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

describe('POST /api/admin/login', () => {
  it('accepts the correct passcode and sets a hardened session cookie', async () => {
    const res = await post('/api/admin/login', { passcode: PASSCODE }, { cookie: null });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, organizationConfigured: false });

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain(PASSCODE);
  }, 30_000);

  it('issues a session that actually authorizes a protected endpoint', async () => {
    const login = await post('/api/admin/login', { passcode: PASSCODE }, { cookie: null });
    const setCookie = login.headers.get('set-cookie') ?? '';
    const token = setCookie.slice(0, setCookie.indexOf(';'));

    const res = await get('/api/admin/pulses', { cookie: token });
    expect(res.status).toBe(200);
  }, 30_000);

  it('reports the first-run state so the client knows to go to setup', async () => {
    await setupOrganization();
    const res = await post('/api/admin/login', { passcode: PASSCODE }, { cookie: null });
    expect(await res.json()).toEqual({ authenticated: true, organizationConfigured: true });
  }, 30_000);

  it('rejects an incorrect passcode generically', async () => {
    const res = await post('/api/admin/login', { passcode: 'not-the-right-passcode' }, { cookie: null });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
    expect(res.headers.get('set-cookie')).toBeNull();
  }, 30_000);

  it('gives a passcode that fails the length gate the SAME response - no length oracle', async () => {
    const res = await post('/api/admin/login', { passcode: 'short' }, { cookie: null });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('does not reveal which field was wrong', async () => {
    const res = await post('/api/admin/login', { passcode: 12345 }, { cookie: null });
    expect(res.status).toBe(401);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/passcode|length|expected|string/i);
  });

  it('reports a missing passcode hash as a generic server error, not as bad credentials', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, env: makeEnv({ ADMIN_PASSCODE_HASH: undefined }) },
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_not_configured' });
    // The log line carries no secret material.
    for (const call of errors.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(PASSCODE);
      expect(JSON.stringify(call)).not.toContain(passcodeHash);
    }
    errors.mockRestore();
  });

  it('reports a malformed passcode hash as a generic server error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, env: makeEnv({ ADMIN_PASSCODE_HASH: 'pbkdf2-sha256$1$x$y' }) },
    );
    expect(res.status).toBe(500);
    errors.mockRestore();
  });

  it('refuses to issue a session when SESSION_SECRET is unusable', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, env: makeEnv({ SESSION_SECRET: 'too-short' }) },
    );
    expect(res.status).toBe(500);
    errors.mockRestore();
  }, 30_000);
});

describe('login throttling', () => {
  function limiter(limit: number): RateLimitBinding & { readonly keys: string[] } {
    const counts = new Map<string, number>();
    const keys: string[] = [];
    return {
      keys,
      limit({ key }) {
        keys.push(key);
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return Promise.resolve({ success: next <= limit });
      },
    };
  }

  it('refuses further attempts once the limiter is exhausted, before doing any derivation', async () => {
    const binding = limiter(0);
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, env: makeEnv({ ADMIN_LOGIN_LIMITER: binding }) },
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'too_many_attempts' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('charges a failed attempt twice, so guessing exhausts the budget faster', async () => {
    const binding = limiter(10);
    const throttled = makeEnv({ ADMIN_LOGIN_LIMITER: binding });

    await post('/api/admin/login', { passcode: 'definitely-wrong-passcode' }, { cookie: null, env: throttled });
    expect(binding.keys).toHaveLength(2);

    await post('/api/admin/login', { passcode: PASSCODE }, { cookie: null, env: throttled });
    expect(binding.keys).toHaveLength(3);
  }, 30_000);

  it('never exposes the limiter key or client address to the client', async () => {
    const binding = limiter(0);
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, env: makeEnv({ ADMIN_LOGIN_LIMITER: binding }) },
    );

    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('login:');
    expect(res.headers.get('retry-after')).toBeNull();
  });

  it('stores no login attempt records in the database', async () => {
    const binding = limiter(10);
    await post(
      '/api/admin/login',
      { passcode: 'definitely-wrong-passcode' },
      { cookie: null, env: makeEnv({ ADMIN_LOGIN_LIMITER: binding }) },
    );

    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).filter((n) => !n.startsWith('sqlite_'));

    expect(names.sort()).toEqual(['custom_questions', 'organizations', 'pulses', 'responses']);
  }, 30_000);

  it('succeeds without throttling when no limiter binding is configured', async () => {
    const res = await post('/api/admin/login', { passcode: PASSCODE }, { cookie: null });
    expect(res.status).toBe(200);
  }, 30_000);
});

describe('POST /api/admin/logout', () => {
  it('clears the cookie', async () => {
    const res = await post('/api/admin/logout');
    expect(res.status).toBe(200);

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cookie).toContain('Max-Age=0');
  });

  it('works without a session, so an expired cookie can still be discarded', async () => {
    const res = await post('/api/admin/logout', undefined, { cookie: null });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Cross-origin mutation protection
// ---------------------------------------------------------------------------

describe('cross-origin mutation protection', () => {
  it('rejects a state-changing request from another origin', async () => {
    const res = await post('/api/admin/organization', ORGANIZATION, {
      origin: 'https://attacker.example.com',
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'cross_origin_request_rejected' });

    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('rejects a cross-origin login attempt before any passcode work', async () => {
    const res = await post(
      '/api/admin/login',
      { passcode: PASSCODE },
      { cookie: null, origin: 'https://attacker.example.com' },
    );
    expect(res.status).toBe(403);
  });

  it('rejects a cross-origin delete', async () => {
    await setupOrganization();
    const { id } = await createPulseVia();

    const res = await del(`/api/admin/pulses/${id}`, { origin: 'https://attacker.example.com' });
    expect(res.status).toBe(403);
    expect((await detail(id)).id).toBe(id);
  });

  it('allows a same-origin mutation', async () => {
    const res = await post('/api/admin/organization', ORGANIZATION, { origin: ORIGIN });
    expect(res.status).toBe(201);
  });

  it('leaves non-mutating reads unaffected by the Origin header', async () => {
    await setupOrganization();
    const res = await get('/api/admin/pulses', { origin: 'https://attacker.example.com' });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

describe('organization setup', () => {
  it('reports no organization on first run', async () => {
    expect(await (await get('/api/admin/organization')).json()).toEqual({ organization: null });
    expect(await (await get('/api/admin/session')).json()).toEqual({
      authenticated: true,
      organizationConfigured: false,
    });
  });

  it('creates the first organization and reports it as configured', async () => {
    await setupOrganization();

    expect(await (await get('/api/admin/organization')).json()).toEqual({ organization: ORGANIZATION });
    expect(await (await get('/api/admin/session')).json()).toEqual({
      authenticated: true,
      organizationConfigured: true,
    });
  });

  it('refuses to create a second organization', async () => {
    await setupOrganization();

    const res = await post('/api/admin/organization', { ...ORGANIZATION, name: 'Second Org' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'organization_already_configured' });

    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('edits the existing organization rather than creating another', async () => {
    await setupOrganization();

    const res = await patch('/api/admin/organization', { ...ORGANIZATION, name: 'Northwind Group' });
    expect(res.status).toBe(200);

    const body = (await (await get('/api/admin/organization')).json()) as { organization: { name: string } };
    expect(body.organization.name).toBe('Northwind Group');

    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('refuses a settings edit before setup', async () => {
    const res = await patch('/api/admin/organization', ORGANIZATION);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'organization_not_configured' });
  });

  it('clears optional fields submitted empty', async () => {
    await setupOrganization();
    await patch('/api/admin/organization', {
      name: 'Northwind Trading',
      logoUrl: '',
      accentColor: '',
      surveyIntro: '  ',
    });

    expect(await (await get('/api/admin/organization')).json()).toEqual({
      organization: { name: 'Northwind Trading', logoUrl: null, accentColor: null, surveyIntro: null },
    });
  });

  it.each([
    ['a javascript: logo URL', { logoUrl: 'javascript:alert(1)' }],
    ['a data: logo URL', { logoUrl: 'data:text/html;base64,PHNjcmlwdD4=' }],
    ['a relative logo URL', { logoUrl: '/logo.png' }],
    ['a named colour', { accentColor: 'red' }],
    ['a three-digit hex colour', { accentColor: '#fff' }],
    ['a colour with no hash', { accentColor: '0f766e' }],
    ['a blank name', { name: '   ' }],
    ['an over-long name', { name: 'x'.repeat(200) }],
  ])('rejects %s', async (_label, override) => {
    const res = await post('/api/admin/organization', { ...ORGANIZATION, ...override });
    expect(res.status).toBe(400);
  });

  it('stores a script-like survey intro as plain text', async () => {
    const intro = '<script>alert("x")</script> Welcome!';
    await post('/api/admin/organization', { ...ORGANIZATION, surveyIntro: intro });

    const stored = db.raw.prepare('SELECT survey_intro FROM organizations').get() as {
      survey_intro: string;
    };
    // Stored verbatim as text - no HTML parsing, no sanitiser, no Markdown.
    // React escapes it on render; there is no dangerouslySetInnerHTML anywhere.
    expect(stored.survey_intro).toBe(intro);
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const res = await post('/api/admin/organization', { ...ORGANIZATION, id: 99 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Pulse creation
// ---------------------------------------------------------------------------

describe('pulse creation', () => {
  beforeEach(async () => {
    await setupOrganization();
  });

  it('creates a Pulse in the normal active lifecycle', async () => {
    const { id, publicId } = await createPulseVia({ description: 'Help us understand AI use.' });

    const created = await detail(id);
    expect(created.name).toBe('Q3 AI Adoption Pulse');
    expect(created.description).toBe('Help us understand AI use.');
    expect(created.state).toBe('open');
    expect(created.responseCount).toBe(0);
    expect(created.publicId).toBe(publicId);
    expect(created.surveyVersion).toBe(SURVEY_VERSION);
    expect(created.configurationEditable).toBe(true);
  });

  it('stamps the current engine versions', async () => {
    const { id } = await createPulseVia();
    const row = db.raw
      .prepare('SELECT survey_version, scoring_version, recommendation_version, status FROM pulses WHERE id = ?')
      .get(id) as Record<string, string>;

    expect(row).toEqual({
      survey_version: '1.1.0',
      scoring_version: '1.1.0',
      recommendation_version: '1.1.0',
      status: 'open',
    });
  });

  it('gives every Pulse a cryptographically random public id', async () => {
    // Same name, same dates, same everything: if the id were derived from the
    // configuration these would collide. Asserted over several pairs, because
    // one pair not colliding is weak evidence.
    const ids = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const created = await createPulseVia();
      expect(isGeneratedPublicId(created.publicId)).toBe(true);
      ids.add(created.publicId);
    }
    expect(ids.size).toBe(8);

    // Deliberately NOT a substring check against the Pulse name. Twenty-two
    // characters drawn from a 64-symbol alphabet contain any given two-letter
    // sequence roughly once in two hundred runs, so "the id does not contain
    // 'q3'" is a coin flip dressed up as an assertion - it failed once during a
    // clean-install rehearsal. Uniqueness across identical inputs is the
    // property that actually matters, and it is not probabilistic.
  });

  it('schedules a future Pulse as upcoming', async () => {
    const { id } = await createPulseVia({ name: 'Next quarter', opensOn: '2099-01-01' });
    expect((await detail(id)).state).toBe('upcoming');
  });

  it('honours the personal-result setting in both directions', async () => {
    const on = await createPulseVia({ personalResultsEnabled: true });
    const off = await createPulseVia({ name: 'No results', personalResultsEnabled: false });

    expect((await detail(on.id)).personalResultsEnabled).toBe(true);
    expect((await detail(off.id)).personalResultsEnabled).toBe(false);
  });

  it('defaults the personal result to enabled', async () => {
    const { id } = await createPulseVia();
    expect((await detail(id)).personalResultsEnabled).toBe(true);
  });

  it.each([
    ['a closing date before the opening date', { opensOn: '2026-09-01', closesOn: '2026-08-01' }],
    ['a date that does not exist', { opensOn: '2026-02-30' }],
    ['a timestamp instead of a day', { opensOn: '2026-08-19T10:00:00Z' }],
    ['a missing opening date', { opensOn: undefined }],
    ['a blank name', { name: '  ' }],
  ])('rejects %s', async (_label, override) => {
    const body: Record<string, unknown> = { name: 'Q3', opensOn: todayUtcDate(), ...override };
    if ('opensOn' in override && override.opensOn === undefined) delete body.opensOn;

    const res = await post('/api/admin/pulses', body);
    expect(res.status).toBe(400);
  });

  it('refuses creation before the organization exists', async () => {
    db = createSqliteD1();
    env = makeEnv();

    const res = await post('/api/admin/pulses', { name: 'Q3', opensOn: todayUtcDate() });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'organization_not_configured' });
  });

  describe('custom questions', () => {
    const single = {
      type: 'single_select',
      questionText: 'Which location do you mostly work from?',
      optionLabels: ['Headquarters', 'Regional office', 'Mostly remote'],
    };
    const multi = {
      type: 'multi_select',
      questionText: 'Which internal systems do you use most weeks?',
      optionLabels: ['CRM', 'ERP', 'Internal wiki'],
    };
    const free = { type: 'free_text', questionText: 'Anything else to flag?' };

    it('creates a Pulse with no custom questions', async () => {
      const { id } = await createPulseVia();
      expect((await detail(id)).customQuestions).toEqual([]);
    });

    it('creates a Pulse with one custom question and generates machine ids', async () => {
      const { id } = await createPulseVia({ customQuestions: [single] });
      const created = await detail(id);

      expect(created.customQuestions).toEqual([
        {
          position: 1,
          type: 'single_select',
          questionText: single.questionText,
          options: [
            { id: 'headquarters', label: 'Headquarters' },
            { id: 'regional_office', label: 'Regional office' },
            { id: 'mostly_remote', label: 'Mostly remote' },
          ],
        },
      ]);
    });

    it('creates a Pulse with three custom questions in order', async () => {
      const { id } = await createPulseVia({ customQuestions: [single, multi, free] });
      const created = await detail(id);

      expect(created.customQuestions.map((q) => q.position)).toEqual([1, 2, 3]);
      expect(created.customQuestions.map((q) => q.type)).toEqual([
        'single_select',
        'multi_select',
        'free_text',
      ]);
      expect(created.customQuestions[2]?.options).toBeNull();
    });

    it('rejects a fourth custom question', async () => {
      const res = await post('/api/admin/pulses', {
        name: 'Q3',
        opensOn: todayUtcDate(),
        customQuestions: [single, multi, free, free],
      });
      expect(res.status).toBe(400);
    });

    it.each([
      ['a select question with one option', { ...single, optionLabels: ['Only one'] }],
      ['a select question with no options', { ...single, optionLabels: [] }],
      ['duplicate option labels', { ...single, optionLabels: ['Remote', 'remote'] }],
      ['a blank option label', { ...single, optionLabels: ['Head office', '  '] }],
      ['a free-text question carrying options', { ...free, optionLabels: ['a', 'b'] }],
      ['a blank question text', { ...single, questionText: '   ' }],
      ['an unknown question type', { ...single, type: 'ranking' }],
      ['an over-long question text', { ...single, questionText: 'x'.repeat(400) }],
    ])('rejects %s', async (_label, question) => {
      const res = await post('/api/admin/pulses', {
        name: 'Q3',
        opensOn: todayUtcDate(),
        customQuestions: [question],
      });
      expect(res.status).toBe(400);
    });

    it('rolls the whole Pulse back when a custom-question write fails', async () => {
      const before = db.raw.prepare('SELECT COUNT(*) AS n FROM pulses').get() as { n: number };

      // Four questions bypasses the API schema and violates the
      // custom_questions position CHECK on the fourth insert.
      await expect(
        createPulse(db, {
          organizationId: 1,
          name: 'Doomed',
          description: null,
          opensOn: todayUtcDate(),
          closesOn: null,
          personalResultsEnabled: true,
          customQuestions: Array.from({ length: 4 }, () => ({
            type: 'free_text' as const,
            questionText: 'x',
            optionLabels: [],
          })),
        }),
      ).rejects.toThrow();

      const after = db.raw.prepare('SELECT COUNT(*) AS n FROM pulses').get() as { n: number };
      const orphans = db.raw.prepare('SELECT COUNT(*) AS n FROM custom_questions').get() as { n: number };

      expect(after.n).toBe(before.n);
      expect(orphans.n).toBe(0);
    });
  });

  describe('public id collisions', () => {
    it('retries and succeeds when the first generated id is taken', async () => {
      const first = await createPulseVia();
      const taken = publicIdBytes(first.publicId);

      let call = 0;
      const spy = stubRandomBytes((bytes) => {
        call += 1;
        // Collide once, then hand back distinguishable bytes.
        bytes.set(call === 1 ? taken : taken.map((byte) => byte ^ 0xff));
      });

      const res = await post('/api/admin/pulses', { name: 'Retry', opensOn: todayUtcDate() });
      spy.mockRestore();

      expect(res.status).toBe(201);
      expect(((await res.json()) as { publicId: string }).publicId).not.toBe(first.publicId);
    });

    it('gives up after a bounded number of attempts rather than looping', async () => {
      const first = await createPulseVia();
      const taken = publicIdBytes(first.publicId);

      const spy = stubRandomBytes((bytes) => bytes.set(taken));
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await post('/api/admin/pulses', { name: 'Always collides', opensOn: todayUtcDate() });

      spy.mockRestore();
      errors.mockRestore();

      expect(res.status).toBe(500);
      const count = db.raw.prepare('SELECT COUNT(*) AS n FROM pulses').get() as { n: number };
      expect(count.n).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// The bridge to the employee experience
// ---------------------------------------------------------------------------

describe('an admin-created Pulse serves the employee survey', () => {
  beforeEach(async () => {
    await setupOrganization();
  });

  it('loads through the public endpoint with its configuration and branding', async () => {
    const { publicId } = await createPulseVia({
      description: 'Ten minutes, no names collected.',
      customQuestions: [
        {
          type: 'single_select',
          questionText: 'Which site?',
          optionLabels: ['Head office', 'Remote'],
        },
      ],
    });

    const res = await app.request(`/api/pulses/${publicId}`, {}, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.name).toBe('Q3 AI Adoption Pulse');
    expect(body.availability).toBe('available');
    expect(body.organization).toEqual({
      name: ORGANIZATION.name,
      logoUrl: ORGANIZATION.logoUrl,
      accentColor: ORGANIZATION.accentColor,
      surveyIntro: ORGANIZATION.surveyIntro,
    });
    expect(body.customQuestions).toEqual([
      {
        key: 'c1',
        type: 'single_select',
        questionText: 'Which site?',
        options: [
          { id: 'head_office', label: 'Head office' },
          { id: 'remote', label: 'Remote' },
        ],
      },
    ]);
    // The public payload never carries the internal row id.
    expect(Object.keys(body)).not.toContain('id');
  });

  it('accepts a response and increments the admin count', async () => {
    const { id, publicId } = await createPulseVia();

    expect((await detail(id)).responseCount).toBe(0);
    expect((await submitResponse(publicId)).status).toBe(201);
    expect((await detail(id)).responseCount).toBe(1);
    expect((await submitResponse(publicId)).status).toBe(201);
    expect((await detail(id)).responseCount).toBe(2);
  });

  it('does not expose response content through any admin endpoint', async () => {
    const { id, publicId } = await createPulseVia();
    await submitResponse(publicId);

    const detailBody = await (await get(`/api/admin/pulses/${id}`)).text();
    const listBody = await (await get('/api/admin/pulses')).text();

    for (const body of [detailBody, listBody]) {
      expect(body).not.toContain('answers_json');
      expect(body).not.toContain('q19b');
      expect(body).not.toContain('submitted_on');
    }
  });

  it('is not reachable through the public API by its internal id', async () => {
    const { id } = await createPulseVia();
    const res = await app.request(`/api/pulses/${id}`, {}, env);
    expect(res.status).toBe(404);
  });

  it('does not appear on the employee route before it opens', async () => {
    const { publicId } = await createPulseVia({ opensOn: '2099-01-01' });
    const body = (await (await app.request(`/api/pulses/${publicId}`, {}, env)).json()) as {
      availability: string;
    };
    expect(body.availability).toBe('not_yet_open');
  });
});

// ---------------------------------------------------------------------------
// Pulse list
// ---------------------------------------------------------------------------

describe('GET /api/admin/pulses', () => {
  it('is empty before anything is created', async () => {
    await setupOrganization();
    expect(await (await get('/api/admin/pulses')).json()).toEqual({ pulses: [] });
  });

  it('is empty, not an error, before the organization exists', async () => {
    const res = await get('/api/admin/pulses');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pulses: [] });
  });

  it('lists operational state, dates and response counts', async () => {
    await setupOrganization();
    const active = await createPulseVia({ name: 'Active', closesOn: '2099-12-31' });
    await createPulseVia({ name: 'Upcoming', opensOn: '2099-01-01' });
    const closed = await createPulseVia({ name: 'To close' });
    await post(`/api/admin/pulses/${closed.id}/close`);
    await submitResponse(active.publicId);

    const body = (await (await get('/api/admin/pulses')).json()) as { pulses: AdminPulseSummary[] };
    const byName = new Map(body.pulses.map((p) => [p.name, p]));

    expect(byName.get('Active')?.state).toBe('open');
    expect(byName.get('Active')?.responseCount).toBe(1);
    expect(byName.get('Active')?.closesOn).toBe('2099-12-31');
    expect(byName.get('Upcoming')?.state).toBe('upcoming');
    expect(byName.get('To close')?.state).toBe('closed');
    expect(byName.get('To close')?.responseCount).toBe(0);
  });

  it('carries operational fields only - no scores, no recommendations', async () => {
    await setupOrganization();
    const { publicId } = await createPulseVia({ name: 'Autumn check' });
    await submitResponse(publicId);

    const body = (await (await get('/api/admin/pulses')).json()) as { pulses: AdminPulseSummary[] };

    // The exhaustive field set: adding an analytical field to the admin list
    // would have to break this assertion first.
    expect(Object.keys(body.pulses[0] ?? {}).sort()).toEqual([
      'closesOn',
      'id',
      'name',
      'opensOn',
      'publicId',
      'responseCount',
      'state',
    ]);
    expect(JSON.stringify(body)).not.toMatch(
      /adoption|confidence|workflow|safety|enablement|recommendation|opportunit|classification/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Editing and configuration locks
// ---------------------------------------------------------------------------

describe('editing a Pulse before any responses', () => {
  let pulse: { id: number; publicId: string };

  beforeEach(async () => {
    await setupOrganization();
    pulse = await createPulseVia({
      description: 'Original description',
      customQuestions: [{ type: 'free_text', questionText: 'Original question' }],
    });
  });

  it('allows the name and description to change', async () => {
    expect((await patch(`/api/admin/pulses/${pulse.id}`, { name: 'Renamed', description: 'New' })).status).toBe(200);

    const updated = await detail(pulse.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.description).toBe('New');
  });

  it('allows the dates to change', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { opensOn: '2099-01-01', closesOn: '2099-03-01' });

    const updated = await detail(pulse.id);
    expect(updated.opensOn).toBe('2099-01-01');
    expect(updated.closesOn).toBe('2099-03-01');
    expect(updated.state).toBe('upcoming');
  });

  it('allows the personal-result setting to change', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { personalResultsEnabled: false });
    expect((await detail(pulse.id)).personalResultsEnabled).toBe(false);
  });

  it('allows custom questions to be replaced', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, {
      customQuestions: [
        { type: 'single_select', questionText: 'Which team?', optionLabels: ['Sales', 'Support'] },
      ],
    });

    const updated = await detail(pulse.id);
    expect(updated.customQuestions).toHaveLength(1);
    expect(updated.customQuestions[0]?.questionText).toBe('Which team?');
    expect(updated.customQuestions[0]?.options).toEqual([
      { id: 'sales', label: 'Sales' },
      { id: 'support', label: 'Support' },
    ]);

    // Replacement, not accumulation.
    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM custom_questions').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('clears the description when an empty value is sent', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { description: '' });
    expect((await detail(pulse.id)).description).toBeNull();
  });

  it('reflects an allowed change on the public employee endpoint', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { name: 'Autumn Pulse Check' });

    const body = (await (await app.request(`/api/pulses/${pulse.publicId}`, {}, env)).json()) as {
      name: string;
    };
    expect(body.name).toBe('Autumn Pulse Check');
  });

  it('refuses a closing date before the stored opening date', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { opensOn: '2099-06-01' });

    const res = await patch(`/api/admin/pulses/${pulse.id}`, { closesOn: '2099-01-01' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty update', async () => {
    expect((await patch(`/api/admin/pulses/${pulse.id}`, {})).status).toBe(400);
  });

  it('rejects version fields outright - they are methodology, not configuration', async () => {
    for (const body of [
      { surveyVersion: '2.0.0' },
      { scoringVersion: '2.0.0' },
      { recommendationVersion: '2.0.0' },
      { status: 'open' },
      { publicId: 'chosen-by-me' },
    ]) {
      expect((await patch(`/api/admin/pulses/${pulse.id}`, body)).status).toBe(400);
    }

    const row = db.raw.prepare('SELECT survey_version FROM pulses WHERE id = ?').get(pulse.id) as {
      survey_version: string;
    };
    expect(row.survey_version).toBe('1.1.0');
  });

  it('returns 404 for a Pulse that does not exist', async () => {
    expect((await patch('/api/admin/pulses/9999', { name: 'X' })).status).toBe(404);
    expect((await get('/api/admin/pulses/9999')).status).toBe(404);
    expect((await get('/api/admin/pulses/not-a-number')).status).toBe(404);
  });
});

describe('configuration locks after the first response', () => {
  let pulse: { id: number; publicId: string };

  beforeEach(async () => {
    await setupOrganization();
    pulse = await createPulseVia({
      customQuestions: [{ type: 'free_text', questionText: 'Original question' }],
    });
    expect((await submitResponse(pulse.publicId)).status).toBe(201);
  });

  it('reports the Pulse as no longer freely editable', async () => {
    const locked = await detail(pulse.id);
    expect(locked.configurationEditable).toBe(false);
    expect(locked.responseCount).toBe(1);
  });

  it('still allows the display name, description and closing date to change', async () => {
    const res = await patch(`/api/admin/pulses/${pulse.id}`, {
      name: 'Renamed after launch',
      description: 'Clarified',
      closesOn: '2099-12-31',
    });
    expect(res.status).toBe(200);

    const updated = await detail(pulse.id);
    expect(updated.name).toBe('Renamed after launch');
    expect(updated.closesOn).toBe('2099-12-31');
  });

  it.each([
    ['the opening date', { opensOn: '2030-01-01' }, 'opensOn'],
    ['the personal-result setting', { personalResultsEnabled: false }, 'personalResultsEnabled'],
    ['custom questions', { customQuestions: [] }, 'customQuestions'],
  ])('refuses to change %s', async (_label, body, field) => {
    const res = await patch(`/api/admin/pulses/${pulse.id}`, body);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'pulse_configuration_locked', fields: [field] });
  });

  it('reports every locked field in one response', async () => {
    const res = await patch(`/api/admin/pulses/${pulse.id}`, {
      name: 'Fine',
      opensOn: '2030-01-01',
      personalResultsEnabled: false,
    });

    expect(res.status).toBe(409);
    expect(((await res.json()) as { fields: string[] }).fields.sort()).toEqual([
      'opensOn',
      'personalResultsEnabled',
    ]);
  });

  it('changes nothing at all when a locked field is present', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { name: 'Should not stick', opensOn: '2030-01-01' });

    const unchanged = await detail(pulse.id);
    expect(unchanged.name).toBe('Q3 AI Adoption Pulse');
    expect(unchanged.customQuestions[0]?.questionText).toBe('Original question');
  });

  it('keeps the configuration respondents actually saw', async () => {
    await patch(`/api/admin/pulses/${pulse.id}`, { customQuestions: [] });

    const count = db.raw.prepare('SELECT COUNT(*) AS n FROM custom_questions').get() as { n: number };
    expect(count.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

describe('closing a Pulse', () => {
  let pulse: { id: number; publicId: string };

  beforeEach(async () => {
    await setupOrganization();
    pulse = await createPulseVia();
  });

  it('stops the public survey immediately', async () => {
    expect((await post(`/api/admin/pulses/${pulse.id}/close`)).status).toBe(200);

    const publicView = (await (await app.request(`/api/pulses/${pulse.publicId}`, {}, env)).json()) as {
      availability: string;
    };
    expect(publicView.availability).toBe('closed');
  });

  it('refuses a submission from a page that was already open', async () => {
    // The employee loaded the survey while it was open...
    expect((await app.request(`/api/pulses/${pulse.publicId}`, {}, env)).status).toBe(200);
    await post(`/api/admin/pulses/${pulse.id}/close`);

    // ...and submits after the close. The server is authoritative.
    const res = await submitResponse(pulse.publicId);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_accepting_responses', reason: 'closed' });
  });

  it('preserves responses collected before the close', async () => {
    await submitResponse(pulse.publicId);
    await post(`/api/admin/pulses/${pulse.id}/close`);

    const closed = await detail(pulse.id);
    expect(closed.state).toBe('closed');
    expect(closed.responseCount).toBe(1);
  });

  it('records when it was closed', async () => {
    await post(`/api/admin/pulses/${pulse.id}/close`);
    const row = db.raw.prepare('SELECT closed_at FROM pulses WHERE id = ?').get(pulse.id) as {
      closed_at: string | null;
    };
    expect(row.closed_at).not.toBeNull();
  });

  it('reports a second close rather than silently re-closing', async () => {
    await post(`/api/admin/pulses/${pulse.id}/close`);

    const res = await post(`/api/admin/pulses/${pulse.id}/close`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'pulse_already_closed' });
  });

  it('cannot be reopened - no endpoint or field sets the status back', async () => {
    await post(`/api/admin/pulses/${pulse.id}/close`);

    expect((await patch(`/api/admin/pulses/${pulse.id}`, { status: 'open' })).status).toBe(400);
    expect((await post(`/api/admin/pulses/${pulse.id}/reopen`)).status).toBe(404);
    expect((await detail(pulse.id)).state).toBe('closed');
  });

  it('returns 404 for a Pulse that does not exist', async () => {
    expect((await post('/api/admin/pulses/9999/close')).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Duplicate (through the single creation path)
// ---------------------------------------------------------------------------

describe('duplicating a Pulse', () => {
  it('creates an independent Pulse from an existing configuration', async () => {
    await setupOrganization();

    const original = await createPulseVia({
      description: 'Quarterly check',
      personalResultsEnabled: false,
      customQuestions: [
        { type: 'single_select', questionText: 'Which site?', optionLabels: ['HQ', 'Remote'] },
        { type: 'free_text', questionText: 'Anything else?' },
      ],
    });
    await submitResponse(original.publicId);
    await post(`/api/admin/pulses/${original.id}/close`);

    // The client prefills the create form from the detail response and posts it
    // through the normal creation path - there is no second insert path.
    const source = await detail(original.id);
    const duplicate = await createPulseVia({
      name: `${source.name} (copy)`,
      description: source.description,
      opensOn: '2099-02-01',
      closesOn: '2099-03-01',
      personalResultsEnabled: source.personalResultsEnabled,
      customQuestions: source.customQuestions.map((q) => ({
        type: q.type,
        questionText: q.questionText,
        optionLabels: (q.options ?? []).map((o) => o.label),
      })),
    });

    const copy = await detail(duplicate.id);

    expect(copy.id).not.toBe(original.id);
    expect(copy.publicId).not.toBe(original.publicId);
    expect(isGeneratedPublicId(copy.publicId)).toBe(true);
    expect(copy.responseCount).toBe(0);
    expect(copy.state).toBe('upcoming');
    expect(copy.personalResultsEnabled).toBe(false);
    expect(copy.customQuestions.map((q) => q.questionText)).toEqual(['Which site?', 'Anything else?']);
    expect(copy.customQuestions[0]?.options).toEqual([
      { id: 'hq', label: 'HQ' },
      { id: 'remote', label: 'Remote' },
    ]);
    expect(copy.surveyVersion).toBe(SURVEY_VERSION);

    // The original is untouched.
    const untouched = await detail(original.id);
    expect(untouched.responseCount).toBe(1);
    expect(untouched.state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('deleting a Pulse', () => {
  it('removes the Pulse, its custom questions and its responses', async () => {
    await setupOrganization();

    const doomed = await createPulseVia({
      customQuestions: [{ type: 'free_text', questionText: 'Anything else?' }],
    });
    const survivor = await createPulseVia({ name: 'Keep me' });

    await submitResponse(doomed.publicId);
    await submitResponse(doomed.publicId);
    await submitResponse(survivor.publicId);

    expect((await del(`/api/admin/pulses/${doomed.id}`)).status).toBe(200);

    // Gone from the admin list and from the public route.
    const list = (await (await get('/api/admin/pulses')).json()) as { pulses: AdminPulseSummary[] };
    expect(list.pulses.map((p) => p.id)).toEqual([survivor.id]);
    expect((await get(`/api/admin/pulses/${doomed.id}`)).status).toBe(404);
    expect((await app.request(`/api/pulses/${doomed.publicId}`, {}, env)).status).toBe(404);

    // Cascade removed the dependent rows, and only those.
    const counts = db.raw
      .prepare(
        `SELECT (SELECT COUNT(*) FROM responses WHERE pulse_id = ?) AS doomed_responses,
                (SELECT COUNT(*) FROM custom_questions WHERE pulse_id = ?) AS doomed_questions,
                (SELECT COUNT(*) FROM responses) AS all_responses,
                (SELECT COUNT(*) FROM organizations) AS organizations`,
      )
      .get(doomed.id, doomed.id) as Record<string, number>;

    expect(counts.doomed_responses).toBe(0);
    expect(counts.doomed_questions).toBe(0);
    expect(counts.all_responses).toBe(1);
    expect(counts.organizations).toBe(1);
  });

  it('returns 404 for a Pulse that does not exist', async () => {
    await setupOrganization();
    expect((await del('/api/admin/pulses/9999')).status).toBe(404);
  });
});
