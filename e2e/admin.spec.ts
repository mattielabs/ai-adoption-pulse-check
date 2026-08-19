/**
 * Admin end-to-end flows (Phase 2 brief 54), running against the real Worker
 * and real local D1.
 *
 * Flow 1 (first-run setup) lives in admin.setup.ts because it needs the empty
 * database that exists only before anything else has run.
 *
 * Each flow creates the Pulses it needs, so nothing here depends on the order
 * tests happen to execute in - apart from the organization, which the setup
 * project configures once.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  apiFetch,
  createPulseViaApi,
  openPulseList,
  signIn,
  SIGNED_OUT_STATE,
  today,
} from './adminHelpers.js';
import { E2E_ADMIN_PASSCODE } from './e2eConfig.js';
import { completeCoreSurvey, pulseUrl, submitAndExpectAccepted } from './pulseHelpers.js';

// Every flow except the authentication ones reuses the session the setup
// project established. See admin.setup.ts for why.
test.use({ storageState: ADMIN_STORAGE_STATE });

/** Fills the create form and submits, returning the detail page it lands on. */
async function createPulseInUi(page: Page, name: string, closesOn?: string): Promise<void> {
  await page.getByTestId('create-pulse').click();
  await expect(page.getByRole('heading', { name: 'Create a Pulse' })).toBeVisible();

  await page.getByTestId('pulse-name').fill(name);
  if (closesOn !== undefined) await page.getByTestId('pulse-closes-on').fill(closesOn);
  await page.getByTestId('save-pulse').click();

  await expect(page.getByTestId('pulse-title')).toHaveText(name);
}

test.describe('Flow 2 - invalid login', () => {
  test.use({ storageState: SIGNED_OUT_STATE });

  test('a wrong passcode fails generically and reveals nothing', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByTestId('passcode').fill('this-is-not-the-passcode');
    await page.getByTestId('sign-in').click();

    const error = page.getByTestId('login-error');
    await expect(error).toHaveText('Unable to sign in with that passcode.');
    // No hint about hashes, salts, lengths or remaining attempts.
    await expect(error).not.toContainText(/hash|salt|length|attempt|character/i);

    // Still unauthenticated, and no protected content anywhere.
    await expect(page.getByTestId('create-pulse')).toHaveCount(0);
    await page.goto('/admin/pulses');
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
  });

  test('the admin API refuses to answer without a session', async ({ page }) => {
    // A browser that has never signed in: no cookie, no data.
    await page.goto('/admin/login');
    const response = await apiFetch(page, 'GET', '/api/admin/pulses');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'unauthorized' });
  });

  test('a passcode that is too short gets the same message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByTestId('passcode').fill('short');
    await page.getByTestId('sign-in').click();
    await expect(page.getByTestId('login-error')).toHaveText('Unable to sign in with that passcode.');
  });
});

test.describe('Flow 3 - session persistence and sign-out', () => {
  test.use({ storageState: SIGNED_OUT_STATE });

  test('the session survives a reload and ends on sign-out', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Pulses' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pulses' })).toBeVisible();
    await expect(page.getByTestId('create-pulse')).toBeVisible();

    // The session cookie is not readable from JavaScript.
    const cookieVisible = await page.evaluate(() => document.cookie.includes('pulse_admin_session'));
    expect(cookieVisible).toBe(false);

    // Nor is anything credential-shaped kept in web storage.
    const stored = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(stored.local).not.toContain(E2E_ADMIN_PASSCODE);
    expect(stored.session).not.toContain(E2E_ADMIN_PASSCODE);
    expect(stored.local).not.toMatch(/token|passcode|session/i);

    await page.getByTestId('sign-out').click();
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();

    await page.goto('/admin/pulses');
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
    await expect(page.getByTestId('create-pulse')).toHaveCount(0);
  });
});

