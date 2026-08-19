import { describe, expect, it } from 'vitest';
import { classifyRespondent } from '../../src/core/classification/classifyRespondent.js';
import { answers, answersWithout } from '../helpers.js';

function level(overrides: Parameters<typeof answers>[0]): number {
  const result = classifyRespondent(answers(overrides));
  if (!result.classified) throw new Error(`Expected a classification, got ${result.reason}`);
  return result.level;
}

describe('classification ladder', () => {
  describe('Level 4 - Builder / Champion', () => {
    it('requires Q12 = built AND corroborating Q15 evidence', () => {
      for (const evidence of ['automated_workflow', 'ai_agent', 'ai_tool_application', 'shared_prompt_library', 'documentation_training', 'helped_coworkers'] as const) {
        expect(level({ q12: 'built_workflows_tools', q15: [evidence] }), evidence).toBe(4);
      }
    });

    it('falls through when Q12 = built but Q15 has no qualifying evidence', () => {
      // A reusable prompt template alone is not builder evidence.
      const result = level({ q12: 'built_workflows_tools', q15: ['reusable_prompt_template'], q5: 'most_workdays' });
      expect(result).toBe(2);
    });

    it('falls through when Q12 = built but Q15 is "none of these"', () => {
      expect(level({ q12: 'built_workflows_tools', q15: ['none_of_these'], q5: 'most_workdays' })).toBe(2);
    });

    it('does not promote a non-builder Q12 on Q15 evidence alone', () => {
      expect(level({ q12: 'repeatable_processes', q15: ['ai_agent'], q13: 'never', q14: 'no' })).toBe(3);
      expect(level({ q12: 'occasional_experiments', q15: ['ai_agent'], q5: 'less_than_monthly' })).toBe(1);
    });
  });

  describe('Level 3 - Workflow User', () => {
    it('requires reuse/repeatable behaviour plus corroboration from Q13', () => {
      expect(level({ q12: 'reuse_prompts_approaches', q13: 'often', q14: 'no', q15: ['none_of_these'] })).toBe(3);
      expect(level({ q12: 'repeatable_processes', q13: 'almost_always', q14: 'no', q15: ['none_of_these'] })).toBe(3);
    });

    it('accepts corroboration from Q14 instead', () => {
      expect(level({ q12: 'reuse_prompts_approaches', q13: 'never', q14: 'one_small_process', q15: ['none_of_these'] })).toBe(3);
    });

    it('accepts corroboration from a Q15 artifact instead', () => {
      expect(level({ q12: 'reuse_prompts_approaches', q13: 'never', q14: 'no', q15: ['custom_gpt_project'] })).toBe(3);
    });

    it('does not accept Q13 = Sometimes as corroboration', () => {
      // "Often" is the stated floor.
      expect(level({ q12: 'reuse_prompts_approaches', q13: 'sometimes', q14: 'no', q15: ['none_of_these'], q5: 'few_times_week' })).toBe(2);
    });

    it('does not accept Q14 = "not yet, but I see opportunities" as a changed process', () => {
      expect(level({ q12: 'reuse_prompts_approaches', q13: 'never', q14: 'see_opportunities', q15: ['none_of_these'], q5: 'few_times_week' })).toBe(2);
    });

    it('falls to the conservative level when uncorroborated', () => {
      // Claims repeatable processes but reports never reusing anything, no
      // changed process and no artifact.
      expect(level({ q12: 'repeatable_processes', q13: 'never', q14: 'no', q15: ['none_of_these'], q5: 'most_workdays' })).toBe(2);
      // ...and lower still when frequency is also low.
      expect(level({ q12: 'repeatable_processes', q13: 'never', q14: 'no', q15: ['none_of_these'], q5: 'less_than_monthly' })).toBe(1);
    });
  });

  describe('Level 2 - Regular User', () => {
    it('requires Q5 >= a few times per month AND Q12 >= regular individual tasks', () => {
      expect(level({ q5: 'few_times_month', q12: 'regular_individual_tasks', q15: ['none_of_these'] })).toBe(2);
    });

    it('is not reached one step below the Q5 floor', () => {
      expect(level({ q5: 'less_than_monthly', q12: 'regular_individual_tasks', q15: ['none_of_these'] })).toBe(1);
    });

    it('is not reached one step below the Q12 floor', () => {
      expect(level({ q5: 'multiple_times_day', q12: 'occasional_experiments', q15: ['none_of_these'] })).toBe(1);
    });
  });

  describe('Level 1 - Explorer', () => {
    it('covers occasional experimentation', () => {
      expect(level({ q5: 'less_than_monthly', q12: 'occasional_experiments', q15: ['none_of_these'] })).toBe(1);
    });

    it('covers a contradictory low-frequency, high-confidence response', () => {
      expect(
        level({
          q5: 'less_than_monthly',
          q12: 'occasional_experiments',
          q8: 'extremely_confident',
          q9: 'extremely_confident',
          q10: 'extremely_confident',
          q11: 'extremely_confident',
          q15: ['none_of_these'],
        }),
      ).toBe(1);
    });

    it('catches "never uses AI" contradicted by Q15 artifact evidence', () => {
      const result = classifyRespondent(
        answers({ q5: 'never', q12: 'no_work_ai_use', q15: ['ai_agent'] }),
      );
      if (!result.classified) throw new Error('expected classification');
      expect(result.level).toBe(1);
      expect(result.reasons.join(' ')).toMatch(/despite reporting no current work AI use/);
    });
  });

  describe('Level 0 - Non-user', () => {
    it('requires Q5 = Never, Q12 = no use, and no contradictory Q15 evidence', () => {
      expect(level({ q5: 'never', q12: 'no_work_ai_use', q15: ['none_of_these'] })).toBe(0);
    });

    it('tolerates "I am not sure what some of these mean" on Q15', () => {
      expect(level({ q5: 'never', q12: 'no_work_ai_use', q15: ['not_sure_meaning'] })).toBe(0);
    });

    it('tolerates having helped coworkers without building anything', () => {
      // Helping a coworker is not evidence of the respondent running an AI
      // workflow themselves, so it does not contradict Level 0.
      expect(level({ q5: 'never', q12: 'no_work_ai_use', q15: ['helped_coworkers'] })).toBe(0);
    });

    it('is not reached when any work AI use is reported', () => {
      expect(level({ q5: 'less_than_monthly', q12: 'no_work_ai_use', q15: ['none_of_these'] })).toBe(1);
      expect(level({ q5: 'never', q12: 'occasional_experiments', q15: ['none_of_these'] })).toBe(1);
    });
  });

  describe('unavailable classification', () => {
    it('reports missing required answers rather than guessing', () => {
      const result = classifyRespondent(answersWithout(['q5', 'q12']));
      expect(result.classified).toBe(false);
      if (result.classified) return;
      expect(result.reason).toBe('missing_required_answers');
      expect(result.missing).toEqual(['q5', 'q12']);
    });
  });

  it('always explains which rule matched', () => {
    const result = classifyRespondent(answers());
    if (!result.classified) throw new Error('expected classification');
    expect(result.matchedRule).toBeTruthy();
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
