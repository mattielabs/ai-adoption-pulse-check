# AI Adoption Pulse Check

A privacy-first, open-source employee AI adoption discovery tool for organizations of roughly 10–500 people.

It helps answer one question: **how are employees actually using AI, where are the adoption and support gaps, what self-reported risk signals exist, and which workflows deserve deeper investigation?**

It is deliberately *not* a maturity certification, a compliance audit, a test of employee AI skill, or a black-box AI assessment.

---

## Status: Phase 1 — employee survey works end to end

The deterministic core engine (Phase 0) and the complete employee survey
experience (Phase 1) are built and validated. The admin side — authentication,
Pulse creation/management, dashboards, Opportunity Map UI, exports — is
**not built yet**; Pulses currently exist only through the development seed.

| Built | Not built yet |
|---|---|
| Versioned survey schema (Q1–Q28 + Q19b) | Admin authentication |
| Five-dimension scoring engine | Organization setup + Pulse management UI |
| Respondent classification ladder | Organization dashboard + charts |
| Organization aggregation | Opportunity Map UI |
| 10-rule recommendation engine | Demographic filtering UI |
| Opportunity Map analysis | Export download UI |
| Privacy suppression + export shaping | Public synthetic demo site |
| D1 schema and migrations | |
| Public Pulse API (fetch + submit) | |
| Employee survey (8 sections + custom, drafts, review) | |
| Local personal result + focus recommendation | |
| 371 unit tests + 19 E2E tests | |

See [docs/phase-0.md](docs/phase-0.md) and [docs/phase-1.md](docs/phase-1.md) for the precise scope boundaries.

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

Create the local D1 database, apply migrations, and seed the synthetic
development Pulses (five `dev-*` Pulses covering active/closed/future states —
no real people, local database only):

```bash
npm run dev:setup
```

(Equivalent to `npm run db:migrate:local` followed by `npm run db:seed:local`.)

Copy the environment template. `.dev.vars` is gitignored and must never be committed:

```bash
cp .dev.vars.example .dev.vars
```

Run the Worker (serves `/api/*` and, after a client build, the SPA):

```bash
npx wrangler dev
```

Or run the Vite dev server with hot reload, which proxies `/api` to `wrangler dev` on port 8787:

```bash
npm run dev
```

### Trying the employee survey locally

After `npm run dev:setup` and `npm run build` (so the Worker can serve the
SPA), start `npx wrangler dev` and open:

```text
http://127.0.0.1:8787/p/dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c
```

Other seeded states: `dev-plain-…` (no custom questions), `dev-noresult-…`
(personal result disabled), `dev-closed-…`, `dev-future-…` — full ids in
[scripts/dev-seed.sql](scripts/dev-seed.sql).

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
| `npm run test:e2e` | Playwright smoke tests against `wrangler dev` |
| `npm run validate` | typecheck → lint → unit tests → build |
| `npm run fixture:generate` | Regenerate `demo/sample-responses.json` from its fixed seed |
| `npm run dev:setup` | Apply local D1 migrations, then seed the dev Pulses |
| `npm run db:seed:local` | Seed/reset the five synthetic development Pulses |
| `npm run analysis:report` | Run the fixture through the whole pipeline and print the result |

`npm run test:e2e` needs browsers once: `npx playwright install chromium`.

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

- No admin surface yet: Pulses exist only via the development seed until Phase 2 adds creation/management.
- Admin authentication is Phase 2; the secret contract exists but no login flow does.
- API surface is `/api/health`, `/api/version`, and the two public Pulse endpoints. The admin API arrives with its consumers.
- Cloudflare-only. This is a stated V1 limitation, not an oversight.
- Custom questions render and validate but have no authoring UI (seeded only).
- Thresholds (40/50/60/70, the 60% validity rule, the 20% pain rule) are specified but **not yet pilot-validated**.

---

## License

MIT — see [LICENSE](LICENSE).

An open-source project by Mattie Labs.
