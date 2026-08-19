/**
 * Machine ids for custom-question choices.
 */

import { describe, expect, it } from 'vitest';
import { generateOptionIds, slugifyOptionLabel } from '../../src/core/admin/optionIds.js';

describe('slugifyOptionLabel', () => {
  it('lowercases and collapses separators', () => {
    expect(slugifyOptionLabel('Headquarters')).toBe('headquarters');
    expect(slugifyOptionLabel('Regional office')).toBe('regional_office');
    expect(slugifyOptionLabel('Sales / Business Development')).toBe('sales_business_development');
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyOptionLabel('  Remote!  ')).toBe('remote');
    expect(slugifyOptionLabel('--North--')).toBe('north');
  });

  it('produces an empty slug for label text with no alphanumerics', () => {
    expect(slugifyOptionLabel('***')).toBe('');
    expect(slugifyOptionLabel('🚀')).toBe('');
  });

  it('truncates without leaving a trailing separator', () => {
    const id = slugifyOptionLabel(`${'a'.repeat(38)} extra words here`);
    expect(id.length).toBeLessThanOrEqual(40);
    expect(id.endsWith('_')).toBe(false);
  });
});

describe('generateOptionIds', () => {
  it('keeps display text separate from the stored machine value', () => {
    expect(generateOptionIds(['Headquarters', 'Mostly remote'])).toEqual([
      { id: 'headquarters', label: 'Headquarters' },
      { id: 'mostly_remote', label: 'Mostly remote' },
    ]);
  });

  it('preserves order', () => {
    const ids = generateOptionIds(['Zebra', 'Apple', 'Mango']).map((o) => o.id);
    expect(ids).toEqual(['zebra', 'apple', 'mango']);
  });

  it('never emits duplicate machine values for labels that slugify the same', () => {
    const ids = generateOptionIds(['A/B', 'A-B', 'A B']).map((o) => o.id);
    expect(ids).toEqual(['a_b', 'a_b_2', 'a_b_3']);
    expect(new Set(ids).size).toBe(3);
  });

  it('falls back to a positional id when a label has no usable characters', () => {
    expect(generateOptionIds(['🚀', 'Real option'])).toEqual([
      { id: 'option_1', label: '🚀' },
      { id: 'real_option', label: 'Real option' },
    ]);
  });

  it('returns an empty list for no labels', () => {
    expect(generateOptionIds([])).toEqual([]);
  });

  it('is deterministic', () => {
    const labels = ['One', 'Two', 'One again'];
    expect(generateOptionIds(labels)).toEqual(generateOptionIds(labels));
  });
});
