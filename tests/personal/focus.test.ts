/**
 * The personal focus ruleset: deterministic, exhaustive, first-match-wins.
 *
 * Tests build real RespondentScores/classifications through the actual engine
 * where the scenario allows it, and synthetic score objects where a precise
 * boundary must be pinned.
 */

import { describe, expect, it } from 'vitest';
import { decidePersonalFocus, FOCUS_THRESHOLDS } from '../../src/core/personal/focus.js';
import type { DimensionScore, RespondentScores } from '../../src/core/scoring/types.js';
import type { Dimension } from '../../src/core/survey/questions.js';
import {
  classifyRespondent,
  type RespondentClassification,
  type ClassificationLevel,
} from '../../src/core/classification/classifyRespondent.js';
import { calculateScores } from '../../src/core/scoring/calculateScores.js';
import { answers } from '../helpers.js';

function dim(dimension: Dimension, score: number | null): DimensionScore {
  if (score === null) {
    return {
      dimension,
      assessed: false,
      reason: 'insufficient_valid_weight',
      validWeight: 0,
      notAssessedInputs: [],
      missingInputs: [],
      scoredInputs: [],
    };
  }
  return {
    dimension,
    assessed: true,
    score,
    validWeight: 1,
    notAssessedInputs: [],
    missingInputs: [],
    scoredInputs: [],
  };
}

function scores(input: {
  adoption?: number | null;
  confidence?: number | null;
  workflow?: number | null;
  safety?: number | null;
  enablement?: number | null;
}): RespondentScores {
  return {
    adoption: dim('adoption', input.adoption ?? 50),
    confidence: dim('confidence', input.confidence ?? 50),
    workflow: dim('workflow', input.workflow ?? 50),
    safety: dim('safety', input.safety ?? 75),
    enablement: dim('enablement', input.enablement ?? 50),
  };
}

function classification(level: ClassificationLevel | null): RespondentClassification {
  if (level === null) {
    return { classified: false, reason: 'missing_required_answers', missing: ['q5', 'q12'] };
  }
  // The concrete key/label/rule fields are irrelevant to focus decisions.
  const result = classifyRespondent(
    answers(
      level === 0
        ? { q5: 'never', q12: 'no_work_ai_use', q15: ['none_of_these'] }
        : level === 1
          ? { q5: 'less_than_monthly', q12: 'occasional_experiments', q15: ['none_of_these'] }
          : level === 2
            ? { q5: 'few_times_week', q12: 'regular_individual_tasks', q15: ['none_of_these'] }
            : level === 3
              ? { q12: 'repeatable_processes', q13: 'often', q15: ['none_of_these'] }
              : { q12: 'built_workflows_tools', q15: ['ai_agent'] },
    ),
  );
  if (!result.classified || result.level !== level) {
    throw new Error(`Test setup failed to build level ${level}`);
  }
  return result;
}

describe('rule 1 - strengthen safety', () => {
  it('fires at Adoption exactly 60 with Safety 49.9', () => {
    const focus = decidePersonalFocus(scores({ adoption: 60, safety: 49.9 }), classification(2));
    expect(focus.id).toBe('strengthen_safety');
  });

  it('does not fire at Adoption 59.9', () => {
    const focus = decidePersonalFocus(scores({ adoption: 59.9, safety: 20 }), classification(2));
    expect(focus.id).not.toBe('strengthen_safety');
  });

  it('does not fire at Safety exactly 50', () => {
    const focus = decidePersonalFocus(scores({ adoption: 90, safety: 50 }), classification(2));
    expect(focus.id).not.toBe('strengthen_safety');
  });

  it('does not fire when Safety could not be assessed', () => {
    const focus = decidePersonalFocus(scores({ adoption: 90, safety: null }), classification(2));
    expect(focus.id).not.toBe('strengthen_safety');
  });

  it('outranks every other rule', () => {
    // A builder-level respondent with risky safety still hears about safety first.
    const focus = decidePersonalFocus(
      scores({ adoption: 90, confidence: 90, workflow: 90, safety: 30 }),
      classification(4),
    );
    expect(focus.id).toBe('strengthen_safety');
  });
});

