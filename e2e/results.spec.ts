/**
 * Results dashboard flows (Phase 3 brief 60), against the real Worker and real
 * local D1.
 *
 * The fixture Pulses are provisioned by the setup project from the committed
 * 75-response fixture, submitted through the real employee endpoint. Expected
 * values are computed here by running the same core engine over the same
 * answers, so these tests assert that the DASHBOARD MATCHES THE ENGINE rather
 * than re-stating numbers somebody typed in.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  adminPulseId,
  apiFetch,
  fixtureAnswerSets,
  SIGNED_OUT_STATE,
} from './adminHelpers.js';
import { pulseUrl } from './pulseHelpers.js';
import { runAnalysis } from '../src/core/analysis/runAnalysis.js';
import type { PulseAnalysis } from '../src/core/analysis/runAnalysis.js';
import { SURVEY_VERSION } from '../src/core/versions.js';
import { roundTo } from '../src/core/util/number.js';

test.use({ storageState: ADMIN_STORAGE_STATE });

/** The engine's own answer for the exact set the setup project submitted. */
function expected(limit?: number): PulseAnalysis {
  const answerSets = fixtureAnswerSets();
  const responses = (limit === undefined ? answerSets : answerSets.slice(0, limit)).map(
    (answers, index) => ({
      id: `e2e-${index}`,
      submittedOn: '2026-08-19',
      surveyVersion: SURVEY_VERSION,
      answers,
    }),
  );

  const analysis = runAnalysis(responses);
  if (analysis.suppressed) throw new Error('fixture analysis should not be suppressed');
  return analysis;
}

