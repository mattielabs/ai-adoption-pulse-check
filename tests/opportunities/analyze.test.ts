import { describe, expect, it } from 'vitest';
import {
  AI_USE_AMONG_PAIN_THRESHOLD,
  GUARDRAIL_SAFETY_THRESHOLD,
  PAIN_RATE_THRESHOLD,
  analyzeOpportunities,
  buildGuardrailSignal,
} from '../../src/core/opportunities/analyze.js';
import { SHARED_WORKFLOW_CATEGORY_IDS } from '../../src/core/opportunities/categories.js';
import { response } from '../helpers.js';
import type { SurveyResponse } from '../../src/core/survey/answers.js';

const CATEGORY = 'data_entry_cleanup';

/**
 * Builds a population where exactly `painCount` of `total` respondents report
 * CATEGORY as painful, and `aiUseInPainGroup` of those also report using AI
 * for it. AI use OUTSIDE the pain group is added deliberately so the tests
 * prove the denominator is the pain group and not the whole organization.
 */
function population(opts: {
  total: number;
  painCount: number;
  aiUseInPainGroup: number;
  aiUseOutsidePainGroup?: number;
}): SurveyResponse[] {
  const { total, painCount, aiUseInPainGroup, aiUseOutsidePainGroup = 0 } = opts;
  return Array.from({ length: total }, (_, i) => {
    const inPain = i < painCount;
    const usesAi = inPain
      ? i < aiUseInPainGroup
      : i - painCount < aiUseOutsidePainGroup;
    return response({
      q26: inPain ? [CATEGORY] : ['none_of_these'],
      q7: usesAi ? [CATEGORY] : ['no_work_ai_use'],
    });
  });
}

function categoryResult(responses: SurveyResponse[]) {
  const map = analyzeOpportunities(responses, 80);
  const found = map.categories.find((c) => c.categoryId === CATEGORY);
  if (!found) throw new Error('category missing');
  return found;
}

describe('opportunity thresholds', () => {
  it('pins the V1.1 thresholds', () => {
    expect(PAIN_RATE_THRESHOLD).toBe(0.2);
    expect(AI_USE_AMONG_PAIN_THRESHOLD).toBe(0.4);
    expect(GUARDRAIL_SAFETY_THRESHOLD).toBe(50);
  });

  it('labels a category at exactly 20% pain', () => {
    const result = categoryResult(population({ total: 100, painCount: 20, aiUseInPainGroup: 0 }));
    expect(result.painRate).toBe(0.2);
    expect(result.opportunityLabel).toBe('explore');
  });

  it('leaves a category just below 20% pain unlabelled', () => {
    const result = categoryResult(population({ total: 100, painCount: 19, aiUseInPainGroup: 0 }));
    expect(result.painRate).toBe(0.19);
    expect(result.opportunityLabel).toBeNull();
  });

  it('labels Standardize at exactly 40% AI use within the pain group', () => {
    const result = categoryResult(population({ total: 100, painCount: 40, aiUseInPainGroup: 16 }));
    expect(result.painRate).toBe(0.4);
    expect(result.aiUseAmongPainRate).toBe(0.4);
    expect(result.opportunityLabel).toBe('standardize');
  });

  it('labels Explore just below 40% AI use within the pain group', () => {
    const result = categoryResult(population({ total: 100, painCount: 40, aiUseInPainGroup: 15 }));
    expect(result.aiUseAmongPainRate).toBe(0.375);
    expect(result.opportunityLabel).toBe('explore');
  });

  it('labels Standardize above 40%', () => {
    const result = categoryResult(population({ total: 100, painCount: 40, aiUseInPainGroup: 30 }));
    expect(result.opportunityLabel).toBe('standardize');
  });
});

