import { describe, expect, it } from 'vitest';
import {
  QUESTIONS_BY_ID,
  QUESTION_IDS,
  SURVEY_QUESTIONS,
  FREE_TEXT_MAX_LENGTH,
} from '../../src/core/survey/questions.js';
import {
  SHARED_WORKFLOW_CATEGORY_IDS,
  isSharedWorkflowCategoryId,
} from '../../src/core/survey/categories.js';
import { SURVEY_VERSION, SCORING_VERSION, RECOMMENDATION_ENGINE_VERSION } from '../../src/core/versions.js';

describe('survey schema', () => {
  it('defines the 28 core questions plus Q19b', () => {
    expect(SURVEY_QUESTIONS).toHaveLength(29);
    expect(QUESTION_IDS).toContain('q19b');
    expect(QUESTION_IDS).toContain('q28');
  });

  it('has a unique id for every question', () => {
    const ids = SURVEY_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique option ids within every question', () => {
    for (const question of SURVEY_QUESTIONS) {
      if (question.type === 'free_text') continue;
      const ids = question.options.map((o) => o.id);
      expect(new Set(ids).size, `duplicate option id in ${question.id}`).toBe(ids.length);
    }
  });

  it('keeps machine option ids separate from display copy', () => {
    // Ids must be snake_case machine values, never the label text. This is the
    // guard against someone storing "A few times per week" in the database.
    for (const question of SURVEY_QUESTIONS) {
      if (question.type === 'free_text') continue;
      for (const option of question.options) {
        expect(option.id, `${question.id} option id must be snake_case`).toMatch(/^[a-z0-9_]+$/);
        expect(option.id).not.toBe(option.label);
      }
    }
  });

  it('marks Q1-Q3 and Q27 optional and unscored', () => {
    for (const id of ['q1', 'q2', 'q3', 'q27'] as const) {
      expect(QUESTIONS_BY_ID[id].required, `${id} must be optional`).toBe(false);
      expect(QUESTIONS_BY_ID[id].scored, `${id} must be unscored`).toBe(false);
    }
  });

  it('keeps Q4, Q6, Q15, Q19b, Q23-Q26 and Q28 diagnostic only', () => {
    for (const id of ['q4', 'q6', 'q15', 'q19b', 'q23', 'q24', 'q25', 'q26', 'q28'] as const) {
      expect(QUESTIONS_BY_ID[id].scored, `${id} must not be scored`).toBe(false);
      expect(QUESTIONS_BY_ID[id].dimension, `${id} must have no dimension`).toBeNull();
    }
  });

  it('maps scored questions to the correct dimension', () => {
    const expected = {
      q5: 'adoption', q7: 'adoption',
      q8: 'confidence', q9: 'confidence', q10: 'confidence', q11: 'confidence',
      q12: 'workflow', q13: 'workflow', q14: 'workflow',
      q16: 'safety', q17: 'safety', q18: 'safety',
      q19: 'enablement', q20: 'enablement', q21: 'enablement', q22: 'enablement',
    } as const;

    for (const [id, dimension] of Object.entries(expected)) {
      const question = QUESTIONS_BY_ID[id as keyof typeof expected];
      expect(question.scored, `${id} must be scored`).toBe(true);
      expect(question.dimension, `${id} dimension`).toBe(dimension);
    }
  });

  it('keeps Q19 in Enablement and out of Safety', () => {
    expect(QUESTIONS_BY_ID.q19.dimension).toBe('enablement');
  });

  it('preserves max-selection rules', () => {
    const q23 = QUESTIONS_BY_ID.q23;
    const q24 = QUESTIONS_BY_ID.q24;
    const q25 = QUESTIONS_BY_ID.q25;
    if (q23.type === 'free_text' || q24.type === 'free_text' || q25.type === 'free_text') {
      throw new Error('Q23-Q25 must be select questions');
    }
    expect(q23.maxSelections).toBe(3);
    expect(q24.maxSelections).toBe(3);
    expect(q25.maxSelections).toBe(2);
  });

  it('caps free text at 1000 characters', () => {
    const q27 = QUESTIONS_BY_ID.q27;
    if (q27.type !== 'free_text') throw new Error('Q27 must be free text');
    expect(q27.maxLength).toBe(FREE_TEXT_MAX_LENGTH);
    expect(FREE_TEXT_MAX_LENGTH).toBe(1000);
  });

  it('shares the same 12 workflow categories between Q7 and Q26', () => {
    const q7 = QUESTIONS_BY_ID.q7;
    const q26 = QUESTIONS_BY_ID.q26;
    if (q7.type === 'free_text' || q26.type === 'free_text') throw new Error('unexpected type');

    const q7Ids = new Set(q7.options.map((o) => o.id));
    const q26Ids = new Set(q26.options.map((o) => o.id));

    expect(SHARED_WORKFLOW_CATEGORY_IDS).toHaveLength(12);
    for (const category of SHARED_WORKFLOW_CATEGORY_IDS) {
      expect(q7Ids.has(category), `q7 missing ${category}`).toBe(true);
      expect(q26Ids.has(category), `q26 missing ${category}`).toBe(true);
      expect(isSharedWorkflowCategoryId(category)).toBe(true);
    }
  });

  it('does not treat usage-only or pain-only options as shared categories', () => {
    for (const id of ['coding_technical', 'creating_media', 'building_workflows_tools', 'training_onboarding', 'repetitive_system_updates', 'no_work_ai_use', 'none_of_these']) {
      expect(isSharedWorkflowCategoryId(id), `${id} must not be shared`).toBe(false);
    }
  });

  it('pins the V1.1 version constants', () => {
    expect(SURVEY_VERSION).toBe('1.1.0');
    expect(SCORING_VERSION).toBe('1.1.0');
    expect(RECOMMENDATION_ENGINE_VERSION).toBe('1.1.0');
  });
});