function score(value: number | null): string {
  if (value === null) return 'Not enough information';
  const rounded = roundTo(value, 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

async function openResults(page: Page, key: 'results' | 'resultsSmall' | 'resultsEarly'): Promise<void> {
  await page.goto(`/admin/pulses/${adminPulseId(key)}/results`);
  await expect(page.getByTestId('results-title')).toBeVisible();
}

// ---------------------------------------------------------------------------

test.describe('Flow 1 - minimum sample', () => {
  test('below the threshold the dashboard shows the gate, not partial results', async ({ page }) => {
    await openResults(page, 'resultsSmall');

    const gate = page.getByTestId('insufficient-sample');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('3 responses');
    await expect(gate).toContainText('5 completed responses are required.');

    // No dimensions, no recommendations, no tabs.
    await expect(page.getByTestId('dimension-summary')).toHaveCount(0);
    await expect(page.getByTestId('primary-recommendations')).toHaveCount(0);
    await expect(page.getByTestId('segment-control')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Results sections' })).toHaveCount(0);
  });

  test('the server sends no hidden aggregate for the page to obscure', async ({ page }) => {
    await openResults(page, 'resultsSmall');
    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('resultsSmall')}/results`,
    );

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual([
      'pulse',
      'sample',
      'status',
    ]);
  });

  test('written responses are gated on the same threshold', async ({ page }) => {
    await page.goto(`/admin/pulses/${adminPulseId('resultsSmall')}/results/responses`);
    // The layout stops at the gate, so the tab is unreachable rather than empty.
    await expect(page.getByTestId('insufficient-sample')).toBeVisible();

    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('resultsSmall')}/results/free-text`,
    );
    expect((response.body as { status: string }).status).toBe('insufficient_sample');
    expect(response.body).not.toHaveProperty('responses');
  });
});

test.describe('Flow 2 - early directional', () => {
  test('5-9 responses show results with the caution', async ({ page }) => {
    await openResults(page, 'resultsEarly');

    await expect(page.getByTestId('early-directional')).toHaveText(
      'Early directional results - interpret cautiously.',
    );
    await expect(page.getByTestId('dimension-summary')).toBeVisible();
    await expect(page.getByTestId('viewing-count')).toContainText('7 responses');
  });

  test('the full fixture is past the early-directional band', async ({ page }) => {
    await openResults(page, 'results');
    await expect(page.getByTestId('early-directional')).toHaveCount(0);
  });
});

test.describe('Flow 3 - overview', () => {
  test('shows the five dimensions, the response count and the top priorities', async ({ page }) => {
    await openResults(page, 'results');
    const analysis = expected();

    await expect(page.getByTestId('results-response-count')).toHaveText('73 responses');

    for (const dimension of ['adoption', 'confidence', 'workflow', 'safety', 'enablement'] as const) {
      await expect(page.getByTestId(`overview-score-${dimension}`)).toHaveText(
        score(analysis.aggregate.dimensions[dimension].mean),
      );
    }

    // Recommendations come from the engine, in its ranking, deduplicated.
    const primary = analysis.recommendations.primary;
    expect(primary.length).toBeGreaterThan(0);
    for (const card of primary) {
      await expect(page.getByTestId(`recommendation-${card.id}`)).toBeVisible();
      await expect(page.getByTestId(`recommendation-${card.id}-confidence`)).toBeVisible();
    }
    await expect(page.getByTestId('primary-recommendation-list')).toContainText('What we found');
    await expect(page.getByTestId('primary-recommendation-list')).toContainText('Evidence');

    // R10 is folded into R01 rather than shown as a second safety card.
    await expect(page.getByTestId('recommendation-R10')).toHaveCount(0);
    await expect(page.getByTestId('recommendation-R01-merged')).toBeVisible();

    // Classification distribution, counts only.
    for (const bucket of ['non_user', 'explorer', 'regular_user', 'workflow_user', 'builder_champion'] as const) {
      const level = { non_user: 0, explorer: 1, regular_user: 2, workflow_user: 3, builder_champion: 4 }[bucket];
      await expect(page.getByTestId(`classification-count-${bucket}`)).toHaveText(
        String(analysis.aggregate.classification.counts[level as 0 | 1 | 2 | 3 | 4]),
      );
    }

    await expect(page.getByTestId('barriers-table')).toBeVisible();
    await expect(page.getByTestId('training-demand-table')).toBeVisible();
    await expect(page.getByTestId('learning-preferences-table')).toBeVisible();
  });

  test('never offers a single combined maturity score', async ({ page }) => {
    await openResults(page, 'results');
    await expect(page.getByText(/overall (ai )?maturity score/i)).toHaveCount(0);
    await expect(page.getByText('There is deliberately no single maturity score.')).toBeVisible();
  });
});

test.describe('Flow 4 - dimension detail', () => {
  test('shows mean, median, distribution and the methodology wording', async ({ page }) => {
    await openResults(page, 'results');
    const analysis = expected();
    const confidence = analysis.aggregate.dimensions.confidence;

    await page.getByRole('link', { name: 'Confidence', exact: true }).click();
    await expect(page.getByTestId('dimension-detail-confidence')).toBeVisible();

    await expect(page.getByTestId('score-confidence')).toHaveText(score(confidence.mean));
    await expect(page.getByTestId('band-confidence')).toBeVisible();
    await expect(page.getByTestId('dimension-headline-confidence')).toContainText(
      `Median ${score(confidence.median)}`,
    );
    await expect(page.getByTestId('band-distribution-confidence')).toBeVisible();
    await expect(page.getByTestId('coverage-confidence')).toContainText(
      `${confidence.scoredCount} of ${confidence.scoredCount + confidence.notAssessedCount}`,
    );

    // Self-report wording, and no claim of tested capability.
    await expect(page.getByText('Self-reported confidence using and evaluating AI.')).toBeVisible();
    await expect(
      page.getByText('This is confidence, not demonstrated skill. Nothing here was tested.'),
    ).toBeVisible();
    await expect(page.getByText(/demonstrated (skill|competence) score/i)).toHaveCount(0);

    // The four underlying questions are broken down.
    for (const questionId of ['q8', 'q9', 'q10', 'q11'] as const) {
      await expect(page.getByTestId(`distribution-${questionId}`)).toBeVisible();
    }
  });

  test('surfaces the Unsure rate beside Enablement', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByRole('link', { name: 'Enablement', exact: true }).click();

    await expect(page.getByTestId('unsure-enablement')).toContainText('Unsure or unclear');
    await expect(page.getByTestId('enablement-barriers-table')).toBeVisible();
    // Framed as organizational support, not employee weakness.
    await expect(
      page.getByText('Employee-reported organizational clarity, tool access, and training.'),
    ).toBeVisible();
  });

  test('keeps Q15 descriptive on the workflow view', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByRole('link', { name: 'Workflow', exact: true }).click();

    await expect(page.getByTestId('workflow-artifacts-table')).toBeVisible();
    await expect(page.getByText('It is never scored.')).toBeVisible();
  });

  test('compares general and work AI use without inventing a metric', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByRole('link', { name: 'Adoption', exact: true }).click();

    await expect(page.getByTestId('distribution-q4')).toBeVisible();
    await expect(page.getByTestId('distribution-q5-compare')).toBeVisible();
    await expect(page.getByText(/Q4 is diagnostic only/)).toBeVisible();
    await expect(page.getByText(/breadth of tools is never treated as maturity/i)).toBeVisible();
  });
});