test.describe('Flow 4 - create a Pulse', () => {
  test('create with custom questions, then open the employee link', async ({ page }) => {
    test.setTimeout(120_000);
    await openPulseList(page);

    await page.getByTestId('create-pulse').click();
    await page.getByTestId('pulse-name').fill('Autumn Pulse Check');
    await page.getByTestId('pulse-description').fill('A short check-in about AI at work.');

    // One custom question of each selectable kind.
    await page.getByTestId('add-custom-question').click();
    await page.getByTestId('question-text-1').fill('Which site do you work from?');
    await page.getByTestId('question-1-option-1').fill('Head office');
    await page.getByTestId('question-1-option-2').fill('Remote');

    await page.getByTestId('add-custom-question').click();
    await page.getByTestId('question-type-2').selectOption('free_text');
    await page.getByTestId('question-text-2').fill('Anything else we should know?');

    await expect(page.getByTestId('review-custom-count')).toHaveText('2');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('pulse-title')).toHaveText('Autumn Pulse Check');
    await expect(page.getByTestId('pulse-state-open')).toBeVisible();
    await expect(page.getByTestId('detail-response-count')).toHaveText('0 responses');

    // The survey link is a random 22-character id, not the Pulse name.
    const url = await page.getByTestId('survey-url').textContent();
    const publicId = (url ?? '').split('/p/')[1] ?? '';
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(publicId.toLowerCase()).not.toContain('autumn');

    // Copy-link feedback is announced, not just coloured.
    await page.getByTestId('copy-link').click();
    await expect(page.getByTestId('copy-status')).toHaveText('Link copied.');

    // The employee experience serves exactly this configuration.
    await page.goto(pulseUrl(publicId));
    await expect(page.getByRole('heading', { name: 'Autumn Pulse Check' })).toBeVisible();
    await expect(page.getByText('A short check-in about AI at work.')).toBeVisible();
    await expect(page.getByText('Northwind Trading Co.')).toBeVisible();

    await page.getByTestId('start-survey').click();
    await expect(page.getByTestId('progress-label')).toHaveText('Section 1 of 9');
  });

  test('a future Pulse is upcoming and the employee link is not yet open', async ({ page }) => {
    await openPulseList(page);

    await page.getByTestId('create-pulse').click();
    await page.getByTestId('pulse-name').fill('Next Year Pulse');
    await page.getByTestId('pulse-opens-on').fill('2099-03-01');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('pulse-state-upcoming')).toBeVisible();

    const url = await page.getByTestId('survey-url').textContent();
    await page.goto(pulseUrl((url ?? '').split('/p/')[1] ?? ''));
    await expect(page.getByTestId('pulse-not-yet-open')).toBeVisible();
  });

  test('the form refuses an invalid schedule before contacting the server', async ({ page }) => {
    await openPulseList(page);

    await page.getByTestId('create-pulse').click();
    await page.getByTestId('pulse-name').fill('Backwards Pulse');
    await page.getByTestId('pulse-opens-on').fill('2099-06-01');
    await page.getByTestId('pulse-closes-on').fill('2099-01-01');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('pulse-form-invalid')).toBeVisible();
    await expect(page.getByText('The closing date cannot be before the opening date.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/pulses\/new/);
  });
});

test.describe('Flow 5 - edit before any responses', () => {
  test('an allowed change reaches the employee survey', async ({ page }) => {
    await openPulseList(page);
    await createPulseInUi(page, 'Editable Pulse');

    const url = (await page.getByTestId('survey-url').textContent()) ?? '';
    const publicId = url.split('/p/')[1] ?? '';

    await expect(page.getByTestId('configuration-locked')).toHaveCount(0);

    await page.getByTestId('edit-pulse').click();
    await page.getByTestId('pulse-name').fill('Renamed Pulse');
    await page.getByTestId('pulse-description').fill('Now with a description.');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('success-notice')).toBeVisible();
    await expect(page.getByTestId('pulse-title')).toHaveText('Renamed Pulse');

    await page.goto(pulseUrl(publicId));
    await expect(page.getByRole('heading', { name: 'Renamed Pulse' })).toBeVisible();
    await expect(page.getByText('Now with a description.')).toBeVisible();
  });

  test('custom questions can still be changed', async ({ page }) => {
    await openPulseList(page);
    await createPulseInUi(page, 'Question Editing Pulse');

    await page.getByTestId('edit-pulse').click();
    await page.getByTestId('add-custom-question').click();
    await page.getByTestId('question-type-1').selectOption('free_text');
    await page.getByTestId('question-text-1').fill('What would help most?');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('custom-question-list')).toContainText('What would help most?');
  });
});

