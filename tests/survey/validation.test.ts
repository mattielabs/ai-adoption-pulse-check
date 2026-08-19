import { describe, expect, it } from 'vitest';
import {
  isWithinPayloadLimit,
  validateAnswers,
  validateResponseSubmission,
} from '../../src/core/survey/validation.js';
import { MAX_RESPONSE_PAYLOAD_BYTES } from '../../src/core/survey/answers.js';
import { SURVEY_VERSION } from '../../src/core/versions.js';
import { answers, answersWithout } from '../helpers.js';

describe('survey validation', () => {
  it('accepts a complete valid response', () => {
    expect(validateAnswers(answers()).ok).toBe(true);
  });

  it('accepts a response omitting the optional questions', () => {
    const result = validateAnswers(answersWithout(['q1', 'q2', 'q3', 'q27']));
    expect(result.ok).toBe(true);
  });

  it('rejects a response missing a required question', () => {
    const result = validateAnswers(answersWithout(['q5']));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.path === 'q5')).toBe(true);
  });

  it('rejects an unknown option id', () => {
    const result = validateAnswers({ ...answers(), q5: 'weekly_ish' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown question id rather than silently dropping it', () => {
    const result = validateAnswers({ ...answers(), q99: 'anything' });
    expect(result.ok).toBe(false);
  });

  describe('max selections', () => {
    it('accepts exactly three Q23 selections', () => {
      const result = validateAnswers(
        answers({ q23: ['not_enough_time', 'accuracy_concern', 'policies_unclear'] }),
      );
      expect(result.ok).toBe(true);
    });

    it('rejects four Q23 selections', () => {
      const result = validateAnswers(
        answers({
          q23: ['not_enough_time', 'accuracy_concern', 'policies_unclear', 'no_need'],
        }),
      );
      expect(result.ok).toBe(false);
    });

    it('accepts exactly two Q25 selections and rejects three', () => {
      expect(validateAnswers(answers({ q25: ['short_tutorials', 'live_workshops'] })).ok).toBe(true);
      expect(
        validateAnswers(answers({ q25: ['short_tutorials', 'live_workshops', 'short_videos'] })).ok,
      ).toBe(false);
    });

    it('rejects duplicate selections', () => {
      expect(validateAnswers(answers({ q23: ['not_enough_time', 'not_enough_time'] })).ok).toBe(false);
    });

    it('rejects an empty required multi-select', () => {
      expect(validateAnswers(answers({ q7: [] })).ok).toBe(false);
    });
  });

  describe('Q19b', () => {
    it('is required', () => {
      expect(validateAnswers(answersWithout(['q19b'])).ok).toBe(false);
    });

    it('accepts every defined option', () => {
      for (const option of ['never', 'rarely', 'sometimes', 'often', 'no_org_provided_access', 'prefer_not_to_say'] as const) {
        expect(validateAnswers(answers({ q19b: option })).ok, option).toBe(true);
      }
    });
  });

  describe('free text', () => {
    it('accepts 1000 characters', () => {
      expect(validateAnswers(answers({ q27: 'a'.repeat(1000) })).ok).toBe(true);
    });

    it('rejects 1001 characters', () => {
      expect(validateAnswers(answers({ q27: 'a'.repeat(1001) })).ok).toBe(false);
    });
  });

  describe('submission envelope', () => {
    it('accepts a supported survey version', () => {
      const result = validateResponseSubmission({ surveyVersion: SURVEY_VERSION, answers: answers() });
      expect(result.ok).toBe(true);
    });

    it('rejects an unsupported survey version', () => {
      const result = validateResponseSubmission({ surveyVersion: '9.9.9', answers: answers() });
      expect(result.ok).toBe(false);
    });

    it('rejects more than three custom answers', () => {
      const result = validateResponseSubmission({
        surveyVersion: SURVEY_VERSION,
        answers: answers(),
        customAnswers: { c1: 'a', c2: 'b', c3: 'c', c4: 'd' },
      });
      expect(result.ok).toBe(false);
    });

    it('accepts three custom answers', () => {
      const result = validateResponseSubmission({
        surveyVersion: SURVEY_VERSION,
        answers: answers(),
        customAnswers: { c1: 'a', c2: ['b'], c3: 'c' },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('payload size cap', () => {
    it('accepts a body at the limit', () => {
      expect(isWithinPayloadLimit('x'.repeat(MAX_RESPONSE_PAYLOAD_BYTES))).toBe(true);
    });

    it('rejects a body one byte over the limit', () => {
      expect(isWithinPayloadLimit('x'.repeat(MAX_RESPONSE_PAYLOAD_BYTES + 1))).toBe(false);
    });

    it('measures bytes rather than characters', () => {
      // Multi-byte characters must count against the cap at their real size.
      const halfLimit = Math.floor(MAX_RESPONSE_PAYLOAD_BYTES / 2);
      expect(isWithinPayloadLimit('é'.repeat(halfLimit + 1))).toBe(false);
    });
  });
});
