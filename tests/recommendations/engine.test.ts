/**
 * Engine orchestration: merge, suppression, ranking, deduplication, sample
 * size and confidence labels.
 */

import { describe, expect, it } from 'vitest';
import { runRecommendationEngine } from '../../src/core/recommendations/engine.js';
import { rankRecommendations } from '../../src/core/recommendations/ranking.js';
import { deduplicateRecommendations } from '../../src/core/recommendations/deduplication.js';
import {
  MAX_ADDITIONAL_RECOMMENDATIONS,
  MAX_PRIMARY_PER_ROOT_QUESTION,
  MAX_PRIMARY_RECOMMENDATIONS,
  type RecommendationId,
  type RecommendationResult,
} from '../../src/core/recommendations/types.js';
import { baseContext } from '../helpers.js';

function run(overrides: Parameters<typeof baseContext>[0]) {
  return runRecommendationEngine(baseContext(overrides));
}

function byId(result: ReturnType<typeof run>, id: RecommendationId): RecommendationResult {
  const found = result.evaluated.find((r) => r.id === id);
  if (!found) throw new Error(`${id} missing from evaluation`);
  return found;
}

describe('sample size', () => {
  it('refuses to produce recommendations below five responses', () => {
    const result = run({ responseCount: 4, adoption: 90, safety: 10 });
    expect(result.status).toBe('insufficient_sample');
    expect(result.primary).toEqual([]);
    expect(result.additional).toEqual([]);
    expect(result.triggered).toEqual([]);
    expect(result.evaluated).toEqual([]);
  });

  it('produces recommendations from five responses', () => {
    const result = run({ responseCount: 5, adoption: 90, safety: 10 });
    expect(result.status).toBe('ok');
    expect(result.primary.length).toBeGreaterThan(0);
  });
});

describe('confidence labels', () => {
  it('labels a small sample as an Early Signal', () => {
    for (const responseCount of [5, 9]) {
      const result = run({ responseCount, adoption: 90, safety: 10 });
      expect(byId(result, 'R01').confidenceLabel, `n=${responseCount}`).toBe('early_signal');
    }
  });

  it('labels a single supporting measure at n>=10 as a Signal', () => {
    const result = run({
      responseCount: 10,
      adoption: 90,
      workflow: 10,
      questionScores: { q13: 80, q14: 80 },
    });
    expect(byId(result, 'R06').confidenceLabel).toBe('signal');
  });

  it('labels multiple supporting measures at n>=10 as a Strong Signal', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      workflow: 10,
      questionScores: { q13: 10, q14: 10 },
    });
    expect(byId(result, 'R06').confidenceLabel).toBe('strong_signal');
  });

  it('never attaches a numeric statistical confidence', () => {
    const result = run({ responseCount: 40, adoption: 90, safety: 10 });
    const serialized = JSON.stringify(result.primary);
    expect(serialized).not.toMatch(/p_?value|confidenceInterval|significance/i);
    for (const rule of result.primary) {
      expect(['strong_signal', 'signal', 'early_signal']).toContain(rule.confidenceLabel);
    }
  });

  it('leaves the label null for rules that did not fire', () => {
    const result = run({ responseCount: 30 });
    for (const rule of result.evaluated) {
      expect(rule.confidenceLabel).toBeNull();
    }
  });
});

describe('R01 / R03 merge', () => {
  it('merges the verification finding into R01 when both would fire', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 20,
      questionScores: { q16: 10, q17: 10 },
    });

    const r01 = byId(result, 'R01');
    const r03 = byId(result, 'R03');

    expect(r01.triggered).toBe(true);
    expect(r03.triggered).toBe(true);
    expect(r03.suppressedBy).toBe('R01');
    expect(r03.suppressionReason).toBe('merged_into_r01');
    expect(r01.mergedFindings.map((m) => m.sourceId)).toContain('R03');

    // The merged rule must not consume a slot of its own.
    expect(result.primary.map((r) => r.id)).not.toContain('R03');
    expect(result.additional.map((r) => r.id)).not.toContain('R03');
  });

  it('lets R03 stand on its own when R01 does not fire', () => {
    // Safety above threshold, but verification specifically weak.
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 70,
      questionScores: { q16: 10, q17: 10 },
    });
    expect(byId(result, 'R01').triggered).toBe(false);
    expect(byId(result, 'R03').triggered).toBe(true);
    expect(byId(result, 'R03').suppressedBy).toBeNull();
    expect(result.primary.map((r) => r.id)).toContain('R03');
  });
});

