/**
 * Failed-login throttling.
 *
 * Login is the only endpoint where an anonymous caller can make the Worker do
 * 600,000 PBKDF2 iterations, and the only one where guessing is worthwhile. It
 * is throttled with Cloudflare's Rate Limiting binding rather than with rows in
 * D1, because login attempts are not survey data and must not be written to the
 * database employee responses live in - and rather than an in-isolate Map,
 * which is not a security boundary: a Worker runs in many isolates and each one
 * would start with an empty counter.
 *
 * Verified against the pinned wrangler (4.124) before implementation: the
 * binding IS serviced by `wrangler dev --local`, so throttling is live in
 * local development as well as in production. Two decisions follow anyway:
 *
 *   1. the throttle sits behind this interface, so unit tests drive it with a
 *      fake and never depend on the Cloudflare service being reachable;
 *   2. a binding that is absent or failing degrades to "allow", logging once
 *      per isolate. Failing closed would let a limiter outage permanently lock
 *      the only administrator out of their own deployment, and V1 has no
 *      recovery path. That tradeoff is documented in docs/phase-2.md.
 *
 * Note that without a `CF-Connecting-IP` header - which local development does
 * not supply - every caller shares one bucket, so local throttling is stricter
 * than production rather than looser.
 */

import { sha256, toBase64Url } from './encoding.js';

/** The subset of Cloudflare's RateLimit binding this code uses. */
export interface RateLimitBinding {
  limit(options: { readonly key: string }): Promise<{ readonly success: boolean }>;
}

export interface LoginThrottle {
  /**
   * Consumes one unit of budget for `key`.
   * Returns false when the caller has exhausted it and must be refused.
   */
  consume(key: string): Promise<boolean>;
}

/** Used when no limiter binding is configured (local development). */
export const openLoginThrottle: LoginThrottle = {
  consume: () => Promise.resolve(true),
};

export function cloudflareLoginThrottle(
  binding: RateLimitBinding,
  onUnavailable: (error: unknown) => void = () => {},
): LoginThrottle {
  return {
    async consume(key: string): Promise<boolean> {
      try {
        const outcome = await binding.limit({ key });
        return outcome.success;
      } catch (error) {
        onUnavailable(error);
        return true;
      }
    },
  };
}

/**
 * Derives the throttle key for a request.
 *
 * The client address is hashed rather than used directly, so the value handed
 * to the rate limiter is a pseudonymous, per-deployment token. The address
 * itself is never stored in D1 and never written to a log line - it exists
 * only as a local variable for the length of this call.
 *
 * A request with no address header falls back to a single shared bucket: an
 * unattributable caller should still not get unlimited guesses.
 */
export async function loginThrottleKey(
  clientAddress: string | null,
  salt: string,
): Promise<string> {
  if (clientAddress === null || clientAddress.length === 0) return 'login:unattributed';

  const digest = await sha256(new TextEncoder().encode(`${salt}:${clientAddress}`));
  return `login:${toBase64Url(digest.slice(0, 16))}`;
}
