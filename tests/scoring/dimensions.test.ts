/**
 * Dimension formulas and exact weights.
 */

import { describe, expect, it } from 'vitest';
import {
  ADOPTION_WEIGHTS,
  calculateAdoption,
} from '../../src/core/scoring/adoption.js';
import { CONFIDENCE_ITEM_WEIGHT, calculateConfidence } from '../../src/core/scoring/confidence.js';
import { WORKFLOW_WEIGHTS, calculateWorkflow } from '../../src/core/scoring/workflow.js';
import { SAFETY_WEIGHTS, calculateSafety } from '../../src/core/scoring/safety.js';
import { ENABLEMENT_WEIGHTS, calculateEnablement } from '../../src/core/scoring/enablement.js';
import { calculateInterest, calculateScores } from '../../src/core/scoring/calculateScores.js';
import { answers } from '../helpers.js';

function scoreOf(result: ReturnType<typeof calculateAdoption>): number {
  if (!result.assessed) throw new Error(`Expected an assessed score, got ${result.reason}`);
  return result.score;
}

describe('weights', () => {
  it('uses the V1.1 weights exactly', () => {
    expect(ADOPTION_WEIGHTS).toEqual({ q5: 0.7, q7: 0.3 });
    expect(CONFIDENCE_ITEM_WEIGHT).toBe(0.25);
    expect(WORKFLOW_WEIGHTS).toEqual({ q12: 0.5, q13: 0.25, q14: 0.25 });
    expect(SAFETY_WEIGHTS).toEqual({ q16: 0.4, q17: 0.3, q18: 0.3 });
    expect(ENABLEMENT_WEIGHTS).toEqual({ q19: 0.2, q20: 0.3, q21: 0.2, q22: 0.3 });
  });

  it('has weights summing to 1 for every dimension', () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(ADOPTION_WEIGHTS)).toBeCloseTo(1, 10);
    expect(CONFIDENCE_ITEM_WEIGHT * 4).toBeCloseTo(1, 10);
    expect(sum(WORKFLOW_WEIGHTS)).toBeCloseTo(1, 10);
    expect(sum(SAFETY_WEIGHTS)).toBeCloseTo(1, 10);
    expect(sum(ENABLEMENT_WEIGHTS)).toBeCloseTo(1, 10);
  });
});

describe('Adoption', () => {
  it('applies Q5 x 0.70 + Q7 x 0.30', () => {
    // Q5 few_times_week = 60, Q7 two categories = 50 -> 42 + 15 = 57
    const result = calculateAdoption(answers({ q5: 'few_times_week', q7: ['email_communication', 'presentations'] }));
    expect(scoreOf(result)).toBe(57);
  });

  it('reaches the boundaries', () => {
    const zero = calculateAdoption(answers({ q5: 'never', q7: ['no_work_ai_use'] }));
    expect(scoreOf(zero)).toBe(0);

    const full = calculateAdoption(
      answers({
        q5: 'multiple_times_day',
        q7: ['email_communication', 'meetings_followup', 'research_information', 'writing_documents', 'reviewing_summarizing', 'data_entry_cleanup'],
      }),
    );
    expect(scoreOf(full)).toBe(100);
  });

  it('ignores Q4 entirely', () => {
    const low = calculateAdoption(answers({ q4: 'never' }));
    const high = calculateAdoption(answers({ q4: 'multiple_times_day' }));
    expect(scoreOf(low)).toBe(scoreOf(high));
  });
});

describe('Confidence', () => {
  it('is the mean of the four items', () => {
    const result = calculateConfidence(
      answers({ q8: 'not_confident', q9: 'slightly_confident', q10: 'somewhat_confident', q11: 'very_confident' }),
    );
    // (0 + 25 + 50 + 75) / 4
    expect(scoreOf(result)).toBe(37.5);
  });

  it('weights all four items equally', () => {
    const a = calculateConfidence(answers({ q8: 'extremely_confident', q9: 'not_confident', q10: 'not_confident', q11: 'not_confident' }));
    const b = calculateConfidence(answers({ q8: 'not_confident', q9: 'not_confident', q10: 'not_confident', q11: 'extremely_confident' }));
    expect(scoreOf(a)).toBe(scoreOf(b));
  });
});

