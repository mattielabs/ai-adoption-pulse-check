/**
 * Calendar-day handling.
 *
 * The timezone tests are the point of this file: a Pulse configured to open on
 * the 3rd must read "3 August" to every administrator, and no code path may
 * turn a day string into an instant and back.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  formatCalendarDay,
  isCalendarDay,
  localCalendarDay,
  utcCalendarDay,
} from '../../src/core/pulse/day.js';

describe('isCalendarDay', () => {
  it('accepts real days', () => {
    expect(isCalendarDay('2026-08-19')).toBe(true);
    expect(isCalendarDay('2026-01-01')).toBe(true);
    expect(isCalendarDay('2026-12-31')).toBe(true);
  });

  it('accepts 29 February in a leap year and rejects it otherwise', () => {
    expect(isCalendarDay('2024-02-29')).toBe(true);
    expect(isCalendarDay('2000-02-29')).toBe(true);
    expect(isCalendarDay('2026-02-29')).toBe(false);
    expect(isCalendarDay('1900-02-29')).toBe(false);
  });

  it('rejects days that do not exist', () => {
    expect(isCalendarDay('2026-02-30')).toBe(false);
    expect(isCalendarDay('2026-04-31')).toBe(false);
    expect(isCalendarDay('2026-13-01')).toBe(false);
    expect(isCalendarDay('2026-00-10')).toBe(false);
    expect(isCalendarDay('2026-01-00')).toBe(false);
  });

  it('rejects anything that is not a bare day string', () => {
    expect(isCalendarDay('2026-8-19')).toBe(false);
    expect(isCalendarDay('2026-08-19T00:00:00Z')).toBe(false);
    expect(isCalendarDay('19/08/2026')).toBe(false);
    expect(isCalendarDay('')).toBe(false);
  });
});

describe('formatCalendarDay', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the same in every timezone', () => {
    // A naive `new Date('2026-08-03').toLocaleDateString()` renders as
    // 2 August anywhere west of UTC. This must not.
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Tokyo']) {
      vi.stubEnv('TZ', tz);
      expect(formatCalendarDay('2026-08-03')).toBe('3 August 2026');
    }
  });

  it('does not pad the day number', () => {
    expect(formatCalendarDay('2026-01-09')).toBe('9 January 2026');
  });

  it('returns the input unchanged when it is not a day string', () => {
    expect(formatCalendarDay('soon')).toBe('soon');
  });
});

describe('utcCalendarDay and localCalendarDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('utcCalendarDay uses the UTC day, matching the server availability rule', () => {
    expect(utcCalendarDay(new Date('2026-08-19T23:30:00Z'))).toBe('2026-08-19');
    expect(utcCalendarDay(new Date('2026-08-20T00:30:00Z'))).toBe('2026-08-20');
  });

  it('localCalendarDay uses the local day, so the form defaults to the admin today', () => {
    const date = new Date(2026, 0, 5, 23, 30);
    expect(localCalendarDay(date)).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(localCalendarDay(new Date(2026, 8, 7, 12))).toBe('2026-09-07');
  });
});

describe('addDays', () => {
  it('moves forward and backward across month and year boundaries', () => {
    expect(addDays('2026-08-19', 1)).toBe('2026-08-20');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('rejects a non-day input rather than guessing', () => {
    expect(() => addDays('tomorrow', 1)).toThrow();
  });
});
