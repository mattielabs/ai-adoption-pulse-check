/**
 * Public Pulse identifier generation.
 *
 * The property that matters is unguessability, so these tests check the
 * entropy SOURCE and encoding rather than trying to measure randomness from a
 * sample.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  generatePublicId,
  isGeneratedPublicId,
  PUBLIC_ID_ENTROPY_BYTES,
  PUBLIC_ID_LENGTH,
} from '../../src/server/lib/publicId.js';
import { fromBase64Url } from '../../src/server/lib/encoding.js';

describe('generatePublicId', () => {
  it('encodes at least 128 bits of entropy', () => {
    expect(PUBLIC_ID_ENTROPY_BYTES * 8).toBeGreaterThanOrEqual(128);
    expect(fromBase64Url(generatePublicId())?.byteLength).toBe(PUBLIC_ID_ENTROPY_BYTES);
  });

  it('is URL-safe and fixed length', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = generatePublicId();
      expect(id).toHaveLength(PUBLIC_ID_LENGTH);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(id)).toBe(id);
    }
  });

  it('draws from the cryptographic random source, not Math.random or the clock', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    const mathRandom = vi.spyOn(Math, 'random');
    const dateNow = vi.spyOn(Date, 'now');

    generatePublicId();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(dateNow).not.toHaveBeenCalled();

    getRandomValues.mockRestore();
    mathRandom.mockRestore();
    dateNow.mockRestore();
  });

  it('does not repeat across a large sample', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generatePublicId()));
    expect(ids.size).toBe(2000);
  });
});

describe('isGeneratedPublicId', () => {
  it('accepts a generated id', () => {
    expect(isGeneratedPublicId(generatePublicId())).toBe(true);
  });

  it('rejects the fixed development seed ids', () => {
    expect(isGeneratedPublicId('dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c')).toBe(false);
  });

  it('rejects guessable shapes', () => {
    expect(isGeneratedPublicId('1')).toBe(false);
    expect(isGeneratedPublicId('acme-q3-pulse')).toBe(false);
    expect(isGeneratedPublicId('')).toBe(false);
  });
});
