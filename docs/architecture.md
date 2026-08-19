# Architecture

## One Worker

The whole application is a single deployable Cloudflare Worker.

```text
Browser
  │
  ├── built Vite/React SPA  (served from the `assets` binding)
  │
  └── /api/*
          ↓
      Hono Worker
          ↓
         D1
```

The Worker serves API routes, the built static SPA assets, and SPA fallback routing.

`wrangler.jsonc` configures this with three settings that matter:

- `assets.directory` points at `dist/client`, the Vite build output;
- `assets.not_found_handling: "single-page-application"` makes unknown paths return `index.html` so React Router can handle deep links such as `/p/{publicPulseId}`;
- `assets.run_worker_first: ["/api/*"]` ensures API requests always reach the Worker instead of being answered with the SPA shell.

Without that last setting, `/api/health` would return the HTML page. The E2E smoke test asserts that unknown API paths return a JSON 404 rather than HTML, which is what catches a regression here.

### Why not Next.js and a separate API Worker

V1.0 proposed Next.js plus a separate API Worker. V1.1 replaced it because:

- there is nothing to server-render. The survey is a local-draft form; the admin dashboard is behind a passcode. Neither benefits from SSR, and neither is SEO-relevant.
- two deployables means two things to configure, version, and keep in sync for a self-hoster whose target setup time is about fifteen minutes.
- a separate API service adds a network boundary between two pieces of code that always deploy together.

The cost is that there is no server-rendered HTML. That is not a cost this product was paying for anything.

---

## Three source trees

```text
src/
  core/     methodology  — pure TypeScript
  server/   the Worker   — Hono, D1
  client/   the SPA      — React, React Router, Tailwind
```

### `src/core` is framework-independent

The core package must never import React, Hono, or `cloudflare:*`. This is enforced two ways:

1. an ESLint `no-restricted-imports` rule scoped to `src/core/**`;
2. separate TypeScript projects — `tsconfig.app.json` (DOM types), `tsconfig.worker.json` (`@cloudflare/workers-types`), `tsconfig.node.json` (Node types). The core is compiled under all three, so anything environment-specific fails somewhere.

Splitting the TypeScript projects is also what avoids the DOM/workers-types global collision: both define `fetch`, `Request` and `Response` with different shapes, and a single merged project cannot typecheck both cleanly.

The core has exactly one runtime dependency: Zod, for validation. Zod runs identically in Node, in the browser and in a Worker, so it does not compromise framework independence.

### Why that matters in practice

The same versioned scoring code must run in four places:

| Where | Why |
|---|---|
| Browser | the optional local personal result, computed without sending anything to a server |
| Worker | organization analysis |
| Demo fixtures | the public synthetic demo must exercise the real logic, not a mock |
| Vitest | tests run in plain Node with no React, DOM, or Vite plugins |

If scoring lived in a React component or a Hono handler, the personal result and the organization analysis would drift, and the tests would have to instantiate a framework to check arithmetic.

### The dependency direction

```text
client  ─┐
         ├──> core
server  ─┘
```

`core` depends on neither. There is no path from `core` back to `client` or `server`.

---

## Data flow

### Public Pulse fetch (Phase 1)

```text
GET /api/pulses/:publicId
  ↓  parameterized lookup by public_id (joined to organization)
  ↓  availability computed server-side from status + day-granular dates (UTC)
  ↓  draft / unknown ids -> identical generic 404
  ↓  public shape only: no internal ids, no counts, no admin configuration
```

The payload contract (`PublicPulse`) lives in `src/core/pulse/publicPulse.ts`
because both the client and the Worker consume it and the client must never
import from `src/server`.

### Submission (Phase 1)

```text
Browser
  ↓  renders the survey from the canonical schema (src/core/survey/questions.ts)
  ↓  holds answers in a versioned localStorage draft until submission
  ↓  client-side checks mirror the schema (required, max selections)
  ↓  POST the response
Worker
  ↓  32 KB byte-size gate on the raw body   (before parsing)
  ↓  Zod schema validation                  (same schema as the client)
  ↓  Pulse exists -> availability -> survey-version match
  ↓  custom answers validated against the Pulse's configured questions
D1
  ↓  one row: pulse_id, submitted_on (UTC day), survey_version,
  ↓           answers_json, custom_answers_json - nothing else
Return 201
```

No aggregate recalculation happens during submission. A submission writes one
row and returns. The local draft is cleared only after the server confirms
persistence; every failure path keeps it.

### Local personal result (Phase 1)

