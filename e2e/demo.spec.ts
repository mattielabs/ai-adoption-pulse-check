/**
 * Phase 4 Flows 5-7 - the public demo.
 *
 * Deliberately run from a SIGNED-OUT browser: the whole point of the demo is
 * that a recruiter, engineer or prospective user can understand the product
 * without an account, and a flow that quietly relied on the suite's shared
 * admin session would not be testing that.
 *
 * Two things get the most attention here - that the synthetic labelling is
 * unmissable, and that nothing on the page can reach a real Pulse.
 * Phase 4 brief 50, 51.
 */

import { expect, test } from '@playwright/test';
import { SIGNED_OUT_STATE, adminPulseId } from './adminHelpers.js';
import { completeCoreSurvey, continueSection, pickRadio } from './pulseHelpers.js';
import { runAnalysis } from '../src/core/analysis/runAnalysis.js';
import type { SurveyResponse } from '../src/core/survey/answers.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test.use({ storageState: SIGNED_OUT_STATE });

const fixture = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../demo/sample-responses.json'),
    'utf8',
  ),
) as { readonly responses: readonly SurveyResponse[] };

/** The engine's own answer for the committed fixture, computed here rather than typed in. */
function expected() {
  const analysis = runAnalysis(fixture.responses, { filters: [] });
  if (analysis.suppressed) throw new Error('The demo fixture should never be suppressed');
  return analysis;
}

/** Matches the dashboard's own formatting: one decimal, trailing .0 trimmed. */
function displayScore(value: number | null): string {
  if (value === null) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

test.describe('Flow 5 - the public demo', () => {
  test('loads without authentication and says the data is synthetic', async ({ page }) => {
    await page.goto('/demo');

    await expect(page.getByTestId('demo-heading')).toBeVisible();
    await expect(page.getByTestId('synthetic-banner')).toContainText('Synthetic demo organization');
    await expect(page.getByTestId('demo-data-notice')).toContainText('not a real company');

    // Never signed in, and never redirected to a login screen.
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('heading', { name: 'Admin access' })).toHaveCount(0);
  });

  test('states what the tool does not claim', async ({ page }) => {
    await page.goto('/demo');
    const body = page.locator('body');

    await expect(body).toContainText('Not a skill test');
    await expect(body).toContainText('Not guaranteed anonymity');
    await expect(body).toContainText('Not a single maturity score');
    await expect(body).toContainText('Not automation readiness');
  });

  test('renders the sample organization from the real engine', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo/results');

    await expect(page.getByTestId('demo-badge')).toBeVisible();
    await expect(page.getByTestId('demo-notice')).toContainText('committed synthetic fixture');
    await expect(page.getByTestId('dimension-summary')).toBeVisible();

    const analysis = expected();
    for (const dimension of ['adoption', 'confidence', 'workflow', 'safety', 'enablement'] as const) {
      await expect(page.getByTestId(`dimension-card-${dimension}`)).toContainText(
        displayScore(analysis.aggregate.dimensions[dimension].mean),
      );
    }

    // Recommendations come from the engine, in the engine's order.
    for (const card of analysis.recommendations.primary) {
      await expect(page.getByTestId('primary-recommendation-list')).toContainText(card.title);
    }
  });

  test('shows the Opportunity Map the engine produced', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo/results/opportunities');
    await expect(page.getByTestId('opportunity-map')).toBeVisible();

    const analysis = expected();
    expect(analysis.opportunities.explore.length).toBeGreaterThan(0);
    expect(analysis.opportunities.standardize.length).toBeGreaterThan(0);

    const map = page.getByTestId('opportunity-map');
    for (const row of [...analysis.opportunities.explore, ...analysis.opportunities.standardize]) {
      await expect(map).toContainText(row.label);
    }
    if (analysis.opportunities.guardrail.active) {
      await expect(page.getByTestId('guardrail-banner')).toBeVisible();
    }
  });

  test('offers no administrative controls and no exports', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo/results');
    await expect(page.getByTestId('dimension-summary')).toBeVisible();

    for (const testId of [
      'export-responses',
      'export-free-text',
      'export-results-json',
      'segment-dimension',
      'close-pulse',
      'delete-pulse',
      'duplicate-pulse',
    ]) {
      await expect(page.getByTestId(testId), testId).toHaveCount(0);
    }

    await expect(page.getByRole('link', { name: 'Exports' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to Pulse' })).toHaveCount(0);
  });

  test('cannot be pointed at a real Pulse', async ({ page }) => {
    const realId = adminPulseId('results');
    await page.goto('/demo');

    const outcomes = await page.evaluate(async (pulseId) => {
      const plain = await (await fetch('/api/demo/results')).text();
      const withPulseId = await (await fetch(`/api/demo/results?pulseId=${pulseId}&id=${pulseId}`)).text();
      const nested = await fetch(`/api/demo/results/${pulseId}`);
      const adminAttempt = await fetch(`/api/admin/pulses/${pulseId}/results`, {
        credentials: 'same-origin',
      });
      return {
        identical: plain === withPulseId,
        nestedStatus: nested.status,
        adminStatus: adminAttempt.status,
        demoName: (JSON.parse(plain) as { pulse: { name: string } }).pulse.name,
      };
    }, realId);

    // A query parameter changes nothing, there is no id-shaped route, and the
    // admin endpoint is still 401 from this page.
    expect(outcomes.identical).toBe(true);
    expect(outcomes.nestedStatus).toBe(404);
    expect(outcomes.adminStatus).toBe(401);
    expect(outcomes.demoName).toContain('Northstar');
  });

  test('shows written responses with no respondent context', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo/results/responses');

    await expect(page.getByTestId('free-text-warning')).toBeVisible();
    await expect(page.getByTestId('free-text-list')).toBeVisible();

    const text = (await page.getByTestId('free-text-list').innerText()).toLowerCase();
    for (const leak of ['department', 'role level', 'it / technology', 'submitted']) {
      expect(text, leak).not.toContain(leak);
    }
  });

  test('publishes the methodology in a readable form', async ({ page }) => {
    await page.goto('/methodology');

    await expect(page.getByTestId('methodology-heading')).toBeVisible();
    await expect(page.getByTestId('methodology-no-single-score')).toContainText(
      'no single maturity score',
    );
    await expect(page.getByTestId('methodology-self-report')).toContainText('Nothing is tested');
    await expect(page.getByTestId('methodology-privacy')).toContainText('5 responses');
    await expect(page.getByTestId('methodology-limitations')).toContainText(
      'does not claim anonymity',
    );
    // Thresholds come from the engine, so the page cannot drift from the code.
    await expect(page.getByTestId('methodology-opportunities')).toContainText('20%');
    await expect(page.getByTestId('methodology-opportunities')).toContainText('40%');
  });
});

