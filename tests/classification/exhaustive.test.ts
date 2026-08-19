/**
 * Mandatory exhaustiveness test. Spec 20, 60.2.
 *
 * Every valid Q5 x Q12 x Q13 x Q14 x Q15 combination must resolve to exactly
 * one classification. This walks the full product of those five questions,
 * including all 2^10 Q15 subsets: 6 x 6 x 6 x 6 x 1024 = 1,327,104 cases.
 *
 * The point is not that one of these cases is likely to be wrong today. It is
 * that adding a rule later cannot leave a gap or create an overlap without
 * this failing.
 */

import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_KEY_BY_LEVEL,
  CLASSIFICATION_LEVELS,
  classifyRespondent,
} from '../../src/core/classification/classifyRespondent.js';
import {
  Q12_OPTIONS,
  Q13_OPTIONS,
  Q14_OPTIONS,
  Q15_OPTIONS,
  Q5_OPTIONS,
} from '../../src/core/survey/options.js';
import type { SurveyAnswers } from '../../src/core/survey/answers.js';

/** All 2^10 subsets of the Q15 options, built once and reused. */
function allQ15Subsets(): readonly (readonly (typeof Q15_OPTIONS)[number][])[] {
  const subsets: (typeof Q15_OPTIONS)[number][][] = [];
  const total = 2 ** Q15_OPTIONS.length;
  for (let mask = 0; mask < total; mask += 1) {
    const subset: (typeof Q15_OPTIONS)[number][] = [];
    for (let bit = 0; bit < Q15_OPTIONS.length; bit += 1) {
      if (mask & (1 << bit)) subset.push(Q15_OPTIONS[bit] as (typeof Q15_OPTIONS)[number]);
    }
    subsets.push(subset);
  }
  return subsets;
}

describe('classification exhaustiveness', () => {
  it('resolves every valid Q5/Q12/Q13/Q14/Q15 combination to exactly one level', () => {
    const q15Subsets = allQ15Subsets();
    const validLevels = new Set<number>(CLASSIFICATION_LEVELS);
    const levelCounts = new Map<number, number>();
    const matchedRules = new Set<string>();

    let cases = 0;

    for (const q5 of Q5_OPTIONS) {
      for (const q12 of Q12_OPTIONS) {
        for (const q13 of Q13_OPTIONS) {
          for (const q14 of Q14_OPTIONS) {
            for (const q15 of q15Subsets) {
              const answers: SurveyAnswers = { q5, q12, q13, q14, q15 };
              const result = classifyRespondent(answers);

              if (!result.classified) {
                throw new Error(
                  `Unclassified combination: ${JSON.stringify({ q5, q12, q13, q14, q15 })}`,
                );
              }
              if (!validLevels.has(result.level)) {
                throw new Error(`Invalid level ${result.level} for ${JSON.stringify(answers)}`);
              }
              if (CLASSIFICATION_KEY_BY_LEVEL[result.level] !== result.key) {
                throw new Error(`Level/key mismatch for ${JSON.stringify(answers)}`);
              }

              levelCounts.set(result.level, (levelCounts.get(result.level) ?? 0) + 1);
              matchedRules.add(result.matchedRule);
              cases += 1;
            }
          }
        }
      }
    }

    expect(cases).toBe(
      Q5_OPTIONS.length * Q12_OPTIONS.length * Q13_OPTIONS.length * Q14_OPTIONS.length * q15Subsets.length,
    );
    expect(cases).toBe(1_327_104);

    // Every level must be reachable, or a rule has become unreachable.
    for (const level of CLASSIFICATION_LEVELS) {
      expect(levelCounts.get(level) ?? 0, `level ${level} is unreachable`).toBeGreaterThan(0);
    }

    // Every ladder rule must be reachable too.
    expect(matchedRules.size).toBe(5);
  });

  it('is deterministic: the same input always yields the same level', () => {
    const answers: SurveyAnswers = {
      q5: 'few_times_week',
      q12: 'reuse_prompts_approaches',
      q13: 'often',
      q14: 'unsure',
      q15: ['reusable_prompt_template'],
    };
    const first = classifyRespondent(answers);
    for (let i = 0; i < 50; i += 1) {
      expect(classifyRespondent(answers)).toEqual(first);
    }
  });

  it('is unaffected by Q15 selection order', () => {
    const a = classifyRespondent({
      q5: 'never', q12: 'built_workflows_tools', q15: ['ai_agent', 'helped_coworkers'],
    });
    const b = classifyRespondent({
      q5: 'never', q12: 'built_workflows_tools', q15: ['helped_coworkers', 'ai_agent'],
    });
    expect(a).toEqual(b);
  });
});
