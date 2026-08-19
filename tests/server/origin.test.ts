/**
 * Cross-origin mutation protection.
 */

import { describe, expect, it } from 'vitest';
import { checkRequestOrigin, isMutatingMethod } from '../../src/server/lib/origin.js';

const DEPLOYED = 'https://pulse.example.org/api/admin/pulses';

describe('checkRequestOrigin', () => {
  it('allows a same-origin request', () => {
    expect(checkRequestOrigin(DEPLOYED, 'https://pulse.example.org')).toBe('allowed');
  });

  it('rejects a clearly cross-origin request', () => {
    expect(checkRequestOrigin(DEPLOYED, 'https://attacker.example.com')).toBe('rejected');
  });

  it('rejects a look-alike host', () => {
    expect(checkRequestOrigin(DEPLOYED, 'https://pulse.example.org.attacker.com')).toBe('rejected');
  });

  it('rejects the same host on a different scheme or port', () => {
    expect(checkRequestOrigin(DEPLOYED, 'http://pulse.example.org')).toBe('rejected');
    expect(checkRequestOrigin(DEPLOYED, 'https://pulse.example.org:8443')).toBe('rejected');
  });

  it('rejects a malformed Origin header', () => {
    expect(checkRequestOrigin(DEPLOYED, 'not a url')).toBe('rejected');
  });

  it('allows a request with no Origin header - a non-browser client has no ambient cookie', () => {
    expect(checkRequestOrigin(DEPLOYED, null)).toBe('allowed');
    expect(checkRequestOrigin(DEPLOYED, '')).toBe('allowed');
  });

  describe('local development', () => {
    it('allows the Vite proxy origin when the request itself is on loopback', () => {
      expect(checkRequestOrigin('http://127.0.0.1:8787/api/admin/pulses', 'http://localhost:5173')).toBe(
        'allowed',
      );
    });

    it('does NOT extend that relaxation to a deployed host', () => {
      expect(checkRequestOrigin(DEPLOYED, 'http://localhost:5173')).toBe('rejected');
    });

    it('does not accept an external origin just because the request is local', () => {
      expect(
        checkRequestOrigin('http://127.0.0.1:8787/api/admin/pulses', 'https://attacker.example.com'),
      ).toBe('rejected');
    });
  });
});

describe('isMutatingMethod', () => {
  it('treats reads as non-mutating', () => {
    expect(isMutatingMethod('GET')).toBe(false);
    expect(isMutatingMethod('HEAD')).toBe(false);
    expect(isMutatingMethod('OPTIONS')).toBe(false);
  });

  it('treats writes as mutating', () => {
    expect(isMutatingMethod('POST')).toBe(true);
    expect(isMutatingMethod('PATCH')).toBe(true);
    expect(isMutatingMethod('DELETE')).toBe(true);
    expect(isMutatingMethod('PUT')).toBe(true);
  });
});