describe('rule 2 - document a workflow', () => {
  it('fires exactly at confidence 70 / workflow 75 / safety 70', () => {
    const focus = decidePersonalFocus(
      scores({ adoption: 50, confidence: 70, workflow: 75, safety: 70 }),
      classification(4),
    );
    expect(focus.id).toBe('document_workflow');
  });

  it('does not fire one point below any of the three bars', () => {
    const base = { adoption: 50, confidence: 70, workflow: 75, safety: 70 };
    for (const missing of [
      { ...base, confidence: 69 },
      { ...base, workflow: 74 },
      { ...base, safety: 69 },
    ]) {
      expect(decidePersonalFocus(scores(missing), classification(4)).id).not.toBe('document_workflow');
    }
  });

  it('never mentions champion status', () => {
    const focus = decidePersonalFocus(
      scores({ confidence: 90, workflow: 90, safety: 90 }),
      classification(4),
    );
    expect(`${focus.primary} ${focus.nextStep}`.toLowerCase()).not.toContain('champion');
  });
});

describe('rule 3 - start small', () => {
  it('applies to non-users', () => {
    expect(decidePersonalFocus(scores({ adoption: 0, safety: null }), classification(0)).id).toBe('start_small');
  });

  it('applies to explorers', () => {
    expect(decidePersonalFocus(scores({ adoption: 20 }), classification(1)).id).toBe('start_small');
  });

  it('applies when classification is unavailable', () => {
    expect(decidePersonalFocus(scores({}), classification(null)).id).toBe('start_small');
  });
});

describe('rule 4 - make repeatable', () => {
  it('fires for a regular user with Workflow 49.9', () => {
    expect(decidePersonalFocus(scores({ workflow: 49.9 }), classification(2)).id).toBe('make_repeatable');
  });

  it('does not fire at Workflow exactly 50', () => {
    expect(decidePersonalFocus(scores({ workflow: 50 }), classification(2)).id).toBe('consolidate');
  });

  it('does not fire when Workflow could not be assessed', () => {
    expect(decidePersonalFocus(scores({ workflow: null }), classification(2)).id).toBe('consolidate');
  });
});

describe('rule 5 - consolidate fallback', () => {
  it('catches workflow users without champion-level scores', () => {
    expect(decidePersonalFocus(scores({ workflow: 60, confidence: 55 }), classification(3)).id).toBe('consolidate');
  });
});

describe('exhaustiveness and determinism', () => {
  const SCORE_VALUES = [null, 0, 30, 49.9, 50, 59.9, 60, 69.9, 70, 74.9, 75, 100];
  const LEVELS: (ClassificationLevel | null)[] = [null, 0, 1, 2, 3, 4];

  it('returns exactly one focus with non-empty copy for every combination', () => {
    for (const level of LEVELS) {
      for (const adoption of SCORE_VALUES) {
        for (const workflow of SCORE_VALUES) {
          for (const safety of SCORE_VALUES) {
            const focus = decidePersonalFocus(
              scores({ adoption, workflow, safety, confidence: 70 }),
              classification(level),
            );
            expect(focus.primary.length).toBeGreaterThan(0);
            expect(focus.nextStep.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('is deterministic for identical input', () => {
    const s = scores({ adoption: 65, workflow: 40, safety: 45 });
    const c = classification(2);
    const first = decidePersonalFocus(s, c);
    for (let i = 0; i < 20; i += 1) {
      expect(decidePersonalFocus(s, c)).toEqual(first);
    }
  });

  it('pins the documented thresholds', () => {
    expect(FOCUS_THRESHOLDS).toEqual({
      SAFETY_RULE_ADOPTION_MIN: 60,
      SAFETY_RULE_SAFETY_MAX: 50,
      STRONG_CONFIDENCE_MIN: 70,
      STRONG_WORKFLOW_MIN: 75,
      STRONG_SAFETY_MIN: 70,
      REPEATABLE_WORKFLOW_MAX: 50,
    });
  });
});

describe('integration with the real engine', () => {
  it('produces make_repeatable for a real task-by-task regular user', () => {
    const a = answers({
      q5: 'few_times_week',
      q7: ['email_communication', 'research_information'],
      q12: 'regular_individual_tasks',
      q13: 'sometimes',
      q14: 'see_opportunities',
    });
    const focus = decidePersonalFocus(calculateScores(a), classifyRespondent(a));
    expect(focus.id).toBe('make_repeatable');
  });

  it('produces strengthen_safety for a real heavy user with weak safety answers', () => {
    const a = answers({
      q5: 'multiple_times_day',
      q7: ['email_communication', 'research_information', 'writing_documents', 'creating_content'],
      q16: 'rarely',
      q17: 'sometimes',
      q18: 'unsure',
    });
    const focus = decidePersonalFocus(calculateScores(a), classifyRespondent(a));
    expect(focus.id).toBe('strengthen_safety');
  });
});
