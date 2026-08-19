/**
 * Employee survey flows (Phase 1 brief 33).
 *
 * Runs against `wrangler dev` with the seeded local D1 (scripts/dev-seed.sql),
 * so submissions here exercise the real Worker validation and real database
 * writes.
 */

import { expect, test } from '@playwright/test';
import {
  pulseId,
  completeCoreSurvey,
  completeCustomSection,
  continueSection,
  localStorageItem,
  pickRadio,
  pulseUrl,
  submitAndExpectAccepted,
} from './pulseHelpers.js';

test.describe('Flow 1 - complete a normal survey', () => {
  test('landing -> all sections -> submit -> personal result', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(pulseUrl(pulseId('active')));

    // Landing: privacy-first copy, no anonymity claim.
    await expect(page.getByRole('heading', { name: 'Q3 AI Adoption Pulse' })).toBeVisible();
    await expect(page.getByText('does not ask for your name, email, employee ID')).toBeVisible();
    await expect(page.getByText(/minimum reporting threshold/)).toBeVisible();
    await expect(page.getByText(/anonymous/i)).toHaveCount(0);

    await page.getByTestId('start-survey').click();
    await expect(page.getByTestId('progress-label')).toHaveText('Section 1 of 9');

    await completeCoreSurvey(page);
    await expect(page.getByTestId('progress-label')).toHaveText('Section 9 of 9');
    await completeCustomSection(page);

    await submitAndExpectAccepted(page);

    // Personal result: classification, one-decimal scores, honest labels.
    await expect(page.getByTestId('result-classification')).toHaveText('Regular User');
    await expect(page.getByTestId('score-adoption')).toHaveText('57');
    await expect(page.getByTestId('score-confidence')).toHaveText('56.3');
    await expect(page.getByTestId('score-workflow')).toHaveText('37.5');
    await expect(page.getByTestId('score-safety')).toHaveText('82.5');
    await expect(page.getByTestId('score-enablement')).toHaveText('47.5');
    await expect(page.getByText('Organization Support Experience')).toBeVisible();
    await expect(page.getByText('Your self-reported confidence using and evaluating AI.')).toBeVisible();
    await expect(page.getByTestId('focus-primary')).toHaveText('Turn one useful AI task into a repeatable process.');
    await expect(page.getByTestId('focus-next-step')).toContainText('Save the prompt or steps');

    // Draft removed, submitted marker set.
    expect(await localStorageItem(page, `pulse-check:draft:${pulseId('active')}:1.1.0`)).toBeNull();
    expect(await localStorageItem(page, `pulse-check:submitted:${pulseId('active')}`)).toBe('true');
  });
});

test.describe('Flow 2 - draft restore', () => {
  test('answers and section survive a reload', async ({ page }) => {
    await page.goto(pulseUrl(pulseId('plain')));
    await page.getByTestId('start-survey').click();

    await pickRadio(page, 'q1', 'IT / Technology');
    await continueSection(page);
    await expect(page.getByTestId('progress-label')).toHaveText('Section 2 of 8');
    await pickRadio(page, 'q4', 'Most workdays');
    await pickRadio(page, 'q5', 'A few times per week');

    await page.reload();

    // Restored directly into the survey, at the saved section, with a notice.
    await expect(page.getByTestId('draft-restored')).toBeVisible();
    await expect(page.getByTestId('progress-label')).toHaveText('Section 2 of 8');
    await expect(
      page.getByTestId('question-q4').getByRole('radio', { name: 'Most workdays', exact: true }),
    ).toBeChecked();

    // Going back shows the section-1 answer also survived.
    await page.getByTestId('previous-section').click();
    await expect(
      page.getByTestId('question-q1').getByRole('radio', { name: 'IT / Technology', exact: true }),
    ).toBeChecked();
  });

  test('a draft from a different survey version is not applied', async ({ page }) => {
    await page.addInitScript(
      ([id]) => {
        window.localStorage.setItem(
          `pulse-check:draft:${id}:0.9.0`,
          JSON.stringify({ answers: { q5: 'never' }, sectionIndex: 4, updatedOn: '2026-01-01' }),
        );
      },
      [pulseId('plain')],
    );
    await page.goto(pulseUrl(pulseId('plain')));

    // Incompatible draft is ignored: the landing screen shows, and the stale
    // key is discarded.
    await expect(page.getByTestId('start-survey')).toBeVisible();
    expect(await localStorageItem(page, `pulse-check:draft:${pulseId('plain')}:0.9.0`)).toBeNull();
  });
});

