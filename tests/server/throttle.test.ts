/**
 * Login throttling adapter.
 *
 * The real limiter is a remote Cloudflare binding that local development
 * cannot service, which is exactly why the code depends on an interface. These
 * tests drive that interface with a fake and assert the behaviour the security
 * story relies on - including the deliberate fail-open.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  cloudflareLoginThrottle,
  loginThrottleKey,
  openLoginThrottle,
  type RateLimitBinding,
} from '../../src/server/lib/throttle.js';

function fakeLimiter(limit: number): RateLimitBinding & { readonly calls: string[] } {
  const counts = new Map<string, number>();
  const calls: string[] = [];

  return {
    calls,
    limit({ key }) {
      calls.push(key);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return Promise.resolve({ success: next <= limit });
    },
  };
}

describe('cloudflareLoginThrottle', () => {
  it('allows attempts within the budget and refuses beyond it', async () => {
    const throttle = cloudflareLoginThrottle(fakeLimiter(3));

    expect(await throttle.consume('login:abc')).toBe(true);
    expect(await throttle.consume('login:abc')).toBe(true);
    expect(await throttle.consume('login:abc')).toBe(true);
    expect(await throttle.consume('login:abc')).toBe(false);
  });

  it('budgets each key separately', async () => {
    const throttle = cloudflareLoginThrottle(fakeLimiter(1));

    expect(await throttle.consume('login:one')).toBe(true);
    expect(await throttle.consume('login:two')).toBe(true);
    expect(await throttle.consume('login:one')).toBe(false);
  });

  it('passes the derived key straight through to the binding', async () => {
    const limiter = fakeLimiter(5);
    await cloudflareLoginThrottle(limiter).consume('login:derived');
    expect(limiter.calls).toEqual(['login:derived']);
  });

  it('fails open and reports once when the binding throws', async () => {
    const onUnavailable = vi.fn();
    const broken: RateLimitBinding = {
      limit: () => Promise.reject(new Error('internal error')),
    };

    const throttle = cloudflareLoginThrottle(broken, onUnavailable);

    // Locking the only administrator out of a self-hosted deployment because
    // a rate limiter is unavailable would be worse than the missed throttle.
    expect(await throttle.consume('login:abc')).toBe(true);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe('openLoginThrottle', () => {
  it('always allows - used when no limiter binding is configured', async () => {
    expect(await openLoginThrottle.consume('anything')).toBe(true);
  });
});

describe('loginThrottleKey', () => {
  it('never contains the client address', async () => {
    const key = await loginThrottleKey('203.0.113.42', 'salt');
    expect(key).not.toContain('203.0.113.42');
    expect(key).toMatch(/^login:[A-Za-z0-9_-]+$/);
  });

  it('is stable for the same address and salt', async () => {
    expect(await loginThrottleKey('203.0.113.42', 'salt')).toBe(
      await loginThrottleKey('203.0.113.42', 'salt'),
    );
  });

  it('differs between addresses', async () => {
    expect(await loginThrottleKey('203.0.113.42', 'salt')).not.toBe(
      await loginThrottleKey('203.0.113.43', 'salt'),
    );
  });

  it('differs between deployments using the same address', async () => {
    expect(await loginThrottleKey('203.0.113.42', 'salt-a')).not.toBe(
      await loginThrottleKey('203.0.113.42', 'salt-b'),
    );
  });

  it('falls back to a shared bucket when no address is available', async () => {
    expect(await loginThrottleKey(null, 'salt')).toBe('login:unattributed');
    expect(await loginThrottleKey('', 'salt')).toBe('login:unattributed');
  });
});
