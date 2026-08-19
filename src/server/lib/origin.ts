/**
 * Cross-origin mutation protection for the cookie-authenticated admin API.
 *
 * The session cookie is `SameSite=Strict`, which already prevents a browser
 * from attaching it to a cross-site request. This is the second layer: every
 * state-changing admin request must additionally present an `Origin` that
 * matches the deployment's own origin.
 *
 * Why no CSRF token: a token would defend against exactly the same attack this
 * pair already blocks, at the cost of a token endpoint, token storage, and a
 * rotation story. Spec 59 sets a security floor, not a maximum, and brief 18
 * says not to add one without a demonstrated gap.
 *
 * Two behaviours deserve explanation:
 *
 *   - A request with NO `Origin` header is allowed. Browsers always send
 *     `Origin` on cross-origin requests and on same-origin non-GET requests,
 *     so an absent header means a non-browser client (curl, a test harness) -
 *     which has no ambient cookie to abuse in the first place.
 *
 *   - Loopback-to-loopback is allowed, so `npm run dev` works: the Vite dev
 *     server proxies /api from :5173 to the Worker on :8787, producing a
 *     legitimate origin mismatch. This relaxation is derived from the REQUEST'S
 *     OWN host, not from an environment flag, so it can never apply to a
 *     deployment served from a real domain.
 */

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

export type OriginCheck = 'allowed' | 'rejected';

export function checkRequestOrigin(requestUrl: string, originHeader: string | null): OriginCheck {
  if (originHeader === null || originHeader.length === 0) return 'allowed';

  let target: URL;
  let origin: URL;
  try {
    target = new URL(requestUrl);
    origin = new URL(originHeader);
  } catch {
    return 'rejected';
  }

  if (origin.origin === target.origin) return 'allowed';
  if (isLoopback(target.hostname) && isLoopback(origin.hostname)) return 'allowed';

  return 'rejected';
}

/** True for methods that change state and therefore require the origin check. */
export function isMutatingMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}
