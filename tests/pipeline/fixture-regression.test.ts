/**
 * Full-pipeline regression test.
 *
 * Runs the committed 75-response fixture through
 *   responses -> scores -> aggregation -> classification -> recommendations
 *   -> opportunities -> privacy
 * and asserts the key outputs.
 *
 * This is the test that catches an accidental methodology change. If a weight,
 * a mapping, a threshold or a merge rule shifts, these numbers move and this
 * file fails loudly rather than the product quietly reporting something else.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { SurveyResponse } from '../../src/core/survey/answers.js';
import { validateAnswers } from '../../src/core/survey/validation.js';
import { runAnalysis } from '../../src/core/analysis/runAnalysis.js';
import { roundScore } from '../../src/core/util/number.js';
import { generateFixtureResponses, FIXTURE_SEED } from '../../scripts/fixture/generateResponses.js';
import { buildFreeTextExport, buildResponseExport } from '../../src/core/privacy/exports.js';
import { seededRandom } from '../../src/core/util/random.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../../demo/sample-responses.json');

interface FixtureFile {
  readonly seed: number;
  readonly surveyVersion: string;
  readonly responseCount: number;
  readonly responses: SurveyResponse[];
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureFile;
const responses = fixture.responses;

function analyze() {
  const result = runAnalysis(responses);
  if (result.suppressed) throw new Error(`Unexpected suppression: ${result.reason}`);
  return result;
}

describe('fixture integrity', () => {
  it('contains 75 synthetic responses at survey version 1.1.0', () => {
    expect(fixture.responseCount).toBe(75);
    expect(responses).toHaveLength(75);
    expect(fixture.surveyVersion).toBe('1.1.0');
    expect(responses.every((r) => r.surveyVersion === '1.1.0')).toBe(true);
  });

  it('is byte-reproducible from its seed', () => {
    // If this fails, the generator changed but the committed fixture was not
    // regenerated (or vice versa). Run `npm run fixture:generate`.
    expect(fixture.seed).toBe(FIXTURE_SEED);
    expect(generateFixtureResponses(FIXTURE_SEED)).toEqual(responses);
  });

  it('stores day-granularity submission dates only', () => {
    for (const r of responses) {
      expect(r.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('contains no direct identifiers', () => {
    const serialized = JSON.stringify(responses);
    expect(serialized).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i); // email addresses
    expect(serialized).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // IP addresses
    for (const key of ['email', 'name', 'employeeId', 'ip', 'userAgent', 'fingerprint']) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it('validates against the real survey schema, except the deliberate partials', () => {
    const failures = responses.filter((r) => !validateAnswers(r.answers).ok);
    // Exactly the two partial-response fixtures are expected to fail.
    expect(failures).toHaveLength(2);
    expect(failures.map((r) => r.id)).toEqual(['fixture-074', 'fixture-075']);
  });
});

describe('fixture analysis - dimensions', () => {
  const analysis = analyze();

  it('produces the expected five dimension scores', () => {
    const rounded = Object.fromEntries(
      Object.entries(analysis.aggregate.dimensions).map(([name, agg]) => [
        name,
        agg.mean === null ? null : roundScore(agg.mean),
      ]),
    );
    expect(rounded).toEqual({
      adoption: 63,
      confidence: 49,
      workflow: 39,
      safety: 48,
      enablement: 25,
    });
  });

  it('reports Interest separately from the dimensions', () => {
    expect(roundScore(analysis.aggregate.interest.mean as number)).toBe(75);
    expect(analysis.aggregate.interest.assessedCount).toBe(73);
    expect(analysis.aggregate.interest.notAssessedCount).toBe(2);
  });

  it('reports Not Assessed counts from the deliberately partial responses', () => {
    expect(analysis.aggregate.dimensions.confidence.notAssessedCount).toBe(9);
    expect(analysis.aggregate.dimensions.safety.notAssessedCount).toBe(7);
    expect(analysis.aggregate.dimensions.adoption.notAssessedCount).toBe(0);
  });

  it('reports Unsure / unclear rates beside the scores', () => {
    expect(analysis.aggregate.dimensions.safety.unsureRate).toBeGreaterThan(0);
    expect(analysis.aggregate.dimensions.enablement.unsureRate).toBeGreaterThan(0);
    expect(analysis.aggregate.dimensions.adoption.unsureRate).toBeNull();
  });
});

describe('fixture analysis - classification', () => {
  const analysis = analyze();

  it('classifies every respondent into exactly one level', () => {
    const { counts, classifiedCount, unclassifiedCount } = analysis.aggregate.classification;
    expect(unclassifiedCount).toBe(0);
    expect(classifiedCount).toBe(75);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(75);
  });

  it('produces the expected distribution', () => {
    expect(analysis.aggregate.classification.counts).toEqual({
      0: 4,   // Non-user
      1: 18,  // Explorer
      2: 36,  // Regular User
      3: 12,  // Workflow User
      4: 5,   // Builder / Champion
    });
  });

  it('produces a champion signal without exposing identities', () => {
    expect(analysis.aggregate.championSignal.qualifyingCount).toBe(5);
    expect(analysis.aggregate.championSignal.signalPresent).toBe(true);
    expect(analysis.aggregate.championSignal.displayCount).toBe('5 potential champions');
  });
});

describe('fixture analysis - recommendations', () => {
  const analysis = analyze();
  const engine = analysis.recommendations;

  it('evaluates all ten rules', () => {
    expect(engine.status).toBe('ok');
    expect(engine.evaluated).toHaveLength(10);
  });

  it('fires the expected rules', () => {
    const fired = engine.evaluated.filter((r) => r.triggered).map((r) => r.id).sort();
    expect(fired).toEqual(['R01', 'R02', 'R04', 'R05', 'R06', 'R09', 'R10']);
  });

  it('merges R10 into R01 rather than giving it a separate slot', () => {
    const r01 = engine.evaluated.find((r) => r.id === 'R01');
    const r10 = engine.evaluated.find((r) => r.id === 'R10');
    expect(r10?.triggered).toBe(true);
    expect(r10?.suppressedBy).toBe('R01');
    expect(r01?.mergedFindings.map((m) => m.sourceId)).toEqual(['R10']);
    expect(engine.primary.map((r) => r.id)).not.toContain('R10');
  });

  it('produces exactly three primary recommendations in the expected order', () => {
    expect(engine.primary.map((r) => r.id)).toEqual(['R02', 'R01', 'R04']);
    expect(engine.primary.map((r) => r.priority)).toEqual([1, 1, 2]);
  });

  it('demotes the remaining fired rules to additional signals', () => {
    expect(engine.additional.map((r) => r.id)).toEqual(['R05', 'R06', 'R09']);
    expect(engine.additional.every((r) => r.suppressionReason === 'primary_slots_full')).toBe(true);
  });

  it('uses one family per primary recommendation', () => {
    const families = engine.primary.map((r) => r.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it('labels every primary recommendation with a qualitative confidence', () => {
    for (const rule of engine.primary) {
      expect(rule.confidenceLabel).toBe('strong_signal');
    }
  });
});

describe('fixture analysis - opportunity map', () => {
  const analysis = analyze();
  const map = analysis.opportunities;

  it('uses respondents who answered Q26 as the pain denominator', () => {
    expect(map.denominator).toBe(75);
  });

  it('analyzes exactly the twelve shared categories', () => {
    expect(map.categories).toHaveLength(12);
  });

  it('identifies the expected Standardize workflows', () => {
    expect(map.standardize.map((c) => c.categoryId).sort()).toEqual([
      'email_communication',
      'research_information',
      'writing_documents',
    ]);
  });

  it('identifies the expected Explore workflows', () => {
    expect(map.explore.map((c) => c.categoryId).sort()).toEqual([
      'customer_support',
      'data_entry_cleanup',
      'meetings_followup',
      'reviewing_summarizing',
      'scheduling_coordination',
      'spreadsheets_analysis',
    ]);
  });

  it('leaves low-pain categories unlabelled', () => {
    const unlabelled = map.categories.filter((c) => c.opportunityLabel === null);
    expect(unlabelled.map((c) => c.categoryId).sort()).toEqual([
      'creating_content',
      'planning_project_management',
      'presentations',
    ]);
  });

  it('activates the organization-wide Guardrail banner below Safety 50', () => {
    expect(map.guardrail.active).toBe(true);
    expect(map.guardrail.message).toMatch(/Strengthen safe-use practices/);
  });
});

describe('fixture analysis - privacy', () => {
  it('allows a segment with an adequate segment and complement', () => {
    const result = runAnalysis(responses, {
      filters: [{ dimension: 'department', value: 'it_technology' }],
    });
    expect(result.suppressed).toBe(false);
    if (result.suppressed) return;
    expect(result.segment.segmentCount).toBe(12);
    expect(result.segment.complementCount).toBe(63);
    expect(result.aggregate.dimensions.adoption.mean).not.toBeNull();
  });

  it('suppresses a segment below the minimum reporting group', () => {
    const result = runAnalysis(responses, {
      filters: [{ dimension: 'department', value: 'legal_compliance' }],
    });
    expect(result).toEqual({ suppressed: true, reason: 'minimum_group_or_complement_size' });
  });

  it('rejects stacked segmentation dimensions', () => {
    const result = runAnalysis(responses, {
      filters: [
        { dimension: 'department', value: 'it_technology' },
        { dimension: 'role_level', value: 'manager' },
      ],
    });
    expect(result).toEqual({ suppressed: true, reason: 'multiple_segmentation_dimensions' });
  });
});

describe('fixture analysis - export shaping', () => {
  it('produces a limited response export with no work-context or free-text columns', () => {
    const exported = buildResponseExport(responses, { random: seededRandom(7) });
    expect(exported.rows).toHaveLength(75);
    for (const id of ['q1', 'q2', 'q3', 'q27']) {
      expect(exported.headers).not.toContain(id);
    }
    expect(exported.csv).not.toContain('legal_compliance');
  });

  it('produces an isolated free-text export', () => {
    const exported = buildFreeTextExport(responses, { random: seededRandom(7) });
    expect(exported.headers).toEqual(['row_token', 'response_text']);
    expect(exported.rows.length).toBeGreaterThan(0);
    expect(exported.csv).not.toContain('it_technology');
    expect(exported.csv).not.toContain('2026-06-');
  });
});

describe('determinism', () => {
  it('produces identical analysis across repeated runs', () => {
    const first = JSON.stringify(analyze());
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(analyze())).toBe(first);
    }
  });

  it('is unaffected by response order', () => {
    const forward = analyze();
    const reversedResult = runAnalysis([...responses].reverse());
    if (reversedResult.suppressed) throw new Error('unexpected suppression');

    expect(reversedResult.aggregate.dimensions.adoption.mean).toBe(
      forward.aggregate.dimensions.adoption.mean,
    );
    expect(reversedResult.recommendations.primary.map((r) => r.id)).toEqual(
      forward.recommendations.primary.map((r) => r.id),
    );
    expect(reversedResult.opportunities.categories.map((c) => c.opportunityLabel)).toEqual(
      forward.opportunities.categories.map((c) => c.opportunityLabel),
    );
  });
});