describe('the AI-use denominator', () => {
  it('is the pain group, not the whole organization', () => {
    // 20 report pain; only 2 of those use AI (10%). Another 50 respondents use
    // AI for the same category but do NOT report it as painful.
    // Wrong (global) denominator would give 52/100 = 52% -> Standardize.
    // Correct (pain-group) denominator gives 2/20 = 10% -> Explore.
    const result = categoryResult(
      population({ total: 100, painCount: 20, aiUseInPainGroup: 2, aiUseOutsidePainGroup: 50 }),
    );
    expect(result.aiUseAmongPainCount).toBe(2);
    expect(result.aiUseAmongPainRate).toBe(0.1);
    expect(result.opportunityLabel).toBe('explore');
  });

  it('reports a null AI-use rate when nobody reported that pain', () => {
    const result = categoryResult(population({ total: 100, painCount: 0, aiUseInPainGroup: 0, aiUseOutsidePainGroup: 40 }));
    expect(result.painCount).toBe(0);
    expect(result.aiUseAmongPainRate).toBeNull();
    expect(result.opportunityLabel).toBeNull();
  });

  it('uses respondents who answered Q26 as the pain denominator', () => {
    const responses = [
      ...Array.from({ length: 10 }, () => response({ q26: [CATEGORY] })),
      ...Array.from({ length: 10 }, () => response({ q26: ['none_of_these'] })),
    ];
    const map = analyzeOpportunities(responses, 80);
    expect(map.denominator).toBe(20);
    const found = map.categories.find((c) => c.categoryId === CATEGORY);
    expect(found?.painRate).toBe(0.5);
  });
});

describe('shared categories', () => {
  it('analyzes exactly the twelve shared Q7/Q26 categories', () => {
    const map = analyzeOpportunities([response()], 80);
    expect(map.categories).toHaveLength(12);
    expect(map.categories.map((c) => c.categoryId).sort()).toEqual([...SHARED_WORKFLOW_CATEGORY_IDS].sort());
  });

  it('never labels usage-only or pain-only categories', () => {
    const responses = Array.from({ length: 20 }, () =>
      response({ q26: ['training_onboarding', 'repetitive_system_updates'], q7: ['coding_technical'] }),
    );
    const map = analyzeOpportunities(responses, 80);
    const labelled = map.categories.filter((c) => c.opportunityLabel !== null);
    expect(labelled).toHaveLength(0);
    expect(map.categories.map((c) => c.categoryId)).not.toContain('coding_technical');
    expect(map.categories.map((c) => c.categoryId)).not.toContain('training_onboarding');
  });
});

describe('Guardrail banner', () => {
  it('activates below Safety 50', () => {
    const signal = buildGuardrailSignal(49.99);
    expect(signal.active).toBe(true);
    expect(signal.message).toMatch(/Strengthen safe-use practices/);
  });

  it('does not activate at exactly Safety 50', () => {
    expect(buildGuardrailSignal(50).active).toBe(false);
    expect(buildGuardrailSignal(50).message).toBeNull();
  });

  it('does not activate when Safety could not be assessed', () => {
    const signal = buildGuardrailSignal(null);
    expect(signal.active).toBe(false);
    expect(signal.safetyScore).toBeNull();
  });

  it('is organization-wide rather than per workflow', () => {
    const map = analyzeOpportunities(population({ total: 100, painCount: 50, aiUseInPainGroup: 40 }), 20);
    expect(map.guardrail.active).toBe(true);
    // V1.1 removed per-workflow Enable / Scale / Guardrail labels entirely.
    for (const category of map.categories) {
      expect(['explore', 'standardize', null]).toContain(category.opportunityLabel);
    }
  });
});

describe('map grouping', () => {
  it('splits categories into explore and standardize lists', () => {
    const responses = [
      ...Array.from({ length: 30 }, () => response({ q26: ['data_entry_cleanup'], q7: ['no_work_ai_use'] })),
      ...Array.from({ length: 30 }, () => response({ q26: ['email_communication'], q7: ['email_communication'] })),
    ];
    const map = analyzeOpportunities(responses, 80);
    expect(map.explore.map((c) => c.categoryId)).toEqual(['data_entry_cleanup']);
    expect(map.standardize.map((c) => c.categoryId)).toEqual(['email_communication']);
  });
});
