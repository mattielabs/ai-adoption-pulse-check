/**
 * Zod schemas for the admin API.
 *
 * The React admin screens are a convenience, not a validation boundary: every
 * rule here is enforced server-side on the parsed request body. The schemas
 * live in core so the client can reuse the same limits for inline feedback
 * without a second, drifting copy.
 *
 * Note what is deliberately NOT configurable: the 29 core survey items,
 * scoring weights, thresholds, dimension definitions, the privacy minimum, and
 * the version constants. Those are methodology (spec 68) and there is no admin
 * input path to any of them.
 */

import { z } from 'zod';
import { CUSTOM_QUESTION_TYPES } from '../survey/customQuestions.js';
import { MAX_CUSTOM_QUESTIONS } from '../survey/answers.js';
import { isCalendarDay } from '../pulse/day.js';

// --- limits ----------------------------------------------------------------

export const ORGANIZATION_NAME_MAX_LENGTH = 120;
export const LOGO_URL_MAX_LENGTH = 500;
export const SURVEY_INTRO_MAX_LENGTH = 2000;

export const PULSE_NAME_MAX_LENGTH = 120;
export const PULSE_DESCRIPTION_MAX_LENGTH = 1000;

export const CUSTOM_QUESTION_TEXT_MAX_LENGTH = 300;
export const CUSTOM_OPTION_LABEL_MAX_LENGTH = 120;
export const MIN_CUSTOM_OPTIONS = 2;
export const MAX_CUSTOM_OPTIONS = 10;

/**
 * Passcode input bounds, applied BEFORE the 600k-iteration derivation so an
 * absurd input cannot be used to burn Worker CPU. The minimum is a usability
 * floor for a deployment-level secret; it is not revealed on failure.
 */
export const ADMIN_PASSCODE_MIN_LENGTH = 10;
export const ADMIN_PASSCODE_MAX_LENGTH = 256;

/** Admin request bodies are small; the survey payload cap would be far too generous. */
export const MAX_ADMIN_PAYLOAD_BYTES = 16 * 1024;

// --- field helpers ---------------------------------------------------------

export const ACCENT_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Only http(s). Blocks `javascript:`, `data:`, and every other scheme. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Optional free text: trims, treats an empty string as "not set", and accepts
 * an absent value. HTML form fields submit `""` rather than null, so without
 * this an "empty" logo field would be stored as a blank string and later fail
 * URL validation on read.
 */
function nullableText(max: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value ?? null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().max(max).nullable(),
  );
}

const logoUrlField = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  },
  z
    .string()
    .max(LOGO_URL_MAX_LENGTH)
    .refine(isHttpUrl, { message: 'Enter an http:// or https:// URL' })
    .nullable(),
);

const accentColorField = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  },
  z
    .string()
    .regex(ACCENT_COLOR_PATTERN, { message: 'Use a #RRGGBB colour' })
    .nullable(),
);

const calendarDayField = z
  .string()
  .refine(isCalendarDay, { message: 'Use a real YYYY-MM-DD date' });

const nullableCalendarDayField = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  },
  calendarDayField.nullable(),
);

// --- authentication --------------------------------------------------------

export const adminLoginSchema = z.strictObject({
  passcode: z.string().min(ADMIN_PASSCODE_MIN_LENGTH).max(ADMIN_PASSCODE_MAX_LENGTH),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// --- organization ----------------------------------------------------------

const organizationFields = {
  name: z.string().trim().min(1).max(ORGANIZATION_NAME_MAX_LENGTH),
  logoUrl: logoUrlField,
  accentColor: accentColorField,
  surveyIntro: nullableText(SURVEY_INTRO_MAX_LENGTH),
};

/** First-run setup and settings edit both send the full editable field set. */
export const organizationInputSchema = z.strictObject(organizationFields);

export type OrganizationInput = z.infer<typeof organizationInputSchema>;

// --- custom questions ------------------------------------------------------

const customQuestionSchema = z
  .strictObject({
    type: z.enum(CUSTOM_QUESTION_TYPES),
    questionText: z.string().trim().min(1).max(CUSTOM_QUESTION_TEXT_MAX_LENGTH),
    /**
     * Display labels only. Stable machine ids are generated server-side
     * (optionIds.ts) so renaming a label later cannot change the meaning of
     * answers already collected.
     */
    optionLabels: z
      .array(z.string().trim().min(1).max(CUSTOM_OPTION_LABEL_MAX_LENGTH))
      .max(MAX_CUSTOM_OPTIONS)
      .default([]),
  })
  .superRefine((question, ctx) => {
    if (question.type === 'free_text') {
      if (question.optionLabels.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['optionLabels'],
          message: 'Free-text questions do not have options',
        });
      }
      return;
    }

    if (question.optionLabels.length < MIN_CUSTOM_OPTIONS) {
      ctx.addIssue({
        code: 'custom',
        path: ['optionLabels'],
        message: `Add at least ${MIN_CUSTOM_OPTIONS} options`,
      });
    }

    const seen = new Set(question.optionLabels.map((label) => label.toLowerCase()));
    if (seen.size !== question.optionLabels.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['optionLabels'],
        message: 'Options must be different from each other',
      });
    }
  });

export type CustomQuestionInput = z.infer<typeof customQuestionSchema>;

const customQuestionsField = z.array(customQuestionSchema).max(MAX_CUSTOM_QUESTIONS);

// --- pulses ----------------------------------------------------------------

function closesAfterOpens(
  value: { readonly opensOn?: string | undefined; readonly closesOn?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  const { opensOn, closesOn } = value;
  if (typeof opensOn === 'string' && typeof closesOn === 'string' && closesOn < opensOn) {
    ctx.addIssue({
      code: 'custom',
      path: ['closesOn'],
      message: 'The closing date cannot be before the opening date',
    });
  }
}

export const pulseCreateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(PULSE_NAME_MAX_LENGTH),
    description: nullableText(PULSE_DESCRIPTION_MAX_LENGTH),
    opensOn: calendarDayField,
    closesOn: nullableCalendarDayField,
    personalResultsEnabled: z.boolean().default(true),
    customQuestions: customQuestionsField.default([]),
  })
  .superRefine(closesAfterOpens);

export type PulseCreateInput = z.infer<typeof pulseCreateSchema>;

/**
 * Partial by design: an ABSENT key means "leave unchanged". That matters for
 * the post-response configuration lock, which refuses the request when a
 * locked key is present at all rather than trying to diff values.
 */
export const pulseUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(PULSE_NAME_MAX_LENGTH).optional(),
    description: nullableText(PULSE_DESCRIPTION_MAX_LENGTH).optional(),
    opensOn: calendarDayField.optional(),
    closesOn: nullableCalendarDayField.optional(),
    personalResultsEnabled: z.boolean().optional(),
    customQuestions: customQuestionsField.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
  .superRefine(closesAfterOpens);

export type PulseUpdateInput = z.infer<typeof pulseUpdateSchema>;
