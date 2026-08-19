/**
 * Flow 10 - the results dashboard at a phone viewport.
 *
 * Desktop is the primary target, so this checks that the overview stays usable
 * and does not scroll sideways, and that the parts an administrator would
 * actually read on a phone - scores, recommendations, evidence - remain
 * readable. Wide tables scroll inside their own container rather than widening
 * the page.
 */

import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, adminPulseId } from './adminHelpers.js';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, storageState: ADMIN_STORAGE_STATE });

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const element = document.scrollingElement;
    return element === null ? 0 : element.scrollWidth - element.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

test('phone viewport: overview, a dimension detail and the opportunity map', async ({ page }) => {
  test.setTimeout(120_000);
  const id = adminPulseId('results');

  await page.goto(`/admin/pulses/${id}/results`);
  await expect(page.getByTestId('dimension-summary')).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Scores and the top priority are legible without horizontal panning.
  await expect(page.getByTestId('overview-score-safety')).toBeVisible();
  await expect(page.getByTestId('primary-recommendation-list')).toContainText('What we found');
  await expectNoHorizontalScroll(page);

  await page.goto(`/admin/pulses/${id}/results/safety`);
  await expect(page.getByTestId('dimension-detail-safety')).toBeVisible();
  await expect(page.getByTestId('safety-caveat')).toBeVisible();
  await expectNoHorizontalScroll(page);

  // The widest table on the dashboard.
  await page.goto(`/admin/pulses/${id}/results/opportunities`);
  await expect(page.getByTestId('opportunity-map')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto(`/admin/pulses/${id}/results/responses`);
  await expect(page.getByTestId('free-text-warning')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