test.describe('Flow 6 - the sample survey', () => {
  test('runs locally and writes nothing to the database', async ({ page }) => {
    test.setTimeout(180_000);

    // Any POST to a response endpoint would be a demo writing into D1.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('/demo/survey');
    await expect(page.getByTestId('demo-survey-notice')).toContainText('not submitted');

    await page.getByTestId('start-survey').click();
    // The real survey, the real sections, the real validation.
    await completeCoreSurvey(page);

    await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeVisible();
    await page.getByTestId('submit-response').click();

    // The personal result is computed in the browser by the same core engine...
    await expect(page.getByTestId('demo-result-notice')).toContainText('Nothing was submitted');
    await expect(page.getByTestId('result-classification')).toBeVisible();
    // ...and the shared-device control, which is about a stored response, is
    // deliberately absent.
    await expect(page.getByTestId('clear-my-result')).toHaveCount(0);

    expect(writes.filter((entry) => entry.includes('/api/'))).toEqual([]);
  });

  test('can be retaken', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/demo/survey');
    await page.getByTestId('start-survey').click();
    await completeCoreSurvey(page);
    await page.getByTestId('submit-response').click();

    await expect(page.getByTestId('retake-demo')).toBeVisible();
    await page.getByTestId('retake-demo').click();

    // Back to the start, with a cleared draft.
    await expect(page.getByTestId('start-survey')).toBeVisible();
  });

  test('keeps its local state away from real Pulse markers', async ({ page }) => {
    await page.goto('/demo/survey');
    await page.getByTestId('start-survey').click();
    await pickRadio(page, 'q1', 'IT / Technology');
    await continueSection(page);

    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.length).toBeGreaterThan(0);
    // Everything the demo writes is namespaced under its own four-letter id.
    // A real public id is a 128-bit value in twenty-two URL-safe characters,
    // so no real Pulse's draft, result or submission marker can share a key.
    for (const key of keys) {
      expect(key, key).toMatch(/^pulse-check:[a-z]+:demo(:|$)/);
    }
  });
});

test.describe('Flow 7 - the demo on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('is usable at 375x812 with no horizontal overflow', async ({ page }) => {
    test.setTimeout(180_000);

    const noOverflow = async () => {
      const overflow = await page.evaluate(() => {
        const element = document.scrollingElement;
        return element === null ? 0 : element.scrollWidth - element.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    };

    await page.goto('/demo');
    await expect(page.getByTestId('demo-heading')).toBeVisible();
    await noOverflow();

    await page.goto('/demo/results');
    await expect(page.getByTestId('dimension-summary')).toBeVisible();
    await noOverflow();

    // The widest table in the product.
    await page.goto('/demo/results/opportunities');
    await expect(page.getByTestId('opportunity-map')).toBeVisible();
    await noOverflow();

    await page.goto('/methodology');
    await expect(page.getByTestId('methodology-heading')).toBeVisible();
    await noOverflow();

    await page.goto('/demo/survey');
    await expect(page.getByTestId('demo-survey-notice')).toBeVisible();
    await noOverflow();
  });
});
