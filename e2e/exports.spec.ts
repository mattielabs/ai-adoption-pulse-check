/**
 * Phase 4 Flows 1-4 - downloads, in a real browser.
 *
 * Playwright's download API is used rather than intercepting a fetch, so what
 * is asserted is the file a browser actually saved: the same bytes an
 * administrator would open in a spreadsheet, with the filename the server
 * chose. The privacy assertions in `tests/server/exportApi.test.ts` cover the
 * shaping in depth; these confirm the whole path from a link on the page to a
 * file on disk, and that a Pulse below the reporting threshold offers no link
 * at all. Phase 4 brief 51.
 */

import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ADMIN_STORAGE_STATE, adminPulseId } from './adminHelpers.js';

test.use({ storageState: ADMIN_STORAGE_STATE });

async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  return readFileSync(path, 'utf8');
}

async function download(page: Page, testId: string): Promise<Download> {
  const [saved] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testId).click(),
  ]);
  return saved;
}

/** Splits the strict CSV this project emits: every field quoted, CRLF records. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

test.describe('Flow 1 - response CSV', () => {
  test('downloads a privacy-limited file with no work context, free text or dates', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`/admin/pulses/${adminPulseId('results')}/results/exports`);
    await expect(page.getByTestId('exports')).toBeVisible();

    const saved = await download(page, 'export-responses');
    expect(saved.suggestedFilename()).toMatch(/^[a-z0-9-]+-responses\.csv$/);

    const parsed = parseCsv(await readDownload(saved));
    const headers = parsed[0] as string[];
    const rows = parsed.slice(1);

    // Excluded columns.
    for (const prefix of ['q1_', 'q2_', 'q3_', 'q27']) {
      expect(headers.some((header) => header.startsWith(prefix)), prefix).toBe(false);
    }
    expect(headers).not.toContain('submitted_on');
    expect(headers).not.toContain('id');

    // Present, and readable.
    expect(headers[0]).toBe('survey_version');
    expect(headers).toContain('q5_work_ai_frequency');
    expect(headers).toContain('q19b_unmanaged_tool_use');

    // Every row is complete and carries no work-context option id or date.
    expect(rows.length).toBeGreaterThan(60);
    const text = rows.flat().join('|');
    for (const leak of ['it_technology', 'legal_compliance', 'executive_owner', 'people_customers']) {
      expect(text, leak).not.toContain(leak);
    }
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const row of rows) {
      expect(row).toHaveLength(headers.length);
    }
  });

  test('states the privacy tradeoff on the page rather than hiding it', async ({ page }) => {
    await page.goto(`/admin/pulses/${adminPulseId('results')}/results/exports`);
    const exports = page.getByTestId('exports');
    await expect(exports).toContainText('limited');
    await expect(exports).toContainText('not fully anonymous data');
    await expect(exports).toContainText('department, role');
  });
});

test.describe('Flow 2 - free-text export', () => {
  test('warns before the download and produces a file with no context', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/admin/pulses/${adminPulseId('results')}/results/exports`);

    // The warning is visible before anything is clicked.
    await expect(page.getByTestId('export-free-text-warning')).toBeVisible();
    await expect(page.getByTestId('export-free-text-warning')).toContainText(
      'may contain identifying information',
    );
    // And the export is never described as anonymous: the only place the word
    // appears is the sentence denying it.
    const copy = await page.getByTestId('exports').innerText();
    expect(copy.match(/anonymous/g) ?? []).toHaveLength(1);
    expect(copy).toContain('not fully anonymous data');

    const saved = await download(page, 'export-free-text');
    expect(saved.suggestedFilename()).toMatch(/^[a-z0-9-]+-written-responses\.csv$/);

    const parsed = parseCsv(await readDownload(saved));
    expect(parsed[0]).toEqual(['row_token', 'response_text']);

    const rows = parsed.slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveLength(2);
      expect(row[0]).toMatch(/^t\d{4}$/);
    }

    const text = rows.flat().join('|');
    for (const leak of ['it_technology', 'executive_owner', 'few_times_week', 'strongly_agree']) {
      expect(text, leak).not.toContain(leak);
    }
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

test.describe('Flow 3 - aggregate JSON', () => {
  test('downloads version-stamped aggregates with no raw data', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/admin/pulses/${adminPulseId('results')}/results/exports`);

    const saved = await download(page, 'export-results-json');
    expect(saved.suggestedFilename()).toMatch(/^[a-z0-9-]+-results\.json$/);

    const body = JSON.parse(await readDownload(saved)) as {
      generated: Record<string, string>;
      segment: unknown;
      data: { status: string; dimensions: unknown[]; recommendations: { primary: unknown[] } };
    };

    expect(body.generated).toEqual({
      surveyVersion: '1.1.0',
      scoringVersion: '1.1.0',
      recommendationEngineVersion: '1.1.0',
    });
    expect(body.segment).toBeNull();
    expect(body.data.status).toBe('ok');
    expect(body.data.dimensions).toHaveLength(5);
    expect(body.data.recommendations.primary.length).toBeGreaterThan(0);

    // No per-respondent structure anywhere in the file.
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object' && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          walk(entry);
        }
      }
    };
    walk(body);
    for (const forbidden of ['respondents', 'answers', 'q27', 'submittedOn']) {
      expect([...keys], forbidden).not.toContain(forbidden);
    }
  });
});

test.describe('Flow 4 - exports below the reporting threshold', () => {
  test('offers no download and says why', async ({ page }) => {
    const id = adminPulseId('resultsSmall');
    await page.goto(`/admin/pulses/${id}/results`);

    await expect(page.getByTestId('insufficient-sample')).toBeVisible();
    await expect(page.getByTestId('exports-unavailable')).toContainText(
      'Exports become available after the minimum reporting threshold is reached',
    );
    // There is no exports tab to reach, because there is no dashboard at all.
    await expect(page.getByTestId('export-responses')).toHaveCount(0);
  });

  test('refuses the download even when the URL is typed directly', async ({ page }) => {
    const id = adminPulseId('resultsSmall');
    await page.goto(`/admin/pulses/${id}/results`);

    const outcomes = await page.evaluate(async (pulseId) => {
      const paths = ['responses.csv', 'free-text.csv', 'results.json'];
      return Promise.all(
        paths.map(async (path) => {
          const response = await fetch(`/api/admin/pulses/${pulseId}/export/${path}`, {
            credentials: 'same-origin',
          });
          return { path, status: response.status, body: await response.text() };
        }),
      );
    }, id);

    for (const outcome of outcomes) {
      expect(outcome.status, outcome.path).toBe(409);
      expect(outcome.body, outcome.path).toContain('insufficient_sample');
      // The refusal describes the threshold, never the responses.
      expect(outcome.body, outcome.path).not.toMatch(/few_times|q5|answers/);
    }
  });
});

test.describe('exports are protected', () => {
  test('a signed-out browser gets nothing', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const id = adminPulseId('results');

    await page.goto('/admin/login');
    const outcomes = await page.evaluate(async (pulseId) => {
      const paths = ['responses.csv', 'free-text.csv', 'results.json'];
      return Promise.all(
        paths.map(async (path) => {
          const response = await fetch(`/api/admin/pulses/${pulseId}/export/${path}`, {
            credentials: 'same-origin',
          });
          return { path, status: response.status, body: await response.text() };
        }),
      );
    }, id);

    for (const outcome of outcomes) {
      expect(outcome.status, outcome.path).toBe(401);
      expect(outcome.body, outcome.path).not.toContain('row_token');
      expect(outcome.body, outcome.path).not.toContain('survey_version');
    }

    await context.close();
  });
});
