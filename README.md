# AI Adoption Pulse Check

A privacy-first, open-source employee AI adoption discovery tool for organizations of roughly 10–500 people.

It helps answer one question: **how are employees actually using AI, where are the adoption and support gaps, what self-reported risk signals exist, and which workflows deserve deeper investigation?**

It is deliberately *not* a maturity certification, a compliance audit, a test of employee AI skill, or a black-box AI assessment.

---

## Status: Phase 2 — employee survey and admin control plane

The deterministic core engine (Phase 0), the complete employee survey
experience (Phase 1), and the administrative control plane (Phase 2) are built
and validated. What is **not** built yet is the interpretation layer: the
organization results dashboard, Opportunity Map UI, filtering and exports all
arrive in Phase 3.

| Built | Not built yet |
|---|---|
| Versioned survey schema (Q1-Q28 + Q19b) | Organization results dashboard |
| Five-dimension scoring engine | Dimension score / `Unsure` rate UI |
| Respondent classification ladder | Recommendation cards |
| Organization aggregation | Opportunity Map UI |
| 10-rule recommendation engine | Demographic filtering UI |
| Opportunity Map analysis | Free-text review view |
| Privacy suppression + export shaping | Export download UI |
| D1 schema and migrations | Public synthetic demo site |
| Public Pulse API (fetch + submit) | |
| Employee survey (8 sections + custom, drafts, review) | |
| Local personal result + focus recommendation | |
| Admin passcode authentication + signed session | |
| First-run organization setup and settings | |
| Pulse create / edit / close / duplicate / delete | |
| Cryptographically random public survey links | |
| Post-response configuration locking | |
| 603 unit tests + 38 E2E tests | |

See [docs/phase-0.md](docs/phase-0.md), [docs/phase-1.md](docs/phase-1.md) and
[docs/phase-2.md](docs/phase-2.md) for the precise scope boundaries.

The admin surface reports **a response count and nothing else** about collected
data. No scores, no recommendations, no free text. Interpreting responses is
Phase 3, and the boundary is enforced by tests.

---

## What it measures

Five **separate** dimensions, each 0–100. There is deliberately no single "AI maturity score" — one average would hide exactly the differences the product exists to surface, such as high Adoption alongside low Safety.

| Dimension | What it actually measures |
|---|---|
| **Adoption** | Self-reported frequency and breadth of work-related AI use |
| **Confidence** | **Self-reported** confidence using and evaluating AI — not demonstrated skill |
| **Workflow** | Self-reported movement from isolated use toward repeatable processes |
| **Safety** | **Self-reported** verification, review and data-handling awareness |
| **Enablement** | Employee-reported organizational clarity, access and training |

Interest (Q28) and the Opportunity Map are reported separately and are not dimensions.

Safety is interpreted asymmetrically on purpose: **a low score is a meaningful risk signal; a high score is not proof that behaviour is actually safe.**

Further reading: [docs/methodology-notes.md](docs/methodology-notes.md).

---

## Architecture

One deployable Cloudflare application. No Next.js, no SSR, no separate API service, no second Worker, no LLM.

```text
Browser
  │
  ├── built Vite/React SPA  (static assets)
  │
  └── /api/*
          ↓
      Hono Worker
          ↓
         D1
```

```text
src/
  core/     methodology — no React, no Hono, no Cloudflare APIs
  server/   the single Hono Worker
  client/   the React SPA
```

`src/core` is framework-independent so the same versioned code runs client-side for the local personal result, Worker-side for organization analysis, against demo fixtures, and in Vitest. An ESLint rule enforces that the core never imports React, Hono or `cloudflare:*`.

Details: [docs/architecture.md](docs/architecture.md).

---

## Local setup

Requires Node 20+ (developed on Node 24) and a Cloudflare account only for deployment — everything below runs locally.

```bash
npm install
```

Some dependencies (`esbuild`, `workerd`) need install scripts. If npm reports them as pending:

```bash
npm approve-scripts esbuild && npm approve-scripts workerd && npm rebuild esbuild workerd
```

Create the local D1 database and apply migrations:

```bash
npm run db:migrate:local
```

Generate an admin passcode hash. The script prompts for the passcode with
terminal echo off, prints only the encoded hash, and never stores or displays
the passcode itself:

```bash
npm run admin:hash-passcode
```

Copy the environment template and paste in the generated hash plus a session
secret. `.dev.vars` is gitignored and must never be committed:

