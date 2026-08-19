/**
 * Per-rule threshold coverage.
 *
 * For every rule: exactly at the threshold, one point below, one point above,
 * and with a missing (unassessable) input. The baseline context is built so
 * that no rule fires, which means a rule firing here is always attributable to
 * the values that test set.
 */

import { describe, expect, it } from 'vitest';
import { RULES_BY_ID, THRESHOLDS } from '../../src/core/recommendations/rules.js';
import type { RecommendationId } from '../../src/core/recommendations/types.js';
import { baseContext } from '../helpers.js';

function fires(id: RecommendationId, overrides: Parameters<typeof baseContext>[0]): boolean {
  return RULES_BY_ID[id].evaluate(baseContext(overrides)).triggered;
}

function evaluable(id: RecommendationId, overrides: Parameters<typeof baseContext>[0]): boolean {
  return RULES_BY_ID[id].evaluate(baseContext(overrides)).evaluable;
}

describe('rule metadata', () => {
  it('defines exactly ten rules with the V1.1 priorities and families', () => {
    const expected: Record<RecommendationId, { priority: number; family: string }> = {
      R01: { priority: 1, family: 'SAFETY' },
      R02: { priority: 1, family: 'POLICY' },
      R03: { priority: 1, family: 'SAFETY' },
      R04: { priority: 2, family: 'ENABLEMENT' },
      R05: { priority: 2, family: 'CONFIDENCE' },
      R06: { priority: 3, family: 'WORKFLOW' },
      R07: { priority: 2, family: 'DISCOVERY' },
      R08: { priority: 3, family: 'DISCOVERY' },
      R09: { priority: 4, family: 'CHAMPIONS' },
      R10: { priority: 1, family: 'SAFETY' },
    };
    expect(Object.keys(RULES_BY_ID).sort()).toEqual(Object.keys(expected).sort());
    for (const [id, meta] of Object.entries(expected)) {
      const rule = RULES_BY_ID[id as RecommendationId];
      expect(rule.priority, `${id} priority`).toBe(meta.priority);
      expect(rule.family, `${id} family`).toBe(meta.family);
      expect(rule.rootEvidenceQuestions.length, `${id} root evidence`).toBeGreaterThan(0);
      expect(rule.actionKeys.length, `${id} action keys`).toBeGreaterThan(0);
    }
  });

  it('never fires on the neutral baseline', () => {
    for (const id of Object.keys(RULES_BY_ID) as RecommendationId[]) {
      expect(fires(id, {}), `${id} fired on the neutral baseline`).toBe(false);
    }
  });
});

describe('R01 - strengthen safe AI use', () => {
  it('fires exactly at Adoption 60 and Safety 49.99', () => {
    expect(fires('R01', { adoption: 60, safety: 49.99 })).toBe(true);
  });

  it('does not fire one point below the Adoption threshold', () => {
    expect(fires('R01', { adoption: 59, safety: 20 })).toBe(false);
  });

  it('does not fire at Safety exactly 50', () => {
    expect(fires('R01', { adoption: 90, safety: 50 })).toBe(false);
  });

  it('fires one point above the Adoption threshold', () => {
    expect(fires('R01', { adoption: 61, safety: 49 })).toBe(true);
  });

  it('is not evaluable when Safety could not be assessed', () => {
    expect(fires('R01', { adoption: 90, safety: null })).toBe(false);
    expect(evaluable('R01', { adoption: 90, safety: null })).toBe(false);
  });

  it('reports the gap from the Safety threshold', () => {
    const result = RULES_BY_ID.R01.evaluate(baseContext({ adoption: 70, safety: 30 }));
    expect(result.gapFromThreshold).toBe(20);
  });
});

describe('R02 - publish clear AI usage guidance', () => {
  it('fires when any of Q18, Q19 or Q20 is below 50', () => {
    expect(fires('R02', { questionScores: { q18: 49 } })).toBe(true);
    expect(fires('R02', { questionScores: { q19: 49 } })).toBe(true);
    expect(fires('R02', { questionScores: { q20: 49 } })).toBe(true);
  });

  it('does not fire when all three sit exactly at 50', () => {
    expect(fires('R02', { questionScores: { q18: 50, q19: 50, q20: 50 } })).toBe(false);
  });

  it('does not fire one point above the threshold', () => {
    expect(fires('R02', { questionScores: { q18: 51, q19: 51, q20: 51 } })).toBe(false);
  });

  it('still fires when one input is unassessable but another is clearly low', () => {
    expect(fires('R02', { questionScores: { q18: null, q19: 10 } })).toBe(true);
  });

  it('is undecidable when the only low candidate is unassessable', () => {
    expect(evaluable('R02', { questionScores: { q18: null, q19: 80, q20: 80 } })).toBe(false);
  });

  it('counts each fired sub-finding as a supporting measure', () => {
    const result = RULES_BY_ID.R02.evaluate(
      baseContext({ questionScores: { q18: 10, q19: 10, q20: 10 } }),
    );
    expect(result.supportingMeasures).toBe(3);
  });
});

