# Self-hosting

AI Adoption Pulse Check is a single Cloudflare Worker that serves both the API
and the built React SPA, backed by one D1 database. There is no second service,
no container, and no external API to sign up for.

**V1 is Cloudflare-only.** That is a real limitation, stated plainly rather than
worked around: adding Docker to claim platform independence would mean
maintaining a second storage layer and a second deployment path for no user
benefit in V1. See [limitations.md](limitations.md).

Expect roughly 15 minutes once you have a Cloudflare account and `wrangler` can
authenticate.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node 20+ | Developed on Node 24. `node --version` |
| npm 10+ | Ships with Node |
| A Cloudflare account | Free tier is sufficient at V1 scale |
| Wrangler authentication | `npx wrangler login`, or a `CLOUDFLARE_API_TOKEN` |

Everything except steps 8–10 works offline against a local database.

---

## 2. Clone and install

```bash
git clone <your fork or clone URL>
cd "Pulse Check"
npm install
```

Two dependencies (`esbuild`, `workerd`) run install scripts. If npm reports them
as pending approval:

```bash
npm approve-scripts esbuild && npm approve-scripts workerd && npm rebuild esbuild workerd
```

Confirm the checkout is sound before configuring anything:

```bash
npm run validate
```

That runs typecheck → lint → unit tests → build. It needs no database, no
secrets and no network.

---

## 3. Create the D1 database

```bash
npx wrangler d1 create pulse_check
```

Wrangler prints a `database_id`. Paste it into `wrangler.jsonc`, replacing the
placeholder:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "pulse_check",
    "database_id": "PASTE-THE-PRINTED-ID-HERE",
    "migrations_dir": "migrations"
  }
]
```

That id is an account-scoped resource identifier, not a secret, and it is
committed like any other configuration.

---

## 4. Apply migrations

Locally:

```bash
npm run db:migrate:local
```

And, once you are ready to deploy, against the real database:

```bash
npm run db:migrate:remote
```

Migrations live in `migrations/` and are plain SQL. Nothing in the schema
stores a name, email address, employee ID, IP address or device identifier —
see [privacy.md](privacy.md).

---

## 5. Generate the admin passcode hash

```bash
npm run admin:hash-passcode
```

The script prompts for a passcode with terminal echo off, derives a salted
PBKDF2-HMAC-SHA256 hash, and prints **only** the hash. The passcode itself is
never echoed, never written to a file, and never passed as a command-line
argument — so it cannot end up in shell history or a process listing.

There is deliberately no plaintext `ADMIN_PASSCODE` variable anywhere in the
application. It cannot read one and will not accept one.

Choose the passcode the way you would choose a shared production credential.
Everyone who has it is the same administrator; there are no accounts and no
recovery flow.

---

## 6. Generate a session secret

```bash
npm run admin:session-secret
```

This prints 32 cryptographically random bytes, base64-encoded. It signs the
short-lived admin session cookie. Do not invent a memorable phrase for it —
nobody ever types it, and a guessable value would let somebody forge a session.

Rotating it signs every administrator out immediately, which is the intended
way to revoke access.

---

## 7. Configure secrets

**Locally**, copy the template and paste both values in. `.dev.vars` is
gitignored and must never be committed:

```bash
cp .dev.vars.example .dev.vars
```

**In production**, set them as Worker secrets. They are never put in
`wrangler.jsonc`, never stored in D1, and never logged:

```bash
npx wrangler secret put ADMIN_PASSCODE_HASH
npx wrangler secret put SESSION_SECRET
```

---

## 8. Run it locally

```bash
npm run build:client
npx wrangler dev
```

Open `http://127.0.0.1:8787/admin`. You can check the deployment's wiring
without signing in:

```bash
curl http://127.0.0.1:8787/api/health
```

That reports whether the D1 binding and each secret are configured. It reports
presence only — it never reveals any part of a secret.

For hot reload during development, `npm run dev` starts Vite on port 5173 and
proxies `/api` to `wrangler dev` on 8787. Both must be running.

---

## 9. Deploy

```bash
npm run deploy
```

That builds the client and runs `wrangler deploy`, which uploads the Worker and
the static assets together. To check the bundle without deploying:

```bash
npm run build:worker
```

Confirm the deployment before signing in:

```bash
curl https://<your-worker-domain>/api/health
```

---

## 10. First login and organization setup

1. Open `https://<your-worker-domain>/admin` and sign in with the passcode.
2. The first sign-in lands on **organization setup**, because no organization
   exists yet. Enter the organization name, and optionally a logo URL and an
   accent colour.
3. You arrive at an empty Pulse list.

Setup cannot be repeated: once an organization exists, `/admin/setup`
redirects away.

---

## 11. Create your first Pulse

See [running-a-pulse.md](running-a-pulse.md) for the whole cycle — dates,
custom questions, the employee link, closing, duplicating and exporting.

---

## Rate limiting

Admin login is throttled by the Cloudflare Rate Limiting binding declared in
`wrangler.jsonc` (8 attempts per 60 seconds). It is a remote binding, so
`wrangler dev --local` does not service it and local development runs without
throttling.

If the limiter is unreachable in production, login **fails open** rather than
closed. That is deliberate: with one credential and no recovery flow, a
limiter outage that locked out the only administrator would be worse than the
attack it prevents. The passcode hash and the constant-time comparison still
apply.

---

## Backups and retention

The organization controls its own data. D1 supports export:

```bash
npx wrangler d1 export pulse_check --remote --output=backup.sql
```

Deleting a Pulse from the admin UI deletes its responses and custom questions.
There is no soft delete and no recovery — the confirmation dialog says so.

---

## Upgrading

Pull, install, re-run migrations, re-deploy:

```bash
git pull
npm install
npm run db:migrate:remote
npm run deploy
```

Every response records the survey version it was collected under, and the
analysis refuses to score responses from an unsupported version rather than
silently mixing them. If a future release changes scoring, historical results
stay reproducible under their original version — see
[methodology.md](methodology.md).
