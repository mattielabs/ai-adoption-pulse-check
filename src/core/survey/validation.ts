/**
 * Zod validation for survey responses.
 *
 * The schema is *derived from* the survey definition rather than restated, so
 * there is exactly one place where question ids, option ids, required-ness and
 * max-selection limits are declared. Adding a question to `questions.ts`
 * automatically tightens validation here.
 *
 * Spec 42 (submission flow), 59 (security floor).
 */

import { z } from 'zod';
import { SURVEY_QUESTIONS, type SurveyQuestion } from './questions.js';
import {
  MAX_CUSTOM_QUESTIONS,
  MAX_RESPONSE_PAYLOAD_BYTES,
  type SurveyAnswers,
} from './answers.js';
import { SURVEY_VERSION, isSupportedSurveyVersion } from '../versions.js';

type EnumValues = [string, ...string[]];

function optionEnum(question: SurveyQuestion): z.ZodEnum<Record<string, string>> {
  if (question.type === 'free_text') {
    throw new Error(`optionEnum called on free-text question ${question.id}`);
  }
  const ids = question.options.map((o) => o.id) as EnumValues;
  return z.enum(ids);
}

function schemaForQuestion(question: SurveyQuestion): z.ZodTypeAny {
  switch (question.type) {
    case 'single_select':
      return optionEnum(question);

    case 'multi_select': {
      let arr = z
        .array(optionEnum(question))
        .refine((values) => new Set(values).size === values.length, {
          message: 'Duplicate selections are not allowed',
        });
      if (question.maxSelections !== null) {
        arr = arr.max(question.maxSelections, {
          message: `Select at most ${question.maxSelections}`,
        }) as unknown as typeof arr;
      }
      // A required multi-select must carry at least one selection. Every
      // multi-select in the V1.1 survey has an explicit "none" option, so an
      // empty array always means an incomplete answer rather than a real one.
      return question.required
        ? arr.min(1, { message: 'Select at least one option' })
        : arr;
    }

    case 'free_text':
      return z.string().max(question.maxLength);

    default: {
      const exhaustive: never = question;
      throw new Error(`Unhandled question type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function buildAnswersSchema(): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const question of SURVEY_QUESTIONS) {
    const base = schemaForQuestion(question);
    shape[question.id] = question.required ? base : base.optional();
  }
  // `strict` rejects unknown question ids so schema drift surfaces immediately
  // rather than being silently stripped and stored.
  return z.strictObject(shape);
}

/** Validates a complete set of core survey answers. */
export const answersSchema = buildAnswersSchema();

/**
 * Organization-specific questions never affect scoring, so they are validated
 * only for shape and size.
 */
export const customAnswersSchema = z
  .record(z.string().min(1).max(64), z.union([z.string().max(1000), z.array(z.string().max(200)).max(50)]))
  .refine((rec) => Object.keys(rec).length <= MAX_CUSTOM_QUESTIONS, {
    message: `At most ${MAX_CUSTOM_QUESTIONS} custom questions are supported`,
  });

/** The body accepted by `POST /api/pulses/:publicId/responses`. */
export const responseSubmissionSchema = z.strictObject({
  surveyVersion: z
    .string()
    .max(32)
    .refine(isSupportedSurveyVersion, { message: 'Unsupported survey version' }),
  answers: answersSchema,
  customAnswers: customAnswersSchema.optional(),
});

export type ResponseSubmission = z.infer<typeof responseSubmissionSchema>;

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

function toIssues(error: z.ZodError): readonly ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/** Validate a submitted response payload. Never throws. */
export function validateResponseSubmission(input: unknown): ValidationResult<ResponseSubmission> {
  const parsed = responseSubmissionSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, issues: toIssues(parsed.error) };
}

/** Validate answers alone, e.g. when scoring a fixture or a local personal result. */
export function validateAnswers(input: unknown): ValidationResult<SurveyAnswers> {
  const parsed = answersSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data as SurveyAnswers }
    : { ok: false, issues: toIssues(parsed.error) };
}

/**
 * Reject oversized payloads before parsing them. This is a cheap denial-of-service
 * and accidental-data-dump guard, not a substitute for schema validation.
 */
export function isWithinPayloadLimit(rawBody: string): boolean {
  return new TextEncoder().encode(rawBody).byteLength <= MAX_RESPONSE_PAYLOAD_BYTES;
}

export { MAX_RESPONSE_PAYLOAD_BYTES, SURVEY_VERSION };
