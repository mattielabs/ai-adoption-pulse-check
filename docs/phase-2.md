# Phase 2 — Admin authentication and Pulse management

**Goal:** a self-hosting organization gets a small, secure control plane — sign
in, configure the organization once, create Pulses, share their links, watch the
response count, and close, duplicate or delete a collection.

Phase 2 controls **collection**. It deliberately surfaces no analysis: no
dimension scores, no recommendations, no Opportunity Map, no filters, no free
text, no exports. Those are Phase 3. The only number the admin surface reports
about collected data is a count.

---

## The admin flow

```text
/admin  →  /admin/login
              ↓ passcode
        no organization? → /admin/setup → create organization
              ↓
        /admin/pulses          list: status, dates, response counts
              ↓
        /admin/pulses/new      create (also the duplicate prefill target)
              ↓
        /admin/pulses/:id      link, count, configuration, close/duplicate/delete
```

Client route guards are navigation convenience. **The server is the
authorization boundary** — every `/api/admin/*` request outside a two-path
allowlist is refused without a valid session, and a screen reached any other
way simply receives 401s instead of data.

---

## Authentication

One deployment-level passcode. No usernames, no account rows, no invitations,
no roles, no password reset.

### Passcode hash

`ADMIN_PASSCODE_HASH` holds one encoded format, parsed in exactly one place
(`src/server/lib/passcode.ts`):

```text
pbkdf2-sha256$600000$<base64url salt>$<base64url derived key>
```

- PBKDF2-HMAC-SHA256, **600,000 iterations**, 16-byte random salt, 32-byte key.
- A stored hash with a work factor *below* 600,000 is treated as
  misconfiguration rather than silently accepted.
- Derived bytes are compared with `crypto.subtle.timingSafeEqual` where the
  runtime provides it (Workers, `wrangler dev`) and a constant-time XOR
  accumulation otherwise (plain Node, where the unit tests run). Never `===`.
- Measured cost in workerd: roughly **0.5 s of CPU per login attempt**. That is
  the point — it is what makes an offline attack on a leaked hash expensive —
  but it does mean login is the slowest endpoint in the application and that
  throttling matters.

Generate one with:

```bash
npm run admin:hash-passcode
```

The script prompts twice with terminal echo suppressed, prints only the encoded
hash and setup instructions, and never writes or prints the passcode. There is
deliberately **no plaintext `ADMIN_PASSCODE` variable** — the application cannot
read one and will not accept one.

### Session

Stateless and signed. There is no admin session table; D1 holds survey data only.

```text
<base64url(payload)>.<base64url(HMAC-SHA256 over the payload)>
payload = { v, iat, exp }
```

The payload carries a version and two timestamps. No employee data, no
passcode material, no organization state. It is signed, not encrypted: anyone
holding the cookie can read two timestamps, which are not secrets.

| Property | Value |
|---|---|
| Cookie name | `pulse_admin_session` |
| Attributes | `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` |
| Lifetime | 8 hours, not extended on activity |
| Logout | clears the cookie; works without a session so an expired one can still be discarded |

`Secure` is set unconditionally. Browsers treat `http://localhost` and
`http://127.0.0.1` as trustworthy origins and accept Secure cookies there, so
local development works without weakening the production attribute set.

### Secret rotation

- **Rotating `SESSION_SECRET` invalidates every issued session immediately** —
  no existing signature verifies against the new key.
- **Rotating only the admin passcode does not.** Nothing in the token is derived
  from the passcode, so a session issued before the change stays valid until it
  expires (at most 8 hours). Rotate `SESSION_SECRET` as well if that matters.

### Login throttling

`/api/admin/login` is protected by Cloudflare's Rate Limiting binding
(`ADMIN_LOGIN_LIMITER`, 8 per 60 s), keyed by a **SHA-256 hash of the client
address** rather than the address itself. The address exists only as a local
variable for the length of the call: it is never written to D1 and never logged.

A failed attempt consumes **two** units of budget and a successful one consumes
one, so guessing exhausts the allowance about twice as fast as legitimate use.
Verified against the running Worker: four wrong passcodes, then

```text
429 {"error":"too_many_attempts"}
```

Two deliberate design points:

