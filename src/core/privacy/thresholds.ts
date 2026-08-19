/**
 * Privacy thresholds.
 *
 * Privacy logic is core business logic, not a display concern. These values
 * are enforced on the server before data leaves it - a small segment must
 * never be sent to the browser and merely hidden visually. Spec 5.6, 33.
 */

/** Minimum size for BOTH a reported segment and its complement. Spec 33. */
export const MIN_REPORTING_GROUP = 5;

/** Minimum responses before any organization-level result is produced. Spec 32. */
export const MIN_ORGANIZATION_RESPONSES = 5;

/**
 * V1 permits exactly ONE filter dimension at a time. Stacked demographic
 * filters were removed because combining two of these on a 30-person
 * organization reliably produces identifiable groups. Spec 33, 71.
 */
export const SEGMENTATION_DIMENSIONS = ['department', 'role_level', 'work_type'] as const;
export type SegmentationDimension = (typeof SEGMENTATION_DIMENSIONS)[number];

export const MAX_ACTIVE_SEGMENTATION_DIMENSIONS = 1;

/** Which optional work-context question backs each segmentation dimension. */
export const SEGMENTATION_QUESTION_BY_DIMENSION = {
  department: 'q1',
  role_level: 'q2',
  work_type: 'q3',
} as const;

export type SuppressionReason =
  | 'minimum_group_or_complement_size'
  | 'multiple_segmentation_dimensions'
  | 'unknown_segmentation_dimension'
  | 'insufficient_total_responses';

export function isSegmentationDimension(value: string): value is SegmentationDimension {
  return (SEGMENTATION_DIMENSIONS as readonly string[]).includes(value);
}