test.describe('Flow 6 - configuration locks after the first response', () => {
  test('locked settings disappear from the form and the server refuses them', async ({ page }) => {
    test.setTimeout(150_000);
    await openPulseList(page);

    const pulse = await createPulseViaApi(page, {
      name: 'Locked Pulse',
      opensOn: today(),
      personalResultsEnabled: true,
      customQuestions: [{ type: 'free_text', questionText: 'Original question' }],
    });

    // An employee completes the survey.
    await page.goto(pulseUrl(pulse.publicId));
    await page.getByTestId('start-survey').click();
    await completeCoreSurvey(page);
    await page.getByTestId('continue-section').click();
    await submitAndExpectAccepted(page);

    // Back in the admin surface, the count moved and the lock is explained.
    await page.goto(`/admin/pulses/${pulse.id}`);
    await expect(page.getByTestId('detail-response-count')).toHaveText('1 response');
    await expect(page.getByTestId('configuration-locked')).toBeVisible();

    await page.getByTestId('edit-pulse').click();
    // The locked controls are gone; the still-editable ones remain.
    await expect(page.getByTestId('pulse-opens-on')).toHaveCount(0);
    await expect(page.getByTestId('pulse-personal-results')).toHaveCount(0);
    await expect(page.getByTestId('add-custom-question')).toHaveCount(0);
    await expect(page.getByTestId('pulse-name')).toBeVisible();
    await expect(page.getByTestId('pulse-closes-on')).toBeVisible();

    // The still-allowed edit works.
    await page.getByTestId('pulse-name').fill('Locked Pulse, renamed');
    await page.getByTestId('save-pulse').click();
    await expect(page.getByTestId('pulse-title')).toHaveText('Locked Pulse, renamed');

    // The server is the real lock: a hand-made request is refused.
    const forbidden = await apiFetch(page, 'PATCH', `/api/admin/pulses/${pulse.id}`, {
      personalResultsEnabled: false,
      opensOn: '2030-01-01',
    });
    expect(forbidden.status).toBe(409);
    expect(forbidden.body).toMatchObject({ error: 'pulse_configuration_locked' });

    // And nothing changed.
    const detail = await apiFetch(page, 'GET', `/api/admin/pulses/${pulse.id}`);
    expect(detail.body).toMatchObject({ personalResultsEnabled: true, opensOn: today() });
  });
});

test.describe('Flow 7 - close a Pulse', () => {
  test('closing stops the public survey and refuses a stale submission', async ({ page }) => {
    await openPulseList(page);
    await createPulseInUi(page, 'Closing Pulse');

    const url = (await page.getByTestId('survey-url').textContent()) ?? '';
    const publicId = url.split('/p/')[1] ?? '';

    await page.getByTestId('close-pulse').click();
    const dialog = page.getByTestId('confirm-close');
    await expect(dialog).toContainText('Closing this Pulse stops new responses.');
    await expect(dialog).toContainText('duplicate the Pulse');
    await page.getByTestId('confirm-close-confirm').click();

    await expect(page.getByTestId('pulse-state-closed')).toBeVisible();
    // No reopen affordance exists.
    await expect(page.getByTestId('close-pulse')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /reopen/i })).toHaveCount(0);

    // The employee route reports it closed...
    await page.goto(pulseUrl(publicId));
    await expect(page.getByTestId('pulse-closed')).toBeVisible();

    // ...and the server refuses a submission from a page loaded earlier.
    const stale = await page.request.post(`/api/pulses/${publicId}/responses`, {
      data: { surveyVersion: '1.1.0', answers: {} },
    });
    expect([400, 409]).toContain(stale.status());
  });
});

test.describe('Flow 8 - duplicate a Pulse', () => {
  test('duplication prefills configuration into a new, empty Pulse', async ({ page }) => {
    test.setTimeout(120_000);
    await openPulseList(page);

    const original = await createPulseViaApi(page, {
      name: 'Quarterly Pulse',
      description: 'Our recurring check-in.',
      opensOn: today(),
      personalResultsEnabled: false,
      customQuestions: [
        {
          type: 'single_select',
          questionText: 'Which site do you work from?',
          optionLabels: ['Head office', 'Remote'],
        },
      ],
    });

    await page.goto(`/admin/pulses/${original.id}`);
    const originalUrl = (await page.getByTestId('survey-url').textContent()) ?? '';

    await page.getByTestId('duplicate-pulse').click();
    await expect(page.getByRole('heading', { name: 'Duplicate a Pulse' })).toBeVisible();

    // The configuration came across; the schedule did not.
    await expect(page.getByTestId('pulse-name')).toHaveValue('Quarterly Pulse (copy)');
    await expect(page.getByTestId('pulse-description')).toHaveValue('Our recurring check-in.');
    await expect(page.getByTestId('question-text-1')).toHaveValue('Which site do you work from?');
    await expect(page.getByTestId('question-1-option-1')).toHaveValue('Head office');
    await expect(page.getByTestId('pulse-personal-results')).not.toBeChecked();
    await expect(page.getByTestId('pulse-closes-on')).toHaveValue('');

    await page.getByTestId('pulse-opens-on').fill('2099-04-01');
    await page.getByTestId('save-pulse').click();

    await expect(page.getByTestId('pulse-title')).toHaveText('Quarterly Pulse (copy)');
    await expect(page.getByTestId('detail-response-count')).toHaveText('0 responses');
    await expect(page.getByTestId('custom-question-list')).toContainText('Which site do you work from?');

    // A brand new link, unrelated to the original.
    const copyUrl = (await page.getByTestId('survey-url').textContent()) ?? '';
    expect(copyUrl).not.toBe(originalUrl);
    expect((copyUrl.split('/p/')[1] ?? '')).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // The original is untouched.
    await page.goto(`/admin/pulses/${original.id}`);
    await expect(page.getByTestId('pulse-title')).toHaveText('Quarterly Pulse');
  });
});