describe('R03 - improve verification and human review', () => {
  it('fires at Adoption exactly 40 with a weak Q16', () => {
    expect(fires('R03', { adoption: 40, questionScores: { q16: 49 } })).toBe(true);
  });

  it('does not fire one point below the Adoption threshold', () => {
    expect(fires('R03', { adoption: 39, questionScores: { q16: 10 } })).toBe(false);
  });

  it('fires on a weak Q17 alone', () => {
    expect(fires('R03', { adoption: 50, questionScores: { q17: 49 } })).toBe(true);
  });

  it('does not fire when Q16 and Q17 both sit exactly at 50', () => {
    expect(fires('R03', { adoption: 90, questionScores: { q16: 50, q17: 50 } })).toBe(false);
  });

  it('is not evaluable when Adoption could not be assessed', () => {
    expect(evaluable('R03', { adoption: null, questionScores: { q16: 10 } })).toBe(false);
  });
});

describe('R04 - remove organizational barriers', () => {
  it('fires at Interest exactly 70 with Enablement 49.99', () => {
    expect(fires('R04', { interest: 70, enablement: 49.99 })).toBe(true);
  });

  it('does not fire one point below the Interest threshold', () => {
    expect(fires('R04', { interest: 69, enablement: 10 })).toBe(false);
  });

  it('does not fire at Enablement exactly 50', () => {
    expect(fires('R04', { interest: 90, enablement: 50 })).toBe(false);
  });

  it('is not evaluable when Interest could not be assessed', () => {
    expect(evaluable('R04', { interest: null, enablement: 10 })).toBe(false);
  });
});

describe('R05 - build practical AI confidence', () => {
  it('fires at Adoption exactly 50 with Confidence 49', () => {
    expect(fires('R05', { adoption: 50, confidence: 49 })).toBe(true);
  });

  it('does not fire one point below the Adoption threshold', () => {
    expect(fires('R05', { adoption: 49, confidence: 10 })).toBe(false);
  });

  it('does not fire at Confidence exactly 50', () => {
    expect(fires('R05', { adoption: 90, confidence: 50 })).toBe(false);
  });

  it('is not evaluable when Confidence could not be assessed', () => {
    expect(evaluable('R05', { adoption: 90, confidence: null })).toBe(false);
  });
});

describe('R06 - move to repeatable workflows', () => {
  it('fires at Adoption exactly 60 with Workflow 49', () => {
    expect(fires('R06', { adoption: 60, workflow: 49 })).toBe(true);
  });

  it('does not fire one point below the Adoption threshold', () => {
    expect(fires('R06', { adoption: 59, workflow: 10 })).toBe(false);
  });

  it('does not fire at Workflow exactly 50', () => {
    expect(fires('R06', { adoption: 90, workflow: 50 })).toBe(false);
  });

  it('flags the confident-audience tailoring at Confidence 70 and above', () => {
    const tailored = RULES_BY_ID.R06.evaluate(baseContext({ adoption: 70, workflow: 20, confidence: 70 }));
    const untailored = RULES_BY_ID.R06.evaluate(baseContext({ adoption: 70, workflow: 20, confidence: 69 }));
    const flag = (r: typeof tailored) =>
      r.evidence.find((e) => e.metric === 'tailored_for_confident_audience')?.value;
    expect(flag(tailored)).toBe(1);
    expect(flag(untailored)).toBe(0);
  });
});

describe('R07 - interest not converting into adoption', () => {
  it('fires at Adoption 39.99, Interest 70, Enablement 50', () => {
    expect(fires('R07', { adoption: 39.99, interest: 70, enablement: 50 })).toBe(true);
  });

  it('does not fire at Adoption exactly 40', () => {
    expect(fires('R07', { adoption: 40, interest: 90, enablement: 80 })).toBe(false);
  });

  it('does not fire one point below the Interest threshold', () => {
    expect(fires('R07', { adoption: 10, interest: 69, enablement: 80 })).toBe(false);
  });

  it('does not fire one point below the Enablement floor', () => {
    expect(fires('R07', { adoption: 10, interest: 90, enablement: 49 })).toBe(false);
  });

  it('is mutually exclusive with R04 by construction', () => {
    // R04 needs Enablement < 50; R07 needs Enablement >= 50.
    for (const enablement of [0, 25, 49, 49.99, 50, 51, 80]) {
      const both = fires('R04', { interest: 90, enablement }) && fires('R07', { adoption: 10, interest: 90, enablement });
      expect(both, `enablement ${enablement}`).toBe(false);
    }
  });
});