test.describe('Flow 3 - validation', () => {
  test('required questions block Continue accessibly', async ({ page }) => {
    await page.goto(pulseUrl(pulseId('plain')));
    await page.getByTestId('start-survey').click();

    // Section 1 is fully optional and passes untouched.
    await continueSection(page);
    await expect(page.getByTestId('progress-label')).toHaveText('Section 2 of 8');

    // Section 2 has required questions; Continue must not advance.
    await continueSection(page);
    await expect(page.getByTestId('progress-label')).toHaveText('Section 2 of 8');
    await expect(page.getByRole('alert')).toContainText('answer the highlighted');
    await expect(page.getByTestId('question-q4')).toContainText('Select an option to continue.');
    await expect(page.getByTestId('question-q6')).toContainText('Select at least one option.');

    // Focus lands on the first question needing attention.
    await expect(page.getByTestId('question-q4')).toBeFocused();

    // Answering clears the error and allows progress.
    await pickRadio(page, 'q4', 'Never');
    await expect(page.getByTestId('question-q4')).not.toContainText('Select an option to continue.');
  });

  test('multi-select enforces its maximum', async ({ page }) => {
    await page.goto(pulseUrl(pulseId('plain')));
    await page.getByTestId('start-survey').click();
    // Walk to section 6 (Q23, select up to three).
    await continueSection(page);
    await pickRadio(page, 'q4', 'Never');
    await pickRadio(page, 'q5', 'Never');
    await page.getByTestId('question-q6').getByRole('checkbox', { name: 'I do not currently use AI for work', exact: true }).check();
    await page.getByTestId('question-q7').getByRole('checkbox', { name: 'I do not currently use AI for work', exact: true }).check();
    await continueSection(page);
    for (const q of ['q8', 'q9', 'q10', 'q11'] as const) {
      await pickRadio(page, q, 'I have not done this');
    }
    await continueSection(page);
    await pickRadio(page, 'q12', 'I do not currently use AI for work');
    await pickRadio(page, 'q13', 'I do not currently use AI');
    await pickRadio(page, 'q14', 'No');
    await page.getByTestId('question-q15').getByRole('checkbox', { name: 'None of these', exact: true }).check();
    await continueSection(page);
    await pickRadio(page, 'q16', 'Not applicable');
    await pickRadio(page, 'q17', 'Not applicable');
    await pickRadio(page, 'q18', 'Unsure');
    await pickRadio(page, 'q19', 'Unsure');
    await pickRadio(page, 'q19b', 'Never');
    await continueSection(page);

    // Q23: after three selections the fourth checkbox is disabled.
    const q23 = page.getByTestId('question-q23');
    await q23.getByRole('checkbox', { name: 'I do not know where AI would be useful', exact: true }).check();
    await q23.getByRole('checkbox', { name: 'I do not have enough time to learn', exact: true }).check();
    await q23.getByRole('checkbox', { name: 'I prefer my current way of working', exact: true }).check();
    await expect(q23.getByText('3 of 3 selected')).toBeVisible();
    await expect(
      q23.getByRole('checkbox', { name: 'I do not currently see a need for AI', exact: true }),
    ).toBeDisabled();
  });
});

