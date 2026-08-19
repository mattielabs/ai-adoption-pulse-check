/**
 * Calendar-day values (`YYYY-MM-DD`).
 *
 * Pulse dates are calendar days, not instants. The moment a `YYYY-MM-DD`
 * string is passed through `new Date(...)` it becomes midnight UTC, and any
 * local-time formatting of that instant shifts the displayed day backwards for
 * every user west of Greenwich - which is exactly how a Pulse configured to
 * open on the 3rd starts showing "opens 2 August" to its administrator.
 *
 * So nothing here parses a day string into a Date. Days are validated by
 * arithmetic and formatted from their own components.
 */

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * True for a well-formed date that actually exists. `2026-02-30` matches the
 * shape but is not a day, and storing it would produce a Pulse that can never
 * open.
 */
export function isCalendarDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Human-readable form of a calendar day, e.g. "3 August 2026".
 *
 * Built from the string's own components - never from a parsed Date - so the
 * rendered day is identical in every timezone.
 */
export function formatCalendarDay(value: string): string {
  const match = DAY_PATTERN.exec(value);
  if (match === null) return value;

  const monthName = MONTH_NAMES[Number(match[2]) - 1];
  if (monthName === undefined) return value;

  return `${Number(match[3])} ${monthName} ${match[1]}`;
}

/** The calendar day of an instant in UTC. Used by the server. */
export function utcCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The calendar day of an instant in the LOCAL timezone. Used by the admin
 * form so "today" means the administrator's today, not UTC's.
 */
export function localCalendarDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Adds whole days to a calendar day without leaving day granularity. */
export function addDays(value: string, days: number): string {
  const match = DAY_PATTERN.exec(value);
  if (match === null) throw new Error(`Not a calendar day: ${value}`);

  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(utc + days * 86_400_000).toISOString().slice(0, 10);
}
