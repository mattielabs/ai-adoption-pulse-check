/**
 * Operational Pulse state for the admin surface.
 *
 * The invariant worth protecting: the admin label and the submission endpoint
 * must never disagree. Every case here cross-checks the derived state against
 * `computeAvailability`, which is what actually decides whether a response is
 * accepted.
 */

import { describe, expect, it } from 'vitest';
import { computeAvailability } from '../../src/core/pulse/availability.js';
import { computeOperationalState, isClosable } from '../../src/core/pulse/status.js';

const TODAY = '2026-08-19';

const open = (overrides: Partial<{ status: string; opensOn: string | null; closesOn: string | null }> = {}) => ({
  status: 'open',
  opensOn: null,
  closesOn: null,
  ...overrides,
});

describe('computeOperationalState', () => {
  it('reports an undated open Pulse as open', () => {
    expect(computeOperationalState(open(), TODAY)).toBe('open');
  });

  it('reports a Pulse opening in the future as upcoming', () => {
    expect(computeOperationalState(open({ opensOn: '2026-09-01' }), TODAY)).toBe('upcoming');
  });

  it('reports a Pulse opening today as open', () => {
    expect(computeOperationalState(open({ opensOn: TODAY }), TODAY)).toBe('open');
  });

  it('reports a Pulse closing today as still open - the closing date is inclusive', () => {
    expect(computeOperationalState(open({ closesOn: TODAY }), TODAY)).toBe('open');
  });

  it('distinguishes a passed closing date from an explicit close', () => {
    expect(computeOperationalState(open({ closesOn: '2026-08-18' }), TODAY)).toBe('collection_ended');
    expect(computeOperationalState(open({ status: 'closed' }), TODAY)).toBe('closed');
  });

  it('reports an explicit close even when the dates would still allow responses', () => {
    expect(
      computeOperationalState({ status: 'closed', opensOn: '2026-08-01', closesOn: '2026-12-31' }, TODAY),
    ).toBe('closed');
  });

  it('reports a draft row as not published', () => {
    expect(computeOperationalState(open({ status: 'draft' }), TODAY)).toBe('not_published');
  });

  it('never disagrees with the submission endpoint about whether responses are accepted', () => {
    const cases = [
      open(),
      open({ opensOn: '2026-09-01' }),
      open({ opensOn: TODAY }),
      open({ closesOn: TODAY }),
      open({ closesOn: '2026-08-18' }),
      open({ status: 'closed' }),
      open({ status: 'draft' }),
      open({ opensOn: '2026-08-01', closesOn: '2026-08-31' }),
    ];

    for (const input of cases) {
      const accepting = computeAvailability(input, TODAY) === 'available';
      expect(computeOperationalState(input, TODAY) === 'open').toBe(accepting);
    }
  });
});

describe('isClosable', () => {
  it('allows closing anything that is not already closed', () => {
    expect(isClosable('open')).toBe(true);
    expect(isClosable('upcoming')).toBe(true);
    expect(isClosable('collection_ended')).toBe(true);
    expect(isClosable('not_published')).toBe(true);
    expect(isClosable('closed')).toBe(false);
  });
});
