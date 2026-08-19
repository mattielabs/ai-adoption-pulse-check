/**
 * Shared helpers for the employee-survey E2E flows.
 *
 * All interaction is driven through ACCESSIBLE selectors - role + accessible
 * name inside each question's group - so completing the survey doubles as a
 * check that every control is correctly labelled. Option ids never appear in
 * user-facing assertions.
 */

import { expect, type Page } from '@playwright/test';

/**
 * Public ids come from the Pulses the admin setup project created through the
 * real admin API, so every employee flow runs against a Pulse with a genuine
 * 128-bit random link rather than a hand-written fixture id.
 */
export { pulseId } from './adminHelpers.js';

export function pulseUrl(publicId: string): string {
  return `/p/${publicId}`;
}

function question(page: Page, key: string) {
  return page.getByTestId(`question-${key}`);
}

export async function pickRadio(page: Page, key: string, label: string): Promise<void> {
  await question(page, key).getByRole('radio', { name: label, exact: true }).check();
}

export async function pickChecks(page: Page, key: string, labels: readonly string[]): Promise<void> {
  for (const label of labels) {
    await question(page, key).getByRole('checkbox', { name: label, exact: true }).check();
  }
}

export async function fillText(page: Page, key: string, text: string): Promise<void> {
  await question(page, key).getByRole('textbox').fill(text);
}

export async function continueSection(page: Page): Promise<void> {
  await page.getByTestId('continue-section').click();
}

/**
 * Answers used by every full-completion flow. Deterministic on purpose: the
 * expected personal result (classification, scores, focus) is asserted
 * against exactly these answers.
 *
 * Expected engine output for this set:
 *   classification Regular User (Level 2)
 *   Adoption 57, Confidence 56.3, Workflow 37.5, Safety 82.5, Enablement 47.5
 *   focus: make_repeatable
 */
export async function completeCoreSurvey(page: Page): Promise<void> {
  // Section 1 - About Your Work (all optional; answer one).
  await pickRadio(page, 'q1', 'IT / Technology');
  await continueSection(page);

  // Section 2 - Current AI Use.
  await pickRadio(page, 'q4', 'Most workdays');
  await pickRadio(page, 'q5', 'A few times per week');
  await pickChecks(page, 'q6', ['ChatGPT', 'Claude']);
  await pickChecks(page, 'q7', ['Email and communication', 'Research and finding information']);
  await continueSection(page);

  // Section 3 - Confidence.
  await pickRadio(page, 'q8', 'Somewhat confident');
  await pickRadio(page, 'q9', 'Somewhat confident');
  await pickRadio(page, 'q10', 'Very confident');
  await pickRadio(page, 'q11', 'Somewhat confident');
  await continueSection(page);

  // Section 4 - Workflow.
  await pickRadio(page, 'q12', 'I use AI regularly for individual tasks');
  await pickRadio(page, 'q13', 'Sometimes');
  await pickRadio(page, 'q14', 'Not yet, but I can see opportunities');
  await pickChecks(page, 'q15', ['A reusable prompt or template']);
  await continueSection(page);

  // Section 5 - Safe & Responsible Use.
  await pickRadio(page, 'q16', 'Usually');
  await pickRadio(page, 'q17', 'Always');
  await pickRadio(page, 'q18', 'Very confident');
  await pickRadio(page, 'q19', 'I have a general idea');
  await pickRadio(page, 'q19b', 'Rarely');
  await continueSection(page);

  // Section 6 - Organizational Support.
  await pickRadio(page, 'q20', 'Neither agree nor disagree');
  await pickRadio(page, 'q21', 'Agree');
  await pickRadio(page, 'q22', 'Disagree');
  await pickChecks(page, 'q23', ['I do not have enough time to learn']);
  await continueSection(page);

  // Section 7 - Learning & Development.
  await pickChecks(page, 'q24', ['Writing better prompts/instructions']);
  await pickChecks(page, 'q25', ['Short practical tutorials']);
  await continueSection(page);

  // Section 8 - Workflow & Opportunity Discovery.
  await pickChecks(page, 'q26', ['Email and communication']);
  await fillText(page, 'q27', 'Turning meeting notes into follow-up actions.');
  await pickRadio(page, 'q28', 'Very interested');
  await continueSection(page);
}

/** The custom section on the active dev Pulse (answers two of three). */
export async function completeCustomSection(page: Page): Promise<void> {
  await pickRadio(page, 'c1', 'Headquarters');
  await pickChecks(page, 'c2', ['CRM', 'Internal wiki']);
  await continueSection(page);
}

export async function submitAndExpectAccepted(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeVisible();
  await page.getByTestId('submit-response').click();
  await expect(page.getByTestId('submission-confirmed')).toBeVisible();
}

export async function localStorageItem(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}
