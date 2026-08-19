/**
 * Helpers for the admin end-to-end flows.
 *
 * Interaction goes through roles and accessible names wherever a real
 * administrator would use them, so the flows double as a check that the admin
 * screens are labelled and reachable.
 */

import { expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SurveyAnswers } from '../src/core/survey/answers.js';
import { validateAnswers } from '../src/core/survey/validation.js';
import { SURVEY_VERSION } from '../src/core/versions.js';
import { E2E_ADMIN_PASSCODE, E2E_PULSE_IDS_FILE, type E2EPulseKey } from './e2eConfig.js';

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Calls the API from inside the page.
 *
 * Not Playwright's `request` fixture: the session cookie is `Secure`, and
 * Playwright's own fetch does not apply the browser's "http://127.0.0.1 is a
 * trustworthy origin" exception, so it would never send the cookie. Going
 * through the page uses the real browser cookie jar and sends a real
 * same-origin `Origin` header, which is also what the admin API's mutation
 * guard expects.
 */
export async function apiFetch(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  return page.evaluate(
    async ([requestMethod, requestPath, requestBody]) => {
      const response = await fetch(requestPath as string, {
        method: requestMethod as string,
        credentials: 'same-origin',
        ...(requestBody === null
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) }),
      });

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      return { status: response.status, body: parsed ?? null };
    },
    [method, path, body ?? null] as [string, string, unknown],
  );
}

/** Where the setup project saves the signed-in session for reuse. */
export const ADMIN_STORAGE_STATE = 'e2e/.admin-state.json';

/** A browser that has never signed in. */
export const SIGNED_OUT_STATE: { cookies: []; origins: [] } = { cookies: [], origins: [] };

export const E2E_ORGANIZATION = {
  name: 'Northwind Trading Co.',
  accentColor: '#0f766e',
} as const;

/**
 * Signs in with the local test passcode.
 *
 * Waits for the login response and for the app to navigate away from the sign-in
 * screen. Without both, a caller that navigates immediately afterwards can abort
 * the in-flight request and end up unauthenticated.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByTestId('passcode').fill(E2E_ADMIN_PASSCODE);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/api/admin/login') && candidate.request().method() === 'POST',
    ),
    page.getByTestId('sign-in').click(),
  ]);

  expect(response.status(), 'sign-in should succeed with the local test passcode').toBe(200);
  await expect(page.getByTestId('login-error')).toHaveCount(0);
  await page.waitForURL((url) => !url.pathname.endsWith('/admin/login'));
}

/**
 * Opens the Pulse list using the session saved by the setup project.
 *
 * Deliberately not a fresh sign-in: login is really throttled, so repeating it
 * in every test would exhaust the budget rather than test anything.
 */
export async function openPulseList(page: Page): Promise<void> {
  await page.goto('/admin/pulses');
  await expect(page.getByRole('heading', { name: 'Pulses' })).toBeVisible();
}

export interface PulseSpec {
  readonly name: string;
  readonly description?: string;
  readonly opensOn: string;
  readonly closesOn?: string | null;
  readonly personalResultsEnabled?: boolean;
  readonly customQuestions?: readonly {
    readonly type: 'single_select' | 'multi_select' | 'free_text';
    readonly questionText: string;
    readonly optionLabels?: readonly string[];
  }[];
}

/**
 * Creates a Pulse through the real admin API using the signed-in browser
 * session. Used to provision fixtures quickly; the UI creation path has its
 * own dedicated flow.
 */
export async function createPulseViaApi(
  page: Page,
  spec: PulseSpec,
): Promise<{ id: number; publicId: string }> {
  const response = await apiFetch(page, 'POST', '/api/admin/pulses', spec);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body as { id: number; publicId: string };
}

/**
 * Submits responses through the real public endpoint, in small concurrent
 * batches.
 *
 * Deliberately the employee submission path rather than a direct database
 * write: the dashboard is only meaningful if it analyses rows that arrived the
 * way real ones do, through validation and the version check.
 */
export async function submitResponses(
  page: Page,
  publicId: string,
  answerSets: readonly unknown[],
): Promise<void> {
  const accepted = await page.evaluate(
    async ([id, sets, version]) => {
      const payloads = sets as unknown[];
      let ok = 0;

      for (let start = 0; start < payloads.length; start += 8) {
        const batch = payloads.slice(start, start + 8);
        const statuses = await Promise.all(
          batch.map(async (answers) => {
            const response = await fetch(`/api/pulses/${id as string}/responses`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ surveyVersion: version as string, answers }),
            });
            return response.status;
          }),
        );
        ok += statuses.filter((status) => status === 201).length;
      }

      return ok;
    },
    [publicId, answerSets, SURVEY_VERSION] as [string, readonly unknown[], string],
  );

  expect(accepted, 'every fixture response should be accepted').toBe(answerSets.length);
}

/**
 * The committed 75-response fixture, minus the two deliberately incomplete
 * rows the submission endpoint rejects. Analysing this exact set is what the
 * dashboard assertions compare against, so nothing is invented here.
 */
export function fixtureAnswerSets(): readonly SurveyAnswers[] {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../demo/sample-responses.json');
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly responses: readonly { readonly answers: SurveyAnswers }[];
  };

  return fixture.responses
    .map((response) => response.answers)
    .filter((answers) => validateAnswers(answers).ok);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function writeProvisionedPulses(ids: Readonly<Record<string, string>>): void {
  writeFileSync(E2E_PULSE_IDS_FILE, JSON.stringify(ids, null, 2), 'utf8');
}

let cachedIds: Record<string, string> | null = null;

/**
 * The public id of a Pulse provisioned by the setup project.
 *
 * Read lazily, inside tests, because Playwright imports every spec file before
 * the setup project has run.
 */
let cachedAdminIds: Record<string, number> | null = null;

/** The internal Pulse id, which is what the admin results route addresses. */
export function adminPulseId(key: 'results' | 'resultsSmall' | 'resultsEarly'): number {
  cachedAdminIds ??= JSON.parse(readFileSync('e2e/.pulse-admin-ids.json', 'utf8')) as Record<
    string,
    number
  >;
  const id = cachedAdminIds[key];
  if (id === undefined) {
    throw new Error(`No provisioned Pulse for "${key}" - the admin setup project must run first.`);
  }
  return id;
}

export function pulseId(key: E2EPulseKey): string {
  cachedIds ??= JSON.parse(readFileSync(E2E_PULSE_IDS_FILE, 'utf8')) as Record<string, string>;
  const id = cachedIds[key];
  if (id === undefined) {
    throw new Error(`No provisioned Pulse for "${key}" - the admin setup project must run first.`);
  }
  return id;
}