test.describe('Flow 4 - unavailable states', () => {
  test('closed pulse shows the closed message and no survey', async ({ page }) => {
    await page.goto(pulseUrl(pulseId('closed')));
    await expect(page.getByTestId('pulse-closed')).toHaveText('This Pulse Check is no longer accepting responses.');
    await expect(page.getByTestId('start-survey')).toHaveCount(0);
  });

  test('future pulse shows not-yet-open', async ({ page }) => {
    await page.goto(pulseUrl(pulseId('future')));
    await expect(page.getByTestId('pulse-not-yet-open')).toContainText('not accepting responses yet');
    await expect(page.getByTestId('start-survey')).toHaveCount(0);
  });

  test('unknown pulse shows the generic not-found state', async ({ page }) => {
    await page.goto(pulseUrl('this-id-does-not-exist'));
    await expect(page.getByTestId('pulse-not-found')).toBeVisible();
    await expect(page.getByTestId('start-survey')).toHaveCount(0);
  });

  test('the server refuses submission even from an already-open page', async ({ page }) => {
    // A stale client that somehow POSTs to a closed pulse is refused.
    const response = await page.request.post(`/api/pulses/${pulseId('closed')}/responses`, {
      data: { surveyVersion: '1.1.0', answers: {} },
    });
    expect([400, 409]).toContain(response.status());
  });
});

test.describe('Flow 5 - duplicate-browser warning', () => {
  test('a completed marker shows the honest duplicate notice', async ({ page }) => {
    await page.addInitScript(
      ([id]) => {
        window.localStorage.setItem(`pulse-check:submitted:${id}`, 'true');
      },
      [pulseId('plain')],
    );
    await page.goto(pulseUrl(pulseId('plain')));

    await expect(page.getByTestId('duplicate-warning')).toContainText('already completed this Pulse Check on this browser');
    await expect(page.getByText('does not identify you or guarantee one response per employee')).toBeVisible();
    await expect(page.getByTestId('start-survey')).toHaveCount(0);
    // No stored result snapshot, so no fabricated recoverability.
    await expect(page.getByTestId('view-my-result')).toHaveCount(0);
  });
});

test.describe('shared-device result cleanup', () => {
  test('an employee can clear the locally stored result without affecting their response', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(pulseUrl(pulseId('plain')));
    await page.getByTestId('start-survey').click();
    await completeCoreSurvey(page);
    await submitAndExpectAccepted(page);

    await expect(page.getByText('This result is stored only on this browser.')).toBeVisible();
    expect(await localStorageItem(page, `pulse-check:result:${pulseId('plain')}`)).not.toBeNull();

    await page.getByTestId('clear-my-result').click();

    await expect(page.getByTestId('result-cleared')).toBeVisible();
    await expect(page.getByTestId('score-adoption')).toHaveCount(0);
    expect(await localStorageItem(page, `pulse-check:result:${pulseId('plain')}`)).toBeNull();

    // The submitted response is untouched, and the survey still cannot be retaken.
    expect(await localStorageItem(page, `pulse-check:submitted:${pulseId('plain')}`)).toBe('true');
    await page.reload();
    await expect(page.getByTestId('duplicate-warning')).toBeVisible();
    await expect(page.getByTestId('view-my-result')).toHaveCount(0);
    await expect(page.getByTestId('start-survey')).toHaveCount(0);
  });
});

test.describe('Flow 6 - personal result disabled', () => {
  test('submission confirms without any score screen', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(pulseUrl(pulseId('noResult')));
    await page.getByTestId('start-survey').click();
    await completeCoreSurvey(page);

    await submitAndExpectAccepted(page);
    await expect(page.getByRole('heading', { name: 'Response submitted' })).toBeVisible();

    // No scores, no classification, no focus - and no local result snapshot.
    await expect(page.getByTestId('result-classification')).toHaveCount(0);
    await expect(page.getByTestId('score-adoption')).toHaveCount(0);
    await expect(page.getByTestId('focus-primary')).toHaveCount(0);
    expect(await localStorageItem(page, `pulse-check:result:${pulseId('noResult')}`)).toBeNull();
  });
});