test.describe('Flow 5 - safety', () => {
  test('carries the self-report caveat and the neutral unmanaged-tool diagnostic', async ({ page }) => {
    await openResults(page, 'results');
    const analysis = expected();
    const unmanaged = analysis.aggregate.diagnostics.unmanagedTools;

    await page.getByRole('link', { name: 'Safety', exact: true }).click();

    await expect(page.getByTestId('safety-caveat')).toContainText(
      'A low Safety score is a meaningful warning signal.',
    );
    await expect(page.getByTestId('safety-caveat')).toContainText('does not prove safe behaviour');

    await expect(page.getByTestId('unmanaged-tools')).toBeVisible();
    await expect(page.getByTestId('unmanaged-rate')).toContainText(
      `${unmanaged.sometimesOrOftenCount} of ${unmanaged.validCount}`,
    );
    // Neutral framing, no accusation of policy breach.
    await expect(
      page.getByText('This does not necessarily mean those tools are prohibited.'),
    ).toBeVisible();
    await expect(page.getByText(/violat|breach|prohibited use|misuse/i)).toHaveCount(0);

    // Q19 belongs to Enablement, not Safety.
    await expect(page.getByTestId('distribution-q19')).toHaveCount(0);
  });
});

test.describe('Flow 6 - opportunity map', () => {
  test('shows Explore, Standardize and the organization-wide guardrail', async ({ page }) => {
    await openResults(page, 'results');
    const analysis = expected();

    await page.getByRole('link', { name: 'Opportunities', exact: true }).click();
    await expect(page.getByTestId('opportunity-map')).toBeVisible();

    // Guardrail fires because the fixture's Safety is below 50.
    expect(analysis.opportunities.guardrail.active).toBe(true);
    await expect(page.getByTestId('guardrail-banner')).toContainText(
      'Strengthen safe-use practices before broadly scaling AI workflows.',
    );

    const explore = analysis.opportunities.explore;
    const standardize = analysis.opportunities.standardize;
    expect(explore.length).toBeGreaterThan(0);
    expect(standardize.length).toBeGreaterThan(0);

    for (const row of explore) {
      await expect(
        page.getByTestId(`opportunity-row-${row.categoryId}`).getByTestId('opportunity-status-explore'),
      ).toBeVisible();
    }
    for (const row of standardize) {
      await expect(
        page
          .getByTestId(`opportunity-row-${row.categoryId}`)
          .getByTestId('opportunity-status-standardize'),
      ).toBeVisible();
    }

    // The removed V1.1 labels do not exist.
    await expect(page.getByText(/\b(Enable|Scale)\b/)).toHaveCount(0);

    // The denominator is stated as the pain group, not global usage.
    const first = explore[0];
    if (first !== undefined) {
      await expect(page.getByTestId(`opportunity-row-${first.categoryId}`)).toContainText(
        `${first.aiUseAmongPainCount} of ${first.painCount}`,
      );
    }
    await expect(page.getByText(/measured only among the people who reported that same workflow/i)).toBeVisible();
  });

  test('does not claim automation readiness or savings', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByRole('link', { name: 'Opportunities', exact: true }).click();

    const standardize = expected().opportunities.standardize[0];
    expect(standardize).toBeDefined();

    const detail = page.getByTestId(`opportunity-detail-${standardize!.categoryId}`);
    await detail.getByRole('group').or(detail).first().click();
    await expect(detail).toContainText(
      'does not establish automation feasibility, time savings, or return on investment',
    );
    // A Standardize row carries the Standardize next step, not the Explore one.
    await expect(detail).toContainText(
      'Investigate whether shared prompts, templates, process guidance',
    );
    await expect(detail).not.toContainText('Interview employees who perform this workflow');
  });
});

