/**
 * Flow 10 - the admin surface at a phone viewport.
 *
 * Desktop is the main administration target, so this checks that the core
 * management screens remain usable and do not scroll sideways, rather than
 * exercising every action again.
 */

import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, createPulseViaApi, openPulseList, today } from './adminHelpers.js';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, storageState: ADMIN_STORAGE_STATE });

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const element = document.scrollingElement;
    return element === null ? 0 : element.scrollWidth - element.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

test('phone viewport: sign in, list, and inspect a Pulse', async ({ page }) => {
  test.setTimeout(120_000);

  await openPulseList(page);
  await expectNoHorizontalScroll(page);

  const pulse = await createPulseViaApi(page, {
    name: 'Mobile Review Pulse',
    description: 'Checked from a phone.',
    opensOn: today(),
    customQuestions: [
      {
        type: 'single_select',
        questionText: 'Which site do you work from?',
        optionLabels: ['Head office', 'Remote'],
      },
    ],
  });

  await page.goto('/admin/pulses');
  await expect(page.getByTestId(`pulse-link-${pulse.id}`)).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByTestId(`pulse-link-${pulse.id}`).click();
  await expect(page.getByTestId('pulse-title')).toHaveText('Mobile Review Pulse');
  // The long survey URL must wrap rather than widen the page.
  await expect(page.getByTestId('survey-url')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('edit-pulse').click();
  await expect(page.getByTestId('pulse-name')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
