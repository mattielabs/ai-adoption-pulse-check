/**
 * Phase 0 smoke test.
 *
 * Proves the deployment shape works: one Worker serving both the built SPA and
 * the API, with /api/* reaching the Worker rather than falling through to the
 * SPA shell.
 *
 * There are no product screens yet, so there is deliberately nothing else here.
 * A full happy-path suite (survey, personal result, admin, filters, export)
 * arrives with those features.
 */

import { expect, test } from '@playwright/test';

test('the Worker serves the built SPA', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AI Adoption Pulse Check/);
  await expect(page.getByRole('heading', { name: 'AI Adoption Pulse Check' })).toBeVisible();
});

test('SPA fallback routing works for unknown client paths', async ({ page }) => {
  // A deep link must return index.html so React Router can render, rather than
  // a 404 from the asset server.
  await page.goto('/status');
  await expect(page.getByTestId('client-question-count')).toHaveText('29 questions');
});

test('the client loads the versioned survey schema from core', async ({ page }) => {
  await page.goto('/status');
  // 28 core questions plus Q19b, straight out of src/core in the browser.
  await expect(page.getByTestId('client-question-count')).toHaveText('29 questions');
});

test('/api/version reaches the Worker and reports the engine versions', async ({ request }) => {
  const response = await request.get('/api/version');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toMatchObject({
    surveyVersion: '1.1.0',
    scoringVersion: '1.1.0',
    recommendationEngineVersion: '1.1.0',
    questionCount: 29,
  });
});

test('/api/health reports the D1 binding state', async ({ request }) => {
  const response = await request.get('/api/health');
  // 200 when migrations have been applied locally, 503 when they have not.
  // Either way the Worker answered and the D1 binding was reachable.
  expect([200, 503]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('database.reachable');
  expect(body).toHaveProperty('secrets.sessionSecretConfigured');
  // Secret VALUES must never appear in a response body.
  expect(JSON.stringify(body)).not.toMatch(/pbkdf2\$|[A-Za-z0-9+/]{40,}={0,2}/);
});

test('unknown API paths return JSON 404 rather than the SPA shell', async ({ request }) => {
  const response = await request.get('/api/does-not-exist');
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ error: 'not_found' });
});

test('baseline security headers are set', async ({ request }) => {
  const response = await request.get('/api/version');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
