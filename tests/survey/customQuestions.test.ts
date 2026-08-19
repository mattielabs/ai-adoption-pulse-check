import { describe, expect, it } from 'vitest';
import {
  CUSTOM_FREE_TEXT_MAX_LENGTH,
  customQuestionKey,
  validateCustomAnswers,
  type PublicCustomQuestion,
} from '../../src/core/survey/customQuestions.js';

const QUESTIONS: readonly PublicCustomQuestion[] = [
  {
    key: 'c1',
    type: 'single_select',
    questionText: 'Which location do you mostly work from?',
    options: [
      { id: 'hq', label: 'Headquarters' },
      { id: 'remote', label: 'Remote' },
    ],
  },
  {
    key: 'c2',
    type: 'multi_select',
    questionText: 'Which internal systems do you use weekly?',
    options: [
      { id: 'crm', label: 'CRM' },
      { id: 'erp', label: 'ERP' },
      { id: 'wiki', label: 'Wiki' },
    ],
  },
  { key: 'c3', type: 'free_text', questionText: 'Anything else?', options: null },
];

describe('custom question keys', () => {
  it('are position-based, never database ids', () => {
    expect(customQuestionKey(1)).toBe('c1');
    expect(customQuestionKey(3)).toBe('c3');
  });
});

describe('validateCustomAnswers', () => {
  it('accepts absent answers - every custom question is optional', () => {
    expect(validateCustomAnswers(QUESTIONS, undefined)).toEqual({ ok: true, value: {} });
    expect(validateCustomAnswers(QUESTIONS, {})).toEqual({ ok: true, value: {} });
  });

  it('accepts a full valid answer set', () => {
    const result = validateCustomAnswers(QUESTIONS, {
      c1: 'hq',
      c2: ['crm', 'wiki'],
      c3: 'Nothing to add.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ c1: 'hq', c2: ['crm', 'wiki'], c3: 'Nothing to add.' });
  });

  it('accepts a partial answer set', () => {
    expect(validateCustomAnswers(QUESTIONS, { c2: ['erp'] }).ok).toBe(true);
  });

  it('rejects answers for keys the Pulse never configured', () => {
    const result = validateCustomAnswers(QUESTIONS, { c4: 'anything' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.key).toBe('c4');
  });

  it('rejects everything when no custom questions are configured', () => {
    expect(validateCustomAnswers([], { c1: 'hq' }).ok).toBe(false);
  });

  it('rejects an unknown single-select option', () => {
    expect(validateCustomAnswers(QUESTIONS, { c1: 'moon_base' }).ok).toBe(false);
  });

  it('rejects an array where a single selection is expected', () => {
    expect(validateCustomAnswers(QUESTIONS, { c1: ['hq'] }).ok).toBe(false);
  });

  it('rejects a string where a multi-select is expected', () => {
    expect(validateCustomAnswers(QUESTIONS, { c2: 'crm' }).ok).toBe(false);
  });

  it('rejects unknown and duplicate multi-select options', () => {
    expect(validateCustomAnswers(QUESTIONS, { c2: ['crm', 'nope'] }).ok).toBe(false);
    expect(validateCustomAnswers(QUESTIONS, { c2: ['crm', 'crm'] }).ok).toBe(false);
  });

  it('rejects an empty multi-select array - omit the key instead', () => {
    expect(validateCustomAnswers(QUESTIONS, { c2: [] }).ok).toBe(false);
  });

  it('accepts free text at the cap and rejects one character over', () => {
    expect(validateCustomAnswers(QUESTIONS, { c3: 'a'.repeat(CUSTOM_FREE_TEXT_MAX_LENGTH) }).ok).toBe(true);
    expect(validateCustomAnswers(QUESTIONS, { c3: 'a'.repeat(CUSTOM_FREE_TEXT_MAX_LENGTH + 1) }).ok).toBe(false);
  });

  it('shares the Q27 length cap', () => {
    expect(CUSTOM_FREE_TEXT_MAX_LENGTH).toBe(1000);
  });

  it('collects every issue rather than stopping at the first', () => {
    const result = validateCustomAnswers(QUESTIONS, { c1: 'nope', c2: 'also nope', c9: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.key).sort()).toEqual(['c1', 'c2', 'c9']);
  });
});