describe('R08 - start with workflow discovery', () => {
  it('fires at Adoption 39.99 and Interest 49.99', () => {
    expect(fires('R08', { adoption: 39.99, interest: 49.99 })).toBe(true);
  });

  it('does not fire at Adoption exactly 40', () => {
    expect(fires('R08', { adoption: 40, interest: 10 })).toBe(false);
  });

  it('does not fire at Interest exactly 50', () => {
    expect(fires('R08', { adoption: 10, interest: 50 })).toBe(false);
  });

  it('is not evaluable when either input is unassessable', () => {
    expect(evaluable('R08', { adoption: null, interest: 10 })).toBe(false);
    expect(evaluable('R08', { adoption: 10, interest: null })).toBe(false);
  });
});

describe('R09 - internal AI champion group', () => {
  it('requires at least three qualifying respondents', () => {
    expect(fires('R09', { championCount: 2 })).toBe(false);
    expect(fires('R09', { championCount: 3 })).toBe(true);
    expect(fires('R09', { championCount: 4 })).toBe(true);
  });

  it('never produces respondent identities', () => {
    const result = RULES_BY_ID.R09.evaluate(baseContext({ championCount: 7 }));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/responseId|respondent-|fixture-/);
    expect(result.evidence.every((e) => typeof e.value === 'number' || e.value === null)).toBe(true);
  });
});

describe('R10 - reliance on independently accessed AI tools', () => {
  it('fires at Adoption 60 with the rate exactly at 30%', () => {
    expect(fires('R10', { adoption: 60, unmanagedToolRate: 0.3 })).toBe(true);
  });

  it('does not fire just below 30%', () => {
    expect(fires('R10', { adoption: 90, unmanagedToolRate: 0.2999 })).toBe(false);
  });

  it('fires above 30%', () => {
    expect(fires('R10', { adoption: 90, unmanagedToolRate: 0.31 })).toBe(true);
  });

  it('does not fire one point below the Adoption threshold', () => {
    expect(fires('R10', { adoption: 59, unmanagedToolRate: 0.9 })).toBe(false);
  });

  it('is not evaluable when no valid Q19b responses exist', () => {
    expect(evaluable('R10', { adoption: 90, unmanagedToolRate: null })).toBe(false);
  });

  it('reports the "prefer not to say" count separately from the rate', () => {
    const result = RULES_BY_ID.R10.evaluate(
      baseContext({ adoption: 90, unmanagedToolRate: 0.5, unmanagedToolPreferNotToSayCount: 9 }),
    );
    const excluded = result.evidence.find((e) => e.metric === 'unmanaged_prefer_not_to_say');
    expect(excluded?.value).toBe(9);
    expect(excluded?.unit).toBe('count');
  });

  it('pins the 30% threshold as a proportion', () => {
    expect(THRESHOLDS.R10_UNMANAGED_RATE_MIN).toBe(0.3);
  });
});

describe('evidence', () => {
  it('gives every rule measurable evidence when it fires', () => {
    const firing: [RecommendationId, Parameters<typeof baseContext>[0]][] = [
      ['R01', { adoption: 90, safety: 20 }],
      ['R02', { questionScores: { q18: 10 } }],
      ['R03', { adoption: 50, questionScores: { q16: 10 } }],
      ['R04', { interest: 90, enablement: 10 }],
      ['R05', { adoption: 90, confidence: 10 }],
      ['R06', { adoption: 90, workflow: 10 }],
      ['R07', { adoption: 10, interest: 90, enablement: 80 }],
      ['R08', { adoption: 10, interest: 10 }],
      ['R09', { championCount: 5 }],
      ['R10', { adoption: 90, unmanagedToolRate: 0.6 }],
    ];

    for (const [id, ctx] of firing) {
      const result = RULES_BY_ID[id].evaluate(baseContext(ctx));
      expect(result.triggered, `${id} should fire`).toBe(true);
      expect(result.evidence.length, `${id} evidence`).toBeGreaterThan(0);
      expect(
        result.evidence.some((e) => typeof e.value === 'number'),
        `${id} must cite at least one measured value`,
      ).toBe(true);
    }
  });
});
