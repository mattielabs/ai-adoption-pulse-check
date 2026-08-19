/**
 * Pulse availability.
 *
 * Whether a Pulse accepts responses is decided on the SERVER from this pure
 * function - never from client state, because an employee may be holding an
 * old loaded page when a Pulse closes. Spec 9 (Phase 1 brief), 49.
 *
 * Date semantics (all dates are day-granularity YYYY-MM-DD, compared as
 * strings, evaluated against the server's UTC date):
 *   - a Pulse is open ON its opens_on date (inclusive);
 *   - a Pulse accepts responses THROUGH its closes_on date (inclusive) -
 *     closes_on is the last day of collection, not the first closed day;
 *   - an explicit `closed` status wins over any date;
 *   - a `draft` Pulse is not publicly visible at all, so it is reported as
 *     not_found rather than "not yet open" - publishing state is not public
 *     information.
 */

export const PULSE_STATUSES = ['draft', 'open', 'closed'] as const;
export type PulseStatus = (typeof PULSE_STATUSES)[number];

export type PulseAvailability = 'available' | 'not_yet_open' | 'closed' | 'not_found';

export interface AvailabilityInput {
  readonly status: string;
  /** YYYY-MM-DD or null. */
  readonly opensOn: string | null;
  /** YYYY-MM-DD or null. Last day responses are accepted. */
  readonly closesOn: string | null;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDayGranularDate(value: string): boolean {
  return DAY_PATTERN.test(value);
}

export function computeAvailability(input: AvailabilityInput, todayIso: string): PulseAvailability {
  if (!isDayGranularDate(todayIso)) {
    throw new Error(`todayIso must be a YYYY-MM-DD date, got: ${todayIso}`);
  }

  if (input.status === 'draft') return 'not_found';
  if (input.status === 'closed') return 'closed';
  if (input.status !== 'open') return 'not_found';

  // ISO dates compare correctly as strings, so no Date parsing (and no
  // timezone ambiguity) is introduced here.
  if (input.opensOn !== null && todayIso < input.opensOn) return 'not_yet_open';
  if (input.closesOn !== null && todayIso > input.closesOn) return 'closed';
  return 'available';
}