The optional personal result is computed in the browser by the same versioned
core modules the Worker uses (`calculateScores`, `classifyRespondent`, plus
the small `personal/focus.ts` ruleset). Nothing is POSTed for it and the
result is never stored server-side - the employee's individual scores exist
only on their device.

### Analysis

```text
Admin request
  ↓  authenticate session          (Phase 2)
  ↓  load Pulse responses
  ↓  APPLY PRIVACY SUPPRESSION     ← first, not last
  ↓  respondent scoring
  ↓  organization aggregation
  ↓  recommendation engine
  ↓  opportunity engine
Return safe analysis
```

Suppression running **first** is deliberate. If a segment fails the group-or-complement check, no aggregate is computed for it at all, so there is nothing downstream that could accidentally serialize. `runAnalysis` returns `{ suppressed: true, reason }` and literally nothing else; a test asserts the exact JSON shape.

---

## D1

Four tables: `organizations`, `pulses`, `custom_questions`, `responses`. See `migrations/0001_initial_schema.sql`, which documents each decision inline.

### Why answers are versioned JSON rather than a column per question

1. **The survey is a versioned document.** A column-per-question schema needs a migration for every survey revision, and historical responses become ambiguous once a question's meaning changes. Storing the answer set beside `survey_version` keeps each response self-describing.
2. **Analysis is computed in application code, not SQL.** Nothing in V1 filters or aggregates inside the database, so normalizing into an answers table would add joins and write amplification for no benefit.
3. **It keeps the row narrow and unindexed on content**, which limits the ways an accidental query could correlate individual answers.

The trade-off is accepted: answer-level validation is Zod's job at the API boundary, not the database's. The schema still enforces `json_valid()` and that the payload is an object.

### Why there is no aggregate cache

There is no `pulse_aggregates` table, and there will not be one until measured performance justifies it.

At the V1 target size — 10–500 employees, so at most a few hundred rows per Pulse — analysis is computed on read. A cache would buy nothing measurable and would cost:

- an invalidation problem on every new response;
- a second copy of derived respondent data to keep privacy-safe;
- ambiguity about which engine version produced a cached result.

That last point is the real objection. Cached aggregates computed under scoring 1.1.0 and served after an upgrade to 1.2.0 would silently mix methodologies. Computing on read means the version stamped on the result is always the version that produced it.

### Why there is no generic settings table

Known organization settings are real columns on `organizations`. A generic `organization_settings` key/value table hides the schema, defeats constraints, and invites unvalidated writes.

### What is deliberately absent

No `users`, `employees`, or `accounts` table. The product collects no direct identifiers and has no per-person login — there is one deployment-level admin passcode instead. There is nothing to store about a person, so there is no table for it.

---

## Security posture in Phase 0

Established now, so later phases extend rather than retrofit:

- **Zod validation on the write path**, with a byte-size gate that runs *before* parsing (`src/server/lib/validation.ts`).
- **Parameterized D1 queries only.** String interpolation into SQL appears nowhere.
- **Structural D1 typing** (`src/server/lib/d1.ts`): the server declares only the
  prepare/bind/first/all/run surface it uses, which the real binding satisfies
  as-is. Route handlers are therefore unit-testable in plain Node with an
  in-memory fake, and the INSERT test asserts the exact five values bound.
- **No secrets in code, in D1, or in logs.** `.dev.vars` is gitignored; `.dev.vars.example` documents the contract with no values. The health endpoint reports whether a secret is *configured* as a boolean, never any part of its value.
- **Error logging records the error name and message, never the request body**, so a survey payload cannot reach the logs.
- **Baseline response headers**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- **Validation errors echo field paths and messages only**, never the submitted values.

Admin authentication (PBKDF2-HMAC-SHA256, constant-time comparison, HMAC-signed short-lived `Secure; HttpOnly; SameSite=Strict` cookie, server-side login throttling) is Phase 2. The environment contract for it exists from Phase 0 onward so nothing has to be reshaped later.

---

## Versioning

Three constants in `src/core/versions.ts`: `surveyVersion`, `scoringVersion`, `recommendationEngineVersion`, all `1.1.0`.

- Every stored response records the survey version it was collected under.
- Every analysis and export carries all three.
- Version strings are never edited in place. A methodology change adds a new version.

`pulses` stores all three so a Pulse is pinned to the engine it ran under.

Phase 0 does **not** implement a migration engine for re-scoring historical responses under a new version. The interfaces are shaped so later versions can coexist — mappings, weights and rules are data rather than inlined literals — but nothing dispatches on version yet, because there is only one.