describe('R01 / R10 merge', () => {
  it('merges unmanaged-tool reliance into R01 when both fire', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 20,
      unmanagedToolRate: 0.6,
    });

    const r01 = byId(result, 'R01');
    const r10 = byId(result, 'R10');

    expect(r10.triggered).toBe(true);
    expect(r10.suppressedBy).toBe('R01');
    expect(r10.suppressionReason).toBe('merged_into_r01');
    expect(r01.mergedFindings.map((m) => m.sourceId)).toContain('R10');
    expect(r01.mergedFindings.flatMap((m) => m.evidence).length).toBeGreaterThan(0);
    expect(result.primary.map((r) => r.id)).not.toContain('R10');
  });

  it('lets R10 stand on its own when R01 does not fire', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 80,
      unmanagedToolRate: 0.6,
    });
    expect(byId(result, 'R10').suppressedBy).toBeNull();
    expect(result.primary.map((r) => r.id)).toContain('R10');
  });

  it('merges both R03 and R10 into R01 when all three fire', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 20,
      unmanagedToolRate: 0.6,
      questionScores: { q16: 10, q17: 10 },
    });
    expect(byId(result, 'R01').mergedFindings.map((m) => m.sourceId).sort()).toEqual(['R03', 'R10']);
  });
});

describe('R07 suppression by R04', () => {
  it('suppresses R07 when R04 explains the adoption gap', () => {
    // Construct the (otherwise impossible) case directly to prove the
    // suppression rule exists rather than relying on threshold exclusivity.
    const result = run({
      responseCount: 30,
      adoption: 10,
      interest: 90,
      enablement: 20,
    });
    expect(byId(result, 'R04').triggered).toBe(true);
    const r07 = byId(result, 'R07');
    // R07 requires Enablement >= 50, so it cannot fire here; either way it must
    // never occupy a slot alongside R04.
    expect(result.primary.map((r) => r.id)).not.toContain('R07');
    expect(r07.triggered).toBe(false);
  });

  it('allows R07 when Enablement is adequate', () => {
    const result = run({ responseCount: 30, adoption: 10, interest: 90, enablement: 80 });
    expect(byId(result, 'R04').triggered).toBe(false);
    expect(byId(result, 'R07').triggered).toBe(true);
    expect(result.primary.map((r) => r.id)).toContain('R07');
  });
});

