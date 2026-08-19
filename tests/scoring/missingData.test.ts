/**
 * The 60% validity threshold, weight normalization, and typed Not Assessed
 * results.
 *
 * The distinction this file protects: "not enough information" must never be
 * reported as 0, NaN, or an unexplained null.
 */

import { describe, expect, it } from 'vitest';
import { calculateAdoption } from '../../src/core/scoring/adoption.js';
import { calculateConfidence } from '../../src/core/scoring/confidence.js';
import { calculateWorkflow } from '../../src/core/scoring/workflow.js';
import { calculateSafety } from '../../src/core/scoring/safety.js';
import { calculateEnablement } from '../../src/core/scoring/enablement.js';
import { MIN_VALID_WEIGHT_RATIO } from '../../src/core/scoring/types.js';
import { answers, answersWithout } from '../helpers.js';

describe('missing-data rule', () => {
  it('uses a 60% threshold', () => {
    expect(MIN_VALID_WEIGHT_RATIO).toBe(0.6);
  });

  describe('Adoption', () => {
    it('is assessed on Q5 alone (70% valid weight, above threshold)', () => {
      const result = calculateAdoption(answersWithout(['q7']));
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.validWeight).toBe(0.7);
      // Normalized to the surviving weight: the score equals Q5's own value.
      expect(result.score).toBe(60);
      expect(result.missingInputs).toEqual(['q7']);
    });

    it('is not assessed on Q7 alone (30% valid weight, below threshold)', () => {
      const result = calculateAdoption(answersWithout(['q5']));
      expect(result.assessed).toBe(false);
      if (result.assessed) return;
      expect(result.reason).toBe('insufficient_valid_weight');
      expect(result.validWeight).toBe(0.3);
    });

    it('never returns zero, NaN or a bare null when unassessable', () => {
      const result = calculateAdoption({});
      expect(result.assessed).toBe(false);
      expect(result).not.toHaveProperty('score');
    });
  });

  describe('Confidence', () => {
    it('is assessed with three of four items (75% valid weight)', () => {
      const result = calculateConfidence(
        answers({ q8: 'very_confident', q9: 'very_confident', q10: 'very_confident', q11: 'not_done_this' }),
      );
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.validWeight).toBe(0.75);
      expect(result.score).toBe(75);
      expect(result.notAssessedInputs).toEqual(['q11']);
    });

    it('is not assessed with two of four items (50% valid weight)', () => {
      const result = calculateConfidence(
        answers({ q8: 'very_confident', q9: 'very_confident', q10: 'not_done_this', q11: 'not_done_this' }),
      );
      expect(result.assessed).toBe(false);
      if (result.assessed) return;
      expect(result.validWeight).toBe(0.5);
    });
  });

  describe('Safety', () => {
    it('is assessed at exactly 60% valid weight (Q16 excluded)', () => {
      // Q17 0.30 + Q18 0.30 = 0.60, exactly on the threshold, which is inclusive.
      const result = calculateSafety(answers({ q16: 'not_applicable', q17: 'always', q18: 'extremely_confident' }));
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.validWeight).toBe(0.6);
      expect(result.score).toBe(100);
    });

    it('is not assessed just below the threshold', () => {
      // Q16 alone is 0.40.
      const result = calculateSafety(
        answers({ q16: 'always', q17: 'not_applicable', q18: undefined }),
      );
      expect(result.assessed).toBe(false);
      if (result.assessed) return;
      expect(result.validWeight).toBe(0.4);
    });

    it('normalizes surviving weights instead of dragging the score toward zero', () => {
      // Q16 excluded. Remaining: Q17 0.3 -> 100, Q18 0.3 -> 50.
      // Correct: (100*0.3 + 50*0.3) / 0.6 = 75. Wrong (unnormalized) would be 45.
      const result = calculateSafety(
        answers({ q16: 'not_applicable', q17: 'always', q18: 'somewhat_confident' }),
      );
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.score).toBe(75);
    });
  });

  describe('Workflow', () => {
    it('is assessed when only Q14 is Unsure (75% valid weight)', () => {
      const result = calculateWorkflow(
        answers({ q12: 'repeatable_processes', q13: 'often', q14: 'unsure' }),
      );
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.validWeight).toBe(0.75);
      // (80*0.5 + 75*0.25) / 0.75 = 58.75 / 0.75
      expect(result.score).toBeCloseTo(78.333333, 5);
      expect(result.notAssessedInputs).toEqual(['q14']);
    });

    it('is not assessed when Q12 is missing and Q14 is Unsure (25% valid weight)', () => {
      const result = calculateWorkflow(answersWithout(['q12'], { q14: 'unsure' }));
      expect(result.assessed).toBe(false);
      if (result.assessed) return;
      expect(result.validWeight).toBe(0.25);
    });
  });

  describe('Enablement', () => {
    it('is assessed with Q19 missing (80% valid weight)', () => {
      const result = calculateEnablement(answersWithout(['q19']));
      expect(result.assessed).toBe(true);
      if (!result.assessed) return;
      expect(result.validWeight).toBe(0.8);
    });

    it('is not assessed with only Q19 and Q21 answered (40% valid weight)', () => {
      const result = calculateEnablement(answersWithout(['q20', 'q22']));
      expect(result.assessed).toBe(false);
      if (result.assessed) return;
      expect(result.validWeight).toBeCloseTo(0.4, 10);
    });
  });

  describe('diagnostics', () => {
    it('separates Not Assessed answers from unanswered ones', () => {
      const result = calculateSafety(answersWithout(['q17'], { q16: 'not_applicable' }));
      expect(result.notAssessedInputs).toEqual(['q16']);
      expect(result.missingInputs).toEqual(['q17']);
      expect(result.scoredInputs).toEqual(['q18']);
    });
  });
});
