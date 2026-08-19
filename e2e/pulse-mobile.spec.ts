/**
 * Flow 7 - the primary completion flow at a realistic phone viewport.
 *
 * Asserts the survey is completable on a small touch screen and that no step
 * introduces horizontal scrolling. Phase 1 brief 27, 33.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  PULSES,
  completeCoreSurvey,
  completeCustomSection,
  pulseUrl,
  submitAndExpectAccepted,
} from './pulseHelpers.js';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el === null ? 0 : el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

test('phone viewport: complete the survey end to end', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(pulseUrl(PULSES.active));
  await expectNoHorizontalScroll(page);

  await page.getByTestId('start-survey').click();
  await expect(page.getByTestId('progress-label')).toHaveText('Section 1 of 9');
  await expectNoHorizontalScroll(page);

  await completeCoreSurvey(page);
  await expectNoHorizontalScroll(page);
  await completeCustomSection(page);

  await expectNoHorizontalScroll(page);
  await submitAndExpectAccepted(page);

  await expect(page.getByTestId('result-classification')).toHaveText('Regular User');
  await expectNoHorizontalScroll(page);
});