- **Login attempts are never stored in D1.** They are not survey data and have
  no business being in the database employee responses live in. A test asserts
  the schema still contains exactly four tables after failed logins.
- **The limiter fails open.** If the binding is absent or errors, the request is
  allowed and one line is logged per isolate. Failing closed would let a limiter
  outage permanently lock the only administrator out of their own deployment,
  and V1 has no recovery path. This is a stated tradeoff, not an oversight.

An in-isolate `Map` is *not* used as the limiter: a Worker runs in many isolates
and each would start with an empty counter, which is not a security boundary.

Note for local development: `wrangler dev` **does** service this binding, but a
local request carries no `CF-Connecting-IP`, so every caller shares one bucket.
Local throttling is therefore stricter than production, not looser.

### Cross-origin mutation protection

Every state-changing admin request must present an `Origin` matching the
deployment's own origin, on top of the `SameSite=Strict` cookie. A cross-origin
mutation is refused with `403 cross_origin_request_rejected` before validation,
the database, or the passcode derivation is touched.

Two behaviours worth stating:

- A request with **no** `Origin` header is allowed. Browsers always send it on
  cross-origin requests and on same-origin non-GET requests, so an absent header
  means a non-browser client — which has no ambient cookie to abuse.
- **Loopback-to-loopback is allowed**, so `npm run dev` works across the Vite
  proxy (`:5173` → `:8787`). The relaxation is derived from the *request's own
  host*, never from an environment flag, so it can never apply to a deployment
  served from a real domain.

No CSRF token system was added: it would defend against the same attack this
pair already blocks, at the cost of a token endpoint, storage and rotation.

---

## Organization

V1 is a single-organization deployment, enforced **server-side**:

- `POST /api/admin/organization` refuses with `409 organization_already_configured`
  once a row exists;
- `PATCH` addresses the existing row rather than one named in the request, so no
  admin call can reach or create a second organization;
- there is no organization switcher and no organization id in any request body.

| Field | Rules |
|---|---|
| Name | required, trimmed, at most 120 characters |
| Logo URL | optional, `http:`/`https:` only — `javascript:` and `data:` are rejected |
| Accent colour | optional, strict `#RRGGBB`; still contrast-checked before white text is placed on it |
| Survey intro | optional, plain text, at most 2000 characters |

The survey intro is stored verbatim and rendered as text. There is no Markdown
renderer and no `dangerouslySetInnerHTML` anywhere in the codebase; a test
submits a `<script>` tag and asserts it is stored as characters and rendered as
characters.

Changes affect how the employee page renders from now on. **Stored responses are
never rewritten.**

---

## Pulse lifecycle

### Creation

A Pulse is created in the normal active lifecycle (`status = 'open'`) — there is
no second "publish" step. `opens_on` decides whether it is immediately available
or upcoming; `closes_on` schedules the ending; explicit Close ends it early.

The `draft` status in the schema is left alone. Phase 2 never creates one; the
admin list renders any such row honestly as **Not published**.

Creating a Pulse and its custom questions is **atomic**. Both go into one
`db.batch()` transaction, with each custom question resolving its parent through
the freshly generated public id:

```sql
INSERT INTO custom_questions (pulse_id, ...)
VALUES ((SELECT id FROM pulses WHERE public_id = ?), ...)
```

Without that sub-select the parent id would have to be read back between
statements, and a failure after the Pulse insert would leave a half-configured
Pulse behind. A test forces the fourth custom-question insert to violate the
position CHECK and asserts that no Pulse row survives.

### Public ids

16 bytes (128 bits) from `crypto.getRandomValues`, base64url-encoded into 22
URL-safe characters. Nothing derived from the Pulse name, the organization, a
counter or a clock is used as input. If the unique index ever reports a
collision, generation retries up to five times and then fails with a server
error rather than looping. Tests cover the entropy source (asserting
`getRandomValues` is called and `Math.random`/`Date.now` are not), the encoded
shape, the retry, and the bounded give-up.

The fixed `dev-*` ids in `scripts/dev-seed.sql` are development seed data only
and fail the generated-id shape check on purpose.

### Custom questions

Zero to three per Pulse, each `single_select`, `multi_select` or `free_text`,
all **optional for employees** and never scored.

