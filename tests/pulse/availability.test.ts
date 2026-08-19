import { describe, expect, it } from 'vitest';
import { computeAvailability, isDayGranularDate } from '../../src/core/pulse/availability.js';

const TODAY = '2026-08-18';

function availability(input: { status: string; opensOn?: string | null; closesOn?: string | null }) {
  return computeAvailability(
    { status: input.status, opensOn: input.opensOn ?? null, closesOn: input.closesOn ?? null },
    TODAY,
  );
}

describe('pulse availability', () => {
  it('reports an open pulse with no dates as available', () => {
    expect(availability({ status: 'open' })).toBe('available');
  });

  it('reports a draft pulse as not_found, never as "not yet open"', () => {
    // Publishing state is not public information.
    expect(availability({ status: 'draft' })).toBe('not_found');
    expect(availability({ status: 'draft', opensOn: '2099-01-01' })).toBe('not_found');
  });

  it('reports an unknown status as not_found rather than guessing', () => {
    expect(availability({ status: 'archived' })).toBe('not_found');
  });

  it('lets an explicit closed status win over any date', () => {
    expect(availability({ status: 'closed', opensOn: '2000-01-01', closesOn: '2099-01-01' })).toBe('closed');
  });

  describe('opens_on', () => {
    it('is not yet open the day before opens_on', () => {
      expect(availability({ status: 'open', opensOn: '2026-08-19' })).toBe('not_yet_open');
    });

    it('is available ON opens_on (inclusive)', () => {
      expect(availability({ status: 'open', opensOn: '2026-08-18' })).toBe('available');
    });

    it('is available after opens_on', () => {
      expect(availability({ status: 'open', opensOn: '2026-08-17' })).toBe('available');
    });
  });

  describe('closes_on', () => {
    it('is available ON closes_on - the last day of collection is inclusive', () => {
      expect(availability({ status: 'open', closesOn: '2026-08-18' })).toBe('available');
    });

    it('is closed the day after closes_on', () => {
      expect(availability({ status: 'open', closesOn: '2026-08-17' })).toBe('closed');
    });
  });

  it('handles an open window spanning today', () => {
    expect(availability({ status: 'open', opensOn: '2026-08-01', closesOn: '2026-08-31' })).toBe('available');
  });

  it('reports not_yet_open before a fully future window', () => {
    expect(availability({ status: 'open', opensOn: '2026-09-01', closesOn: '2026-09-30' })).toBe('not_yet_open');
  });

  it('rejects a non-day-granular today rather than comparing garbage', () => {
    expect(() =>
      computeAvailability({ status: 'open', opensOn: null, closesOn: null }, '2026-08-18T10:00:00Z'),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('validates day-granular dates', () => {
    expect(isDayGranularDate('2026-08-18')).toBe(true);
    expect(isDayGranularDate('2026-8-18')).toBe(false);
    expect(isDayGranularDate('2026-08-18T00:00:00Z')).toBe(false);
  });
});