describe('Workflow', () => {
  it('applies Q12 x 0.50 + Q13 x 0.25 + Q14 x 0.25', () => {
    // 60*0.5 + 75*0.25 + 50*0.25 = 30 + 18.75 + 12.5 = 61.25
    const result = calculateWorkflow(
      answers({ q12: 'reuse_prompts_approaches', q13: 'often', q14: 'one_small_process' }),
    );
    expect(scoreOf(result)).toBe(61.25);
  });

  it('ignores Q15 entirely', () => {
    const without = calculateWorkflow(answers({ q15: ['none_of_these'] }));
    const withArtifacts = calculateWorkflow(answers({ q15: ['ai_agent', 'automated_workflow', 'ai_tool_application'] }));
    expect(scoreOf(without)).toBe(scoreOf(withArtifacts));
  });
});

describe('Safety', () => {
  it('applies Q16 x 0.40 + Q17 x 0.30 + Q18 x 0.30', () => {
    // 50*0.4 + 75*0.3 + 25*0.3 = 20 + 22.5 + 7.5 = 50
    const result = calculateSafety(
      answers({ q16: 'sometimes', q17: 'usually', q18: 'slightly_confident' }),
    );
    expect(scoreOf(result)).toBe(50);
  });

  it('does not include Q19', () => {
    const a = calculateSafety(answers({ q19: 'yes_clearly' }));
    const b = calculateSafety(answers({ q19: 'not_defined' }));
    expect(scoreOf(a)).toBe(scoreOf(b));
  });

  it('does not include Q19b', () => {
    const a = calculateSafety(answers({ q19b: 'never' }));
    const b = calculateSafety(answers({ q19b: 'often' }));
    expect(scoreOf(a)).toBe(scoreOf(b));
  });

  it('scores Q18 "Unsure" as zero rather than excluding it', () => {
    const unsure = calculateSafety(answers({ q16: 'always', q17: 'always', q18: 'unsure' }));
    // 100*0.4 + 100*0.3 + 0*0.3 = 70
    expect(scoreOf(unsure)).toBe(70);
  });
});

describe('Enablement', () => {
  it('applies Q19 x 0.20 + Q20 x 0.30 + Q21 x 0.20 + Q22 x 0.30', () => {
    // 100*0.2 + 75*0.3 + 50*0.2 + 25*0.3 = 20 + 22.5 + 10 + 7.5 = 60
    const result = calculateEnablement(
      answers({ q19: 'yes_clearly', q20: 'agree', q21: 'neither', q22: 'disagree' }),
    );
    expect(scoreOf(result)).toBe(60);
  });

  it('treats Unsure across Q19-Q22 as zero by design', () => {
    const result = calculateEnablement(
      answers({ q19: 'unsure', q20: 'unsure', q21: 'unsure', q22: 'unsure' }),
    );
    expect(scoreOf(result)).toBe(0);
  });
});

describe('Interest', () => {
  it('maps the scale and stays separate from the five dimensions', () => {
    expect(calculateInterest(answers({ q28: 'very_interested' }))).toEqual({ assessed: true, score: 75 });
    const dimensions = calculateScores(answers());
    expect(Object.keys(dimensions).sort()).toEqual([
      'adoption', 'confidence', 'enablement', 'safety', 'workflow',
    ]);
  });

  it('reports Unsure as not assessed rather than zero', () => {
    expect(calculateInterest(answers({ q28: 'unsure' }))).toEqual({
      assessed: false,
      reason: 'not_assessed',
    });
  });

  it('distinguishes a missing answer from an Unsure answer', () => {
    const missing = calculateInterest({});
    expect(missing).toEqual({ assessed: false, reason: 'missing' });
  });
});

describe('floating-point stability', () => {
  it('produces clean values rather than binary-float noise', () => {
    // Normalizing across surviving weights is where float tails appear.
    const result = calculateConfidence(
      answers({ q8: 'slightly_confident', q9: 'somewhat_confident', q10: 'very_confident', q11: 'not_done_this' }),
    );
    const score = scoreOf(result);
    expect(score).toBe(50); // (25 + 50 + 75) / 3
    expect(String(score)).not.toMatch(/\d{10,}/);
  });
});
