/**
 * Generates a SESSION_SECRET for a deployment.
 *
 *   npm run admin:session-secret
 *
 * A one-line `node -e "..."` would do the same thing, but the quoting differs
 * between PowerShell, cmd and a POSIX shell, and a self-hoster who gets the
 * quoting wrong ends up with a short or empty secret and no obvious sign of
 * it. This runs identically everywhere.
 *
 * The value is printed once and never written anywhere. It is not a passcode:
 * nobody types it, so there is no reason for it to be memorable.
 */

import { randomBytes } from 'node:crypto';

/** 32 bytes is the HMAC-SHA256 block-equivalent key length. More is not stronger. */
const SECRET_BYTES = 32;

const secret = randomBytes(SECRET_BYTES).toString('base64');

process.stdout.write(`
SESSION_SECRET generated (${SECRET_BYTES} random bytes, base64):

  ${secret}

Local development
  Put it in .dev.vars, which is gitignored:

    SESSION_SECRET="${secret}"

Production
  Set it as a Worker secret, never in wrangler.jsonc:

    npx wrangler secret put SESSION_SECRET

Rotating this value invalidates every session already issued, which is the
intended way to sign every administrator out. It is not stored in D1 and never
appears in a log line.
`);
