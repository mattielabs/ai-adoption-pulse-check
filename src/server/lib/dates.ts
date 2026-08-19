/**
 * Server date handling.
 *
 * The application stores submission time at DAY granularity only, evaluated
 * in UTC. Exact times are deliberately never stored - they would recreate the
 * timing-correlation risk the schema removed. Spec 34.3.
 *
 * UTC is used (rather than any local zone) so the stored day does not depend
 * on where the Worker happens to execute. Availability windows are compared
 * against the same UTC day, and that choice is documented for admins.
 */

export function todayUtcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
