/**
 * Operational Pulse state for the ADMIN surface.
 *
 * The database `status` column and the date-derived availability are related
 * but not identical, and conflating them is how a management screen ends up
 * disagreeing with the submission endpoint. So:
 *
 *   - `computeAvailability` (availability.ts) stays the single authority for
 *     "may this response be accepted right now"; it is what the public API
 *     uses and it is derived here rather than re-implemented;
 *   - this function adds only the operational vocabulary an administrator
 *     needs, distinguishing "the closing date passed" from "someone pressed
 *     Close".
 *
 * There is deliberately no second status engine in React: the client renders
 * whatever the server derived here.
 */

import { computeAvailability, type AvailabilityInput } from './availability.js';

export type PulseOperationalState =
  /** status = draft. Phase 2 never creates these; seeded/legacy rows only. */
  | 'not_published'
  /** Scheduled, opens_on is still in the future. */
  | 'upcoming'
  /** Accepting responses right now. */
  | 'open'
  /** Explicitly closed by an administrator. Irreversible in V1. */
  | 'closed'
  /** Still status = open, but closes_on has passed. */
  | 'collection_ended';

export function computeOperationalState(
  input: AvailabilityInput,
  todayIso: string,
): PulseOperationalState {
  if (input.status === 'draft') return 'not_published';
  if (input.status === 'closed') return 'closed';

  switch (computeAvailability(input, todayIso)) {
    case 'available':
      return 'open';
    case 'not_yet_open':
      return 'upcoming';
    case 'closed':
      return 'collection_ended';
    case 'not_found':
      // Unreachable: draft and closed are handled above and every other
      // status value is rejected at the write boundary.
      return 'not_published';
  }
}

/** True while the Pulse can still be closed by an administrator. */
export function isClosable(state: PulseOperationalState): boolean {
  return state !== 'closed';
}
