/**
 * Organization-specific (custom) questions.
 *
 * Up to three per Pulse, configured by the admin (Phase 2 UI; seeded fixtures
 * until then). They NEVER participate in scoring, classification, or the
 * personal-result rules - they are extra context for the organization only.
 * Spec 19 (Phase 1 brief), 40.
 *
 * Custom answers are keyed by POSITION (`c1`..`c3`), not by database row id,
 * so the public payload never carries an internal identifier and the stored
 * answer keys stay stable if rows are ever re-created in the same order.
 */

export const CUSTOM_QUESTION_TYPES = ['single_select', 'multi_select', 'free_text'] as const;
export type CustomQuestionType = (typeof CUSTOM_QUESTION_TYPES)[number];

export interface CustomQuestionOption {
  readonly id: string;
  readonly label: string;
}

/** The shape of a custom question as exposed by the public Pulse API. */
export interface PublicCustomQuestion {
  /** Position-based key: c1, c2 or c3. This is the key custom answers use. */
  readonly key: string;
  readonly type: CustomQuestionType;
  readonly questionText: string;
  /** Present for select types, null for free text. */
  readonly options: readonly CustomQuestionOption[] | null;
}

/** Free-text custom answers share the Q27 cap. Spec 59. */
export const CUSTOM_FREE_TEXT_MAX_LENGTH = 1000;

export function customQuestionKey(position: number): string {
  return `c${position}`;
}

export function isCustomQuestionType(value: string): value is CustomQuestionType {
  return (CUSTOM_QUESTION_TYPES as readonly string[]).includes(value);
}

export interface CustomAnswerIssue {
  readonly key: string;
  readonly message: string;
}

export type CustomAnswerValidation =
  | { readonly ok: true; readonly value: Readonly<Record<string, string | readonly string[]>> }
  | { readonly ok: false; readonly issues: readonly CustomAnswerIssue[] };

/**
 * Validates submitted custom answers against the Pulse's configured questions.
 *
 * All custom questions are OPTIONAL - an absent key is always valid. What is
 * rejected: answers for keys the Pulse never configured, values whose shape
 * does not match the question type, selections outside the configured options,
 * duplicate selections, and over-long free text.
 */
export function validateCustomAnswers(
  questions: readonly PublicCustomQuestion[],
  answers: Readonly<Record<string, string | readonly string[]>> | undefined,
): CustomAnswerValidation {
  if (answers === undefined) return { ok: true, value: {} };

  const byKey = new Map(questions.map((q) => [q.key, q]));
  const issues: CustomAnswerIssue[] = [];
  const value: Record<string, string | readonly string[]> = {};

  for (const [key, answer] of Object.entries(answers)) {
    const question = byKey.get(key);
    if (!question) {
      issues.push({ key, message: 'Unknown custom question' });
      continue;
    }

    switch (question.type) {
      case 'single_select': {
        if (typeof answer !== 'string') {
          issues.push({ key, message: 'Expected a single selection' });
          break;
        }
        if (!(question.options ?? []).some((o) => o.id === answer)) {
          issues.push({ key, message: 'Unknown option' });
          break;
        }
        value[key] = answer;
        break;
      }

      case 'multi_select': {
        if (!Array.isArray(answer)) {
          issues.push({ key, message: 'Expected a list of selections' });
          break;
        }
        const ids = new Set((question.options ?? []).map((o) => o.id));
        if (new Set(answer).size !== answer.length) {
          issues.push({ key, message: 'Duplicate selections are not allowed' });
          break;
        }
        if (answer.length === 0 || !answer.every((v) => typeof v === 'string' && ids.has(v))) {
          issues.push({ key, message: 'Unknown option' });
          break;
        }
        value[key] = answer;
        break;
      }

      case 'free_text': {
        if (typeof answer !== 'string') {
          issues.push({ key, message: 'Expected text' });
          break;
        }
        if (answer.length > CUSTOM_FREE_TEXT_MAX_LENGTH) {
          issues.push({ key, message: `At most ${CUSTOM_FREE_TEXT_MAX_LENGTH} characters` });
          break;
        }
        value[key] = answer;
        break;
      }

      default: {
        const exhaustive: never = question.type;
        throw new Error(`Unhandled custom question type: ${String(exhaustive)}`);
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