An administrator types display **labels**; the server generates stable machine
ids from them (`src/core/admin/optionIds.ts`) and stores both. That separation
is the same reasoning the core survey uses: editing a label later must not
change the meaning of answers already collected. Two labels that slugify to the
same value get numeric suffixes, so `A/B` and `A-B` cannot both become `a_b`.

Select questions require 2–10 distinct options; free-text questions must carry
none.

### Editing, and what locks

| | Before the first response | After the first response |
|---|---|---|
| Name | editable | editable |
| Description | editable | editable |
| `closes_on` | editable | editable |
| `opens_on` | editable | **locked** |
| Personal result setting | editable | **locked** |
| Custom questions | editable | **locked** |
| Survey/scoring/recommendation version | never editable | never editable |

Collected answers must stay interpretable against the configuration respondents
actually saw. The lock is enforced by the server, which refuses a PATCH that so
much as *mentions* a locked field once responses exist:

```json
409 { "error": "pulse_configuration_locked", "fields": ["opensOn"] }
```

Rejecting on presence rather than diffing values keeps the rule unambiguous; the
UI simply omits the locked fields, and shows them as read-only values with the
reason. If an administrator needs different configuration, they duplicate.

Version fields are not in the update schema at all, so a request naming one is
rejected as an unknown field before any of this runs.

### Close

`POST /api/admin/pulses/:id/close` sets `status = 'closed'` and stamps
`closed_at`. The public survey stops accepting submissions immediately — the
server is authoritative, so a page loaded while the Pulse was open is refused
with `409 not_accepting_responses` on submit.

Closing is **irreversible in V1**. There is no reopen endpoint and no field that
sets the status back. A second close returns `409 pulse_already_closed` rather
than silently re-stamping. The confirmation dialog says so:

> Closing this Pulse stops new responses. Existing results remain available. To
> run another collection, duplicate the Pulse.

### Duplicate

Duplication has **no endpoint of its own**. The client prefills the create form
from an existing Pulse's detail (`/admin/pulses/new?duplicateOf=<id>`) and posts
it through the ordinary create path, so there is exactly one implementation of
"a Pulse comes into existence".

Copied: name (suffixed `(copy)`), description, personal-result setting, custom
question definitions. **Not copied:** responses, response count, the public id,
the internal id, or the dates — carrying a schedule that has already passed
would produce a Pulse that is closed the moment it is created, so new dates are
asked for.

### Delete

`DELETE /api/admin/pulses/:id`, permanent, no soft delete. The confirmation
dialog names the Pulse, states how many responses will be destroyed, and
requires the administrator to type `DELETE` before the button enables.

Deletion relies on `ON DELETE CASCADE` for `custom_questions.pulse_id` and
`responses.pulse_id`. That was **verified against local D1** rather than
assumed, and is asserted again in tests against real SQLite with the project's
real migrations. Afterwards the public link returns the ordinary generic 404,
indistinguishable from an id that never existed.

---

