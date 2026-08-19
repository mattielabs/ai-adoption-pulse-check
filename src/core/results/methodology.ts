/**
 * The methodology copy the dashboard shows beside its numbers.
 *
 * It lives in core, next to the engine, for one reason: a score means what the
 * methodology says it means, and if the explanation lived in a React component
 * it would drift from the thing it explains. The wording is taken from V1.1
 * sections 11, 14 and 16.
 *
 * Note what these strings deliberately never say: skill, capability,
 * competence, verified, certified, compliant, ready. Confidence is
 * self-reported confidence. Safety is self-reported behaviour and awareness.
 * Enablement is the employee's experience of organizational support, not a
 * judgement of the employee.
 */

import type { Dimension } from '../survey/questions.js';

export const DIMENSION_LABELS: Readonly<Record<Dimension, string>> = {
  adoption: 'Adoption',
  confidence: 'Confidence',
  workflow: 'Workflow',
  safety: 'Safety',
  enablement: 'Enablement',
};

/** What each dimension actually measures. Spec 11. */
export const DIMENSION_MEANINGS: Readonly<Record<Dimension, string>> = {
  adoption: 'Self-reported frequency and breadth of work-related AI use.',
  confidence: 'Self-reported confidence using and evaluating AI.',
  workflow: 'Self-reported movement from isolated AI use toward repeatable processes.',
  safety: 'Self-reported verification, review, and data-handling awareness.',
  enablement: 'Employee-reported organizational clarity, tool access, and training.',
};

/** What each dimension does NOT measure. Shown alongside, not buried in docs. */
export const DIMENSION_LIMITS: Readonly<Record<Dimension, string | null>> = {
  adoption: 'Breadth of tools is not treated as maturity.',
  confidence: 'This is confidence, not demonstrated skill. Nothing here was tested.',
  workflow: null,
  safety: null,
  enablement: 'This describes the support employees experienced, not employee performance.',
};

/**
 * Safety is interpreted asymmetrically on purpose, and the caveat travels with
 * the score rather than living only in documentation. Spec 16.
 */
export const SAFETY_CAVEAT =
  'A low Safety score is a meaningful warning signal. A high score does not prove safe ' +
  'behaviour, because these responses are self-reported.';

/** Why there is no single number. Spec 5.3. */
export const NO_SINGLE_SCORE_NOTE =
  'There is deliberately no single maturity score. One average would hide the differences ' +
  'this survey exists to surface, such as high Adoption alongside low Safety.';

export const SELF_REPORT_NOTE =
  'All figures are directional self-report from a short survey, not an audit.';

/** Shown while a Pulse is between 5 and 9 responses. Spec 32. */
export const EARLY_DIRECTIONAL_NOTE = 'Early directional results - interpret cautiously.';

export const FREE_TEXT_PRIVACY_WARNING =
  'Written responses may contain identifying information voluntarily provided by employees. ' +
  'These responses are intentionally separated from demographic filters and other respondent ' +
  'context.';

export const SEGMENTATION_PRIVACY_NOTE =
  'Small groups are hidden to reduce the risk of identifying individual respondents.';

/** Labels for the three permitted segmentation dimensions. Spec 33. */
export const SEGMENTATION_DIMENSION_LABELS = {
  department: 'Department',
  role_level: 'Role level',
  work_type: 'Work type',
} as const;