test.describe('Flow 9 - delete a Pulse', () => {
  test('deletion needs explicit confirmation and removes the survey link', async ({ page }) => {
    await openPulseList(page);
    await createPulseInUi(page, 'Disposable Pulse');

    const url = (await page.getByTestId('survey-url').textContent()) ?? '';
    const publicId = url.split('/p/')[1] ?? '';

    await page.getByTestId('delete-pulse').click();
    const dialog = page.getByTestId('confirm-delete');
    await expect(dialog).toContainText('Disposable Pulse');
    await expect(dialog).toContainText('permanently removes');

    // The confirm button stays disabled until the phrase is typed exactly.
    await expect(page.getByTestId('confirm-delete-confirm')).toBeDisabled();
    await page.getByTestId('delete-confirmation').fill('delete');
    await expect(page.getByTestId('confirm-delete-confirm')).toBeDisabled();
    await page.getByTestId('delete-confirmation').fill('DELETE');
    await expect(page.getByTestId('confirm-delete-confirm')).toBeEnabled();

    await page.getByTestId('confirm-delete-confirm').click();

    await expect(page).toHaveURL(/\/admin\/pulses$/);
    await expect(page.getByText('Disposable Pulse')).toHaveCount(0);

    // The public link is now indistinguishable from one that never existed.
    await page.goto(pulseUrl(publicId));
    await expect(page.getByTestId('pulse-not-found')).toBeVisible();
  });

  test('cancelling the dialog changes nothing', async ({ page }) => {
    await openPulseList(page);
    await createPulseInUi(page, 'Kept Pulse');

    await page.getByTestId('delete-pulse').click();
    await expect(page.getByTestId('confirm-delete')).toBeVisible();
    await page.getByTestId('confirm-delete').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('confirm-delete')).toBeHidden();
    await expect(page.getByTestId('pulse-title')).toHaveText('Kept Pulse');
  });
});

test.describe('organization settings', () => {
  test('the name can be changed and reaches the employee survey', async ({ page }) => {
    await page.goto('/admin/organization');

    await expect(page.getByTestId('organization-name')).toHaveValue('Northwind Trading Co.');
    await page.getByTestId('organization-intro').fill('<b>Thanks</b> for taking part.');
    await page.getByTestId('save-organization').click();
    await expect(page.getByTestId('success-notice')).toBeVisible();

    // A script-like intro is shown as text on the employee page, never parsed.
    const pulse = await createPulseViaApi(page, { name: 'Intro Pulse', opensOn: today() });
    await page.goto(pulseUrl(pulse.publicId));
    await expect(page.getByText('<b>Thanks</b> for taking part.')).toBeVisible();
    await expect(page.locator('main b')).toHaveCount(0);

    // Restore the shared organization state for the other flows.
    await page.goto('/admin/organization');
    await page.getByTestId('organization-intro').fill('');
    await page.getByTestId('save-organization').click();
    await expect(page.getByTestId('success-notice')).toBeVisible();
  });

  test('an unsafe logo URL is refused', async ({ page }) => {
    await page.goto('/admin/organization');

    await page.getByTestId('organization-logo').fill('javascript:alert(1)');
    await page.getByTestId('save-organization').click();

    await expect(page.getByText('Enter an http:// or https:// URL, or leave this empty.')).toBeVisible();
    await expect(page.getByTestId('success-notice')).toHaveCount(0);
  });
});