test.describe('Flow 7 - segmentation allowed', () => {
  test('a reportable segment re-scopes the aggregates', async ({ page }) => {
    await openResults(page, 'results');
    await expect(page.getByTestId('viewing-count')).toContainText('73 responses');

    await page.getByTestId('segment-dimension').selectOption('department');
    await page.getByTestId('segment-value').selectOption('it_technology');

    await expect(page.getByTestId('viewing-count')).toContainText('in the selected group');
    // Whole-Pulse context stays visible beside the segment.
    await expect(page.getByTestId('results-response-count')).toHaveText('73 responses');
    await expect(page.getByTestId('dimension-summary')).toBeVisible();

    // The selection survives a tab change.
    await page.getByRole('link', { name: 'Safety', exact: true }).click();
    await expect(page).toHaveURL(/dimension=department&value=it_technology/);
    await expect(page.getByTestId('dimension-detail-safety')).toBeVisible();
  });

  test('offers only one filter dimension at a time', async ({ page }) => {
    await openResults(page, 'results');

    // There is exactly one "group by" control; a second dimension is not
    // expressible in the UI at all.
    await expect(page.getByTestId('segment-dimension')).toHaveCount(1);
    await expect(page.getByTestId('segment-value')).toHaveCount(1);

    // ...and the server refuses a hand-made stacked request.
    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('results')}/results?dimension=department&value=it_technology&dimension=role_level&value=manager`,
    );
    expect(response.body).toMatchObject({
      status: 'suppressed',
      reason: 'multiple_segmentation_dimensions',
    });
  });

  test('written responses are never segmented', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByTestId('segment-dimension').selectOption('department');
    await page.getByTestId('segment-value').selectOption('it_technology');

    await page.getByRole('link', { name: 'Written responses', exact: true }).click();
    await expect(page.getByTestId('free-text-list')).toBeVisible();

    // The count matches the whole Pulse, not the selected group.
    const all = expected();
    const written = fixtureAnswerSets().filter(
      (a) => typeof a.q27 === 'string' && a.q27.trim() !== '',
    ).length;
    expect(all.responseCount).toBe(73);
    await expect(page.getByTestId('free-text-count')).toContainText(`${written} written responses`);

    // No segment control on this tab at all.
    await expect(page.getByTestId('free-text')).not.toContainText('Group by');
  });
});

test.describe('Flow 8 - segmentation suppressed', () => {
  test('a small group is refused, and its values never reach the page', async ({ page }) => {
    await openResults(page, 'results');

    await page.getByTestId('segment-dimension').selectOption('department');
    // The option is offered but disabled, with no count attached.
    const option = page.locator('[data-testid="segment-value"] option[value="legal_compliance"]');
    await expect(option).toBeDisabled();
    await expect(option).toContainText('not enough responses to report safely');
    await expect(option).not.toContainText(/\d/);

    // Requesting it directly is refused with no aggregate.
    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('results')}/results?dimension=department&value=legal_compliance`,
    );
    expect(response.body).toMatchObject({
      status: 'suppressed',
      reason: 'minimum_group_or_complement_size',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('dimensions');
    expect(serialized).not.toContain('segmentCount');

    // And the UI shows the refusal rather than any numbers.
    await page.goto(
      `/admin/pulses/${adminPulseId('results')}/results?dimension=department&value=legal_compliance`,
    );
    await expect(page.getByTestId('segment-suppressed')).toBeVisible();
    await expect(page.getByTestId('segment-suppressed')).toContainText(
      'Small groups are hidden to reduce the risk of identifying individual respondents.',
    );
    await expect(page.getByTestId('dimension-summary')).toHaveCount(0);
    await expect(page.getByTestId('primary-recommendations')).toHaveCount(0);
  });
});

