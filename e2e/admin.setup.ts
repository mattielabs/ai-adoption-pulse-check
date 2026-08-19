/**
 * Flow 1 - first-run admin setup - plus the fixtures every other flow needs.
 *
 * This runs first, against a database created empty by `scripts/e2e-server.ts`,
 * so "no organization is configured yet" is a real state rather than a
 * simulated one. The Pulses the employee flows use are then created through
 * the real admin API, which means those flows exercise Pulses an administrator
 * actually made - with cryptographically random public ids - rather than
 * hand-written seed rows.
 *
 * It also saves the signed-in storage state. Login is genuinely throttled (8
 * attempts per minute, and local requests all share one bucket because there
 * is no CF-Connecting-IP header), so the suite signs in ONCE here and reuses
 * the session. Only the tests that are specifically about authentication start
 * from a signed-out browser.
 */

import { expect, test } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  apiFetch,
  createPulseViaApi,
  E2E_ORGANIZATION,
  signIn,
  today,
  writeProvisionedPulses,
} from './adminHelpers.js';

test('Flow 1 - first run: sign in, configure the organization, provision fixtures', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // Nothing protected is reachable before signing in.
  await page.goto('/admin/pulses');
  await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
  await expect(page.getByTestId('create-pulse')).toHaveCount(0);

  await signIn(page);

  // No organization yet, so the administrator is sent to setup.
  await expect(page).toHaveURL(/\/admin\/setup$/);
  await expect(page.getByRole('heading', { name: 'Set up your organization' })).toBeVisible();

  await page.getByTestId('organization-name').fill(E2E_ORGANIZATION.name);
  await page.getByTestId('organization-accent').fill(E2E_ORGANIZATION.accentColor);
  await page.getByTestId('save-organization').click();

  // ...and lands on an empty Pulse list.
  await expect(page).toHaveURL(/\/admin\/pulses$/);
  await expect(page.getByRole('heading', { name: 'Pulses' })).toBeVisible();
  await expect(page.getByTestId('no-pulses')).toBeVisible();
  await expect(page.getByTestId('organization-name')).toHaveText(E2E_ORGANIZATION.name);

  // Setup cannot be repeated: returning to it redirects away.
  await page.goto('/admin/setup');
  await expect(page).toHaveURL(/\/admin\/pulses$/);

  // --- fixtures for the employee flows -------------------------------------

  const active = await createPulseViaApi(page, {
    name: 'Q3 AI Adoption Pulse',
    description: 'Help us understand how AI fits into everyday work.',
    opensOn: today(),
    personalResultsEnabled: true,
    customQuestions: [
      {
        type: 'single_select',
        questionText: 'Which location do you mostly work from?',
        optionLabels: ['Headquarters', 'Regional office', 'Mostly remote'],
      },
      {
        type: 'multi_select',
        questionText: 'Which internal systems do you use most weeks?',
        optionLabels: ['CRM', 'ERP', 'Internal wiki', 'Helpdesk'],
      },
      {
        type: 'free_text',
        questionText: 'Is there anything about our tools you want to flag?',
      },
    ],
  });

  const plain = await createPulseViaApi(page, {
    name: 'Plain Pulse',
    opensOn: today(),
    personalResultsEnabled: true,
  });

  const noResult = await createPulseViaApi(page, {
    name: 'No-Result Pulse',
    opensOn: today(),
    personalResultsEnabled: false,
  });

  const closed = await createPulseViaApi(page, { name: 'Closed Pulse', opensOn: today() });
  const closeResponse = await apiFetch(page, 'POST', `/api/admin/pulses/${closed.id}/close`);
  expect(closeResponse.status).toBe(200);

  const future = await createPulseViaApi(page, { name: 'Future Pulse', opensOn: '2100-01-01' });

  writeProvisionedPulses({
    active: active.publicId,
    plain: plain.publicId,
    noResult: noResult.publicId,
    closed: closed.publicId,
    future: future.publicId,
  });

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