## Admin API

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/login` | exchange the passcode for a session |
| `POST /api/admin/logout` | clear the cookie |
| `GET /api/admin/session` | `{ authenticated, organizationConfigured }` |
| `GET /api/admin/organization` | the single organization, or `null` on first run |
| `POST /api/admin/organization` | first-run setup |
| `PATCH /api/admin/organization` | edit settings |
| `GET /api/admin/pulses` | list with state, dates, response counts |
| `POST /api/admin/pulses` | create (and the duplication path) |
| `GET /api/admin/pulses/:id` | operational detail |
| `PATCH /api/admin/pulses/:id` | edit what is still safe to edit |
| `POST /api/admin/pulses/:id/close` | close permanently |
| `DELETE /api/admin/pulses/:id` | delete permanently |

Only `/login` and `/logout` are reachable without a session. That allowlist is
declared in one place (`src/server/routes/admin.ts`) and everything else is
protected by default — a route added later is protected unless somebody
deliberately adds its path to the list.

No results, analysis, opportunity or export endpoints exist yet.

### Operational state versus database status

The database `status` column and the date-derived availability are related but
not identical, and conflating them is how a management screen ends up
disagreeing with the submission endpoint. `computeOperationalState` derives the
admin label *through* `computeAvailability` — the same function the public API
uses — rather than re-implementing it:

| Label | Meaning |
|---|---|
| Not published | `status = 'draft'` (seeded/legacy rows only) |
| Upcoming | scheduled, `opens_on` still in the future |
| Open | accepting responses right now |
| Closed | an administrator pressed Close |
| Collection ended | still `open`, but `closes_on` has passed |

A test asserts, across every combination, that "the admin says Open" and "the
server accepts a response" are the same condition. There is no second status
engine in React.

### Dates

Phase 1 semantics are preserved: calendar days, UTC, `opens_on` inclusive,
`closes_on` inclusive, explicit closed status wins.

`src/core/pulse/day.ts` never parses a day string into a `Date`. The moment
`YYYY-MM-DD` goes through `new Date(...)` it becomes midnight UTC, and any
local-time formatting of that instant shifts the displayed day backwards for
every user west of Greenwich — which is exactly how a Pulse configured to open
on the 3rd starts showing "opens 2 August" to its administrator. Days are
validated by arithmetic and formatted from their own components; a test asserts
the rendered string is identical in four timezones.

---

## Shared-device result cleanup

Phase 1 stores a personal-result snapshot in `localStorage` so an employee can
revisit it. The result screen now says so and offers a way out:

> This result is stored only on this browser. Clear it if you use a shared device.

Clearing removes `pulse-check:result:{publicId}` and nothing else. The submitted
response is untouched, and the duplicate marker is deliberately left in place —
so the copy says plainly that the survey still cannot be taken again on this
browser. Covered end to end.

---

## Testing

Two different fakes, for two different reasons:

- the **public** API tests keep a hand-written D1 double, because they assert
  exactly which five values reach the INSERT;
- the **admin** tests run against real SQLite (`node:sqlite`, built into Node 24)
  with the project's real migrations applied, because they need real constraint
  enforcement: the unique index on `public_id`, the custom-question position
  CHECK, foreign-key cascade on delete, and transactional rollback of a
  partially failed `batch()`. A mock would simply agree with the implementation.

The end-to-end suite runs against the real Worker and real local D1, with its
own database in `.wrangler/e2e-state` recreated empty on every run. That empty
database is a precondition, not a convenience: the admin first-run flow needs a
deployment with **no organization configured**, which cannot be simulated once
one exists. It also means a developer's own local data in `.wrangler/state` is
never touched by running the tests.

The setup project performs first-run setup through the UI and then provisions
the employee-flow Pulses through the real admin API — so the Phase 1 employee
flows now run against Pulses an administrator actually created, with genuine
128-bit random links, rather than hand-written seed rows.

Because login is genuinely throttled, the suite signs in **once** and reuses the
session; only the tests specifically about authentication start from a
signed-out browser.

---

## Known limitations

These are intentional V1 boundaries, not defects.

1. **One administrator credential.** Everyone with the passcode is the same
   administrator; there is no per-person attribution.
2. **No password recovery.** Losing the passcode means generating a new hash and
   updating the deployment secret.
3. **No roles, no SSO, no OAuth, no invitations.**
4. **No audit log.** Nothing records who closed or deleted a Pulse, because
   there is no "who".
5. **Closed Pulses cannot be reopened.** Duplicate instead.
6. **The rate limiter fails open** if Cloudflare's limiter is unavailable, to
   avoid locking the only administrator out permanently.
7. **Rotating the passcode does not invalidate live sessions** (up to 8 hours).
   Rotate `SESSION_SECRET` to do that.
8. **Cloudflare-only.** A stated V1 limitation.
9. **PBKDF2 at 600,000 iterations costs about 0.5 s of Worker CPU per login.**
   Comfortable on paid plans; worth knowing before deploying somewhere with a
   tight CPU ceiling.
10. **No analytics of any kind yet** — deliberately deferred to Phase 3.

---

## Deliberate Phase 3 exclusions

Organization results dashboard, dimension scores, `Unsure` rates,
recommendation cards, Opportunity Map, barrier and training analysis,
demographic filtering, the free-text review view, CSV/JSON exports, longitudinal
comparison, and the public synthetic demo site.