test.describe('Flow 9 - written responses', () => {
  test('shows Q27 alone, with the privacy warning and no respondent context', async ({ page }) => {
    await openResults(page, 'results');
    await page.getByRole('link', { name: 'Written responses', exact: true }).click();

    await expect(page.getByTestId('free-text-warning')).toContainText(
      'Written responses may contain identifying information voluntarily provided by employees.',
    );

    const entries = page.getByTestId('free-text-list').getByRole('listitem');
    const written = fixtureAnswerSets().filter(
      (a) => typeof a.q27 === 'string' && a.q27.trim() !== '',
    );
    await expect(entries).toHaveCount(written.length);

    // No context of any kind beside the text.
    const panel = page.getByTestId('free-text');
    await expect(panel).not.toContainText(/IT \/ Technology|Individual contributor|Manager/);
    await expect(panel).not.toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(panel).not.toContainText(/Adoption|Classification|Regular User/);

    // The payload itself carries nothing but text.
    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('results')}/results/free-text`,
    );
    expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual([
      'responses',
      'sample',
      'status',
    ]);
  });

  test('renders text as text', async ({ page }) => {
    // A response that looks like markup must be shown, not interpreted.
    const marker = '<b>meeting notes</b> into follow-up actions';
    // Navigate first: a relative fetch needs a real document origin.
    await page.goto(`/admin/pulses/${adminPulseId('resultsEarly')}/results`);

    const submitted = await page.evaluate(
      async ([publicId, version, text]) => {
        const answers = {
          q4: 'few_times_week',
          q5: 'few_times_week',
          q6: ['chatgpt'],
          q7: ['email_communication'],
          q8: 'somewhat_confident',
          q9: 'somewhat_confident',
          q10: 'somewhat_confident',
          q11: 'somewhat_confident',
          q12: 'regular_individual_tasks',
          q13: 'sometimes',
          q14: 'see_opportunities',
          q15: ['none_of_these'],
          q16: 'sometimes',
          q17: 'usually',
          q18: 'somewhat_confident',
          q19: 'general_idea',
          q19b: 'rarely',
          q20: 'neither',
          q21: 'neither',
          q22: 'disagree',
          q23: ['not_enough_time'],
          q24: ['ai_basics'],
          q25: ['short_tutorials'],
          q26: ['email_communication'],
          q27: text as string,
          q28: 'moderately_interested',
        };
        const response = await fetch(`/api/pulses/${publicId as string}/responses`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ surveyVersion: version as string, answers }),
        });
        return response.status;
      },
      [
        (await import('./adminHelpers.js')).pulseId('resultsEarly'),
        SURVEY_VERSION,
        marker,
      ] as [string, string, string],
    );
    expect(submitted).toBe(201);

    await page.goto(`/admin/pulses/${adminPulseId('resultsEarly')}/results/responses`);
    await expect(page.getByTestId('free-text-list')).toContainText(marker);
    // Shown as characters, never parsed into an element.
    await expect(page.getByTestId('free-text-list').locator('b')).toHaveCount(0);
  });
});

test.describe('results are protected', () => {
  test.use({ storageState: SIGNED_OUT_STATE });

  test('a signed-out browser cannot reach them', async ({ page }) => {
    await page.goto(`/admin/pulses/${adminPulseId('results')}/results`);
    await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
    await expect(page.getByTestId('dimension-summary')).toHaveCount(0);

    const response = await apiFetch(
      page,
      'GET',
      `/api/admin/pulses/${adminPulseId('results')}/results`,
    );
    expect(response.status).toBe(401);
  });

  test('the employee survey exposes no organization analysis', async ({ page }) => {
    const { pulseId } = await import('./adminHelpers.js');
    await page.goto(pulseUrl(pulseId('results')));

    await expect(page.getByTestId('start-survey')).toBeVisible();
    // The product name legitimately contains "Adoption"; what must be absent is
    // any organization RESULT.
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/Opportunity Map|Recommended action|Guardrail signal|Median /);
    expect(body).not.toMatch(/Standardize|Explore this workflow/);
  });
});