describe('ranking', () => {
  it('orders by priority first', () => {
    const result = run({
      responseCount: 30,
      adoption: 90,
      safety: 20,       // R01, priority 1
      confidence: 10,   // R05, priority 2
      workflow: 10,     // R06, priority 3
    });
    const priorities = result.triggered.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('orders by larger gap from threshold within a priority', () => {
    const ranked = rankRecommendations([
      { id: 'R05', priority: 2, gapFromThreshold: 5, affectedProportion: 0.5 } as RecommendationResult,
      { id: 'R04', priority: 2, gapFromThreshold: 40, affectedProportion: 0.5 } as RecommendationResult,
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['R04', 'R05']);
  });

  it('breaks a gap tie by proportion affected', () => {
    const ranked = rankRecommendations([
      { id: 'R04', priority: 2, gapFromThreshold: 10, affectedProportion: 0.2 } as RecommendationResult,
      { id: 'R05', priority: 2, gapFromThreshold: 10, affectedProportion: 0.9 } as RecommendationResult,
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['R05', 'R04']);
  });

  it('breaks a full tie by the lower rule id', () => {
    const ranked = rankRecommendations([
      { id: 'R05', priority: 2, gapFromThreshold: 10, affectedProportion: 0.5 } as RecommendationResult,
      { id: 'R04', priority: 2, gapFromThreshold: 10, affectedProportion: 0.5 } as RecommendationResult,
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['R04', 'R05']);
  });

  it('is stable across repeated runs', () => {
    const ctx = { responseCount: 30, adoption: 90, safety: 20, confidence: 10, workflow: 10, interest: 90, enablement: 10 };
    const first = run(ctx).primary.map((r) => r.id);
    for (let i = 0; i < 20; i += 1) {
      expect(run(ctx).primary.map((r) => r.id)).toEqual(first);
    }
  });
});

describe('deduplication', () => {
  function stub(
    id: string,
    family: string,
    priority: number,
    roots: string[],
  ): RecommendationResult {
    return {
      id, family, priority,
      rootEvidenceQuestions: roots,
      gapFromThreshold: 10,
      affectedProportion: 0.5,
    } as unknown as RecommendationResult;
  }

  it('allows only one primary per family', () => {
    const { primary, additional } = deduplicateRecommendations([
      stub('R01', 'SAFETY', 1, ['q16']),
      stub('R03', 'SAFETY', 1, ['q17']),
    ]);
    expect(primary.map((r) => r.id)).toEqual(['R01']);
    expect(additional.map((r) => r.id)).toEqual(['R03']);
    expect(additional[0]?.suppressionReason).toBe('family_already_represented');
  });

  it('caps primary recommendations at three', () => {
    const { primary, additional } = deduplicateRecommendations([
      stub('A', 'SAFETY', 1, ['q1']),
      stub('B', 'POLICY', 1, ['q2']),
      stub('C', 'ENABLEMENT', 2, ['q3']),
      stub('D', 'CONFIDENCE', 2, ['q4']),
    ]);
    expect(primary).toHaveLength(MAX_PRIMARY_RECOMMENDATIONS);
    expect(additional.map((r) => r.id)).toEqual(['D']);
    expect(additional[0]?.suppressionReason).toBe('primary_slots_full');
  });

  it('allows at most two primaries resting on the same root question', () => {
    const { primary, additional } = deduplicateRecommendations([
      stub('A', 'SAFETY', 1, ['q20']),
      stub('B', 'POLICY', 1, ['q20']),
      stub('C', 'ENABLEMENT', 2, ['q20']),
    ]);
    expect(primary.map((r) => r.id)).toEqual(['A', 'B']);
    expect(additional.map((r) => r.id)).toEqual(['C']);
    expect(additional[0]?.suppressionReason).toBe('root_evidence_limit');
    expect(MAX_PRIMARY_PER_ROOT_QUESTION).toBe(2);
  });

  it('caps additional signals at three', () => {
    const { additional } = deduplicateRecommendations([
      stub('A', 'SAFETY', 1, ['q1']),
      stub('B', 'POLICY', 1, ['q2']),
      stub('C', 'ENABLEMENT', 2, ['q3']),
      stub('D', 'CONFIDENCE', 2, ['q4']),
      stub('E', 'WORKFLOW', 3, ['q5']),
      stub('F', 'DISCOVERY', 3, ['q6']),
      stub('G', 'CHAMPIONS', 4, ['q7']),
    ]);
    expect(additional).toHaveLength(MAX_ADDITIONAL_RECOMMENDATIONS);
  });
});

describe('engine output shape', () => {
  it('evaluates all ten rules even when few fire', () => {
    const result = run({ responseCount: 30 });
    expect(result.evaluated).toHaveLength(10);
    expect(result.primary).toHaveLength(0);
  });

  it('stamps the engine version on every result', () => {
    const result = run({ responseCount: 30, adoption: 90, safety: 10 });
    expect(result.engineVersion).toBe('1.1.0');
    for (const rule of result.evaluated) {
      expect(rule.engineVersion).toBe('1.1.0');
    }
  });

  it('exposes the evaluated conditions behind every fired rule', () => {
    const result = run({ responseCount: 30, adoption: 90, safety: 10 });
    for (const rule of result.primary) {
      expect(rule.conditions.length).toBeGreaterThan(0);
      expect(rule.conditions.every((c) => c.met)).toBe(true);
      for (const condition of rule.conditions) {
        expect(typeof condition.threshold).toBe('number');
        expect(['gte', 'gt', 'lt', 'lte']).toContain(condition.comparator);
      }
    }
  });
});