```bash
cp .dev.vars.example .dev.vars
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Build the client and start the Worker (it serves `/api/*` and the built SPA):

```bash
npm run build:client
npx wrangler dev
```

Then open `http://127.0.0.1:8787/admin`, sign in with your passcode, complete
first-run organization setup, and create a Pulse. The Pulse detail page gives
you the employee survey link.

For hot reload, `npm run dev` runs the Vite dev server on port 5173 and proxies
`/api` to `wrangler dev` on 8787. Both must be running.

### Synthetic development Pulses

Optional. Creates a development organization plus five `dev-*` Pulses covering
active, closed and future states, so the employee survey can be opened without
going through the admin flow first:

```bash
npm run db:seed:local
```

Note that this configures the organization, so first-run setup will already be
complete the next time you sign in. Skip it if you want to see that flow.
Its fixed `dev-*` ids are development-only and are never how a real Pulse link
is generated — see [scripts/dev-seed.sql](scripts/dev-seed.sql).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (proxies `/api` to `wrangler dev`) |
| `npm run dev:worker` | `wrangler dev` — Worker + D1 + static assets |
| `npm run build` | Build the client, then validate the Worker bundle |
| `npm run typecheck` | Typecheck the client, Worker and core/test projects |
| `npm run lint` | ESLint |
| `npm test` | Vitest — core methodology tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright flows against a real Worker and its own throwaway D1 |
| `npm run validate` | typecheck → lint → unit tests → build |
| `npm run admin:hash-passcode` | Generate an `ADMIN_PASSCODE_HASH` (prompts, never echoes or stores the passcode) |
| `npm run fixture:generate` | Regenerate `demo/sample-responses.json` from its fixed seed |
| `npm run dev:setup` | Apply local D1 migrations, then seed the dev Pulses |
| `npm run db:seed:local` | Seed/reset the five synthetic development Pulses |
| `npm run analysis:report` | Run the fixture through the whole pipeline and print the result |

`npm run test:e2e` needs browsers once: `npx playwright install chromium`. It
uses its own D1 database in `.wrangler/e2e-state`, recreated empty on every
run, so it never touches your local development data.

---

## Verifying the engine without any UI

```bash
npm run analysis:report
```

This runs the committed 75-response synthetic fixture through
`responses → scores → aggregation → classification → recommendations → opportunities → privacy`
and prints every output. It is a developer tool, not a product surface, and the numbers it prints are **verification evidence about the engine, not claims about any real organization**.

---

## Privacy

The application does not ask for or intentionally store employee name, email, employee ID, account identity, exact job title, device fingerprint, or survey-respondent IP address.

The accurate claim is:

> **The survey collects no direct identifiers and suppresses small-group reporting.**

It is **not** "perfectly anonymous". Free-text answers and contextual details can still make a respondent identifiable to someone who already knows the situation. That limitation is part of the product, not a disclaimer to hide.

Enforced in code today:

- minimum reporting group of 5, applied to **both** a segment and its complement;
- one segmentation dimension at a time — stacked demographic filters are rejected, not truncated;
- suppression runs before any aggregate is computed, so a suppressed segment has no aggregate to leak;
- day-granularity submission dates only;
- Q1–Q3 and Q27 excluded from the default row-level export;
- free text exported separately with no contextual columns;
- CSV formula-injection protection.

---

## Source of truth

The authoritative product, methodology, privacy, scoring and architecture specification is
`AI_Adoption_Pulse_Check_Source_of_Truth_v1.1` in the repository root. Where this code and that document disagree, the discrepancy is a bug to resolve rather than a licence to change methodology silently.

Version constants are pinned in [`src/core/versions.ts`](src/core/versions.ts):

```text
surveyVersion               1.1.0
scoringVersion              1.1.0
recommendationEngineVersion 1.1.0
```

Every response records the survey version it was collected under, and every analysis and export identifies all three.

---

## Current limitations

- **No results dashboard yet.** The admin surface manages collection; scores,
  recommendations, the Opportunity Map, filtering and exports arrive in Phase 3.
- **One administrator credential**, no recovery flow, no roles, no SSO, no audit
  log. Everyone with the passcode is the same administrator.
- **Closed Pulses cannot be reopened.** Duplicate instead — deliberate, so a
  reopened Pulse can never mix two collection periods.
- Login throttling fails open if Cloudflare's rate limiter is unreachable, to
  avoid locking the only administrator out permanently.
- Rotating the passcode does not invalidate sessions already issued (up to 8
  hours); rotating `SESSION_SECRET` does.
- PBKDF2 at 600,000 iterations costs roughly 0.5 s of Worker CPU per login.
- Cloudflare-only. This is a stated V1 limitation, not an oversight.
- Thresholds (40/50/60/70, the 60% validity rule, the 20% pain rule) are
  specified but **not yet pilot-validated**.

---

## License

MIT — see [LICENSE](LICENSE).

An open-source project by Mattie Labs.
