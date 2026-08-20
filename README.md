# AI Adoption Pulse Check

A privacy-first, open-source employee AI adoption discovery tool for
organizations of roughly 10–500 people. Self-hosted on Cloudflare. No LLM
anywhere in it.

It answers one question: **how are employees actually using AI, where are the
adoption and support gaps, what self-reported risk signals exist, and which
workflows deserve deeper investigation?**

---

## What it does

An administrator creates a Pulse and shares a link. Employees answer 28
questions in 7–10 minutes without an account, and can optionally see their own
result — calculated in their browser and never sent back. The administrator gets
five separate dimension scores, a ranked set of evidence-backed
recommendations, a behaviour-classification distribution, barriers, training
demand, a workflow Opportunity Map, and privacy-safe segmentation.

Every number comes from fixed rules over survey answers. The same input always
produces the same output, and the rules are readable in
[`src/core`](src/core) — about 3,000 lines with 713 tests on them.

## Why it exists

Most AI-adoption assessments are either a vendor questionnaire that concludes
you need the vendor's product, or a maturity score that averages away the one
thing worth seeing. High Adoption alongside low Safety is a finding. A single
number that reports both as "62" is not.

It is also a portfolio project. The value is meant to be in the methodology, the
tradeoffs and the deletions — not the feature count. Several capabilities were
deliberately removed before implementation; [docs/changelog.md](docs/changelog.md)
records which and why.

---

## What it measures

Five **separate** dimensions, each 0–100. There is deliberately no combined
maturity score.

| Dimension | What it actually measures |
|---|---|
| **Adoption** | Self-reported frequency and breadth of work-related AI use |
| **Confidence** | **Self-reported** confidence using and evaluating AI — not demonstrated skill |
| **Workflow** | Self-reported movement from isolated use toward repeatable processes |
| **Safety** | **Self-reported** verification, review and data-handling awareness |
| **Enablement** | Employee-reported organizational clarity, access and training |

Interest (Q28) and the Opportunity Map are reported separately and are not
dimensions.

Safety is read asymmetrically on purpose: **a low score is a meaningful risk
signal; a high score is not proof that behaviour is actually safe.**

Further reading: [docs/methodology.md](docs/methodology.md),
[docs/survey-design.md](docs/survey-design.md),
[docs/interpreting-results.md](docs/interpreting-results.md).

## What it does not claim

- **Not a skill test.** Nothing is observed or tested.
- **Not a compliance audit.** It cannot establish that anything is safe.
- **Not guaranteed anonymity.** No direct identifiers are collected and small
  groups are suppressed — but somebody can still describe themselves in a
  written answer.
- **Not a single maturity score.**
- **Not automation readiness.** An opportunity means a workflow is worth
  investigating, not that it can be automated or that it would pay for itself.

The tool supports deeper discovery. It does not replace it.

---

## Demo

The repository ships a public demo that runs the real engine over a committed
synthetic fixture:

| Route | What it shows |
|---|---|
| `/demo` | What the product measures and refuses to claim |
| `/demo/results` | A fictional organization's full dashboard |
| `/demo/survey` | The real survey, local-only — nothing is submitted |
| `/methodology` | The short public methodology |

The fixture is **approximately 75 fictional responses** generated from a fixed
seed. **Northstar Services** is not a real company, and no figure anywhere in
the demo describes a real organization. The demo endpoints take no identifier
of any kind and hold no database reference, so they cannot return live data —
see [docs/phase-4.md](docs/phase-4.md#public-demo).

To see it locally: `npm run build:client && npx wrangler dev`, then open
`http://127.0.0.1:8787/demo`. No account, no secrets, no database required.

No screenshots are committed, because none have been produced.

---

## Architecture

One deployable Cloudflare application. No Next.js, no SSR, no separate API
service, no second Worker, no LLM.

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

`src/core` is framework-independent, so the same versioned code runs
client-side for the personal result, Worker-side for organization analysis,
against the demo fixture, and in Vitest. An ESLint rule enforces that the core
never imports React, Hono or `cloudflare:*`.

The dashboard is a presentation layer: React computes no score, threshold,
ranking or suppression decision, and a test asserts the rendered numbers equal
the engine's.

Details: [docs/architecture.md](docs/architecture.md).

---

## Privacy model

The accurate claim, in full:

> **The survey collects no direct identifiers and suppresses small-group
> reporting.**

It is **not** "perfectly anonymous", and the project never says so. Enforced in
code, on the server:

- nothing is calculated below **5 responses** — the gate runs before analysis,
  so no small-group aggregate exists in memory to leak;
- a segment reports only when the segment **and its complement** both reach 5;
- one segmentation dimension at a time — stacked filters are unrepresentable in
  the UI and rejected by the server;
- suppression availability is a boolean, never a group size;
- day-granularity submission dates, and no date at all in any export;
- Q27 has its own endpoint, its own query, its own type and its own export
  file, and is never segmentable;
- Q1–Q3 and Q27 are excluded from the response export, with no opt-in;
- exports refuse below the reporting threshold and are guarded against CSV
  formula injection;
- no respondent browser, no per-person score, no click-through to a person.

Full detail: [docs/privacy.md](docs/privacy.md). What it cannot promise:
[docs/threat-model.md](docs/threat-model.md).

---

## Getting started

Requires Node 20+ (developed on Node 24). Everything below runs locally; a
Cloudflare account is needed only to deploy.

```bash
npm install
npm run validate
```

`npm run validate` runs typecheck → lint → unit tests → build, with no
database, no secrets and no network.

To run it:

```bash
npm run db:migrate:local
npm run admin:hash-passcode
npm run admin:session-secret
cp .dev.vars.example .dev.vars   # paste both values in; never commit this file
npm run build:client
npx wrangler dev
```

Open `http://127.0.0.1:8787/admin`, sign in, complete first-run organization
setup, and create a Pulse. The Pulse detail page gives you the employee link.

For hot reload, `npm run dev` starts Vite on 5173 and proxies `/api` to
`wrangler dev` on 8787. Both must be running.

Optional synthetic development Pulses (this also configures the organization,
so first-run setup will already be done next time you sign in):

```bash
npm run db:seed:local
```

## Self-hosting

Clone → D1 → migrations → two secrets → deploy, in about 15 minutes:
[docs/self-hosting.md](docs/self-hosting.md). Then
[docs/running-a-pulse.md](docs/running-a-pulse.md) for the administrator's
cycle.

**V1 is Cloudflare-only.** That is a stated limitation, not an oversight.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (proxies `/api` to `wrangler dev`) |
| `npm run dev:worker` | `wrangler dev` — Worker + D1 + static assets |
| `npm run build` | Build the client, then validate the Worker bundle |
| `npm run deploy` | Build the client, then `wrangler deploy` |
| `npm run typecheck` | Typecheck the client, Worker, test and E2E projects |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright, against a real Worker and its own throwaway D1 |
| `npm run validate` | typecheck → lint → unit tests → build |
| `npm run admin:hash-passcode` | Generate `ADMIN_PASSCODE_HASH` (prompts; never echoes or stores the passcode) |
| `npm run admin:session-secret` | Generate a 32-byte `SESSION_SECRET` |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations |
| `npm run db:seed:local` | Seed the synthetic development Pulses |
| `npm run fixture:generate` | Regenerate `demo/sample-responses.json` from its fixed seed |
| `npm run analysis:report` | Run the fixture through the whole pipeline and print the result |

`npm run test:e2e` needs browsers once: `npx playwright install chromium`. It
uses its own D1 database in `.wrangler/e2e-state`, recreated empty every run, so
it never touches your development data.

---

## Testing

| Gate | Count |
|---|---|
| Vitest | **713** across 30 files |
| Playwright | **80** |
| Typecheck | 4 TypeScript projects |
| Lint | 0 problems |

The server tests run the real Hono app against real SQLite with the project's
real migrations, seeded from the committed fixture. The E2E suite runs a real
`wrangler dev` Worker serving the real built client, with its own database.

Expected values are computed from the engine inside the tests rather than typed
in, so the assertions check *UI equals engine* instead of restating numbers.

You can verify the engine with no UI at all:

```bash
npm run analysis:report
```

That runs the committed 75-response synthetic fixture through
`responses → scores → aggregation → classification → recommendations → opportunities → privacy`
and prints every output. The numbers it prints are **verification evidence about
the engine, not claims about any real organization**.

---

## Source of truth

The authoritative product, methodology, privacy, scoring and architecture
specification is `AI_Adoption_Pulse_Check_Source_of_Truth_v1.1.md` in the
repository root. Where this code and that document disagree, the discrepancy is
a bug to resolve rather than a licence to change methodology silently.

Version constants are pinned in [`src/core/versions.ts`](src/core/versions.ts):

```text
surveyVersion               1.1.0
scoringVersion              1.1.0
recommendationEngineVersion 1.1.0
```

Every response records the survey version it was collected under, and every
analysis and export identifies all three.

---

## Current limitations

The full list is [docs/limitations.md](docs/limitations.md). The ones most worth
knowing before you use it:

- **Everything is self-report.** Nothing is observed, tested or audited.
- **Thresholds are specified but not pilot-validated.** The 40/50/60/70
  recommendation thresholds, the 60% validity rule, the 20% pain rate and the
  band edges all come from the specification and have not been checked against
  real data. They are the most likely thing here to be wrong.
- **Not anonymous.** See the privacy model above.
- **Segmentation is often unavailable below about 25 employees**, because the
  complement rule refuses it. That is correct behaviour and still a real limit.
- **One administrator credential**, no recovery, no roles, no SSO, no audit log.
- **Closed Pulses cannot be reopened.** Duplicate instead.
- **No trend engine and no benchmarking.** Comparing two Pulses is manual.
- **Cloudflare-only.**

## Deferred

Longitudinal comparison, cross-organization benchmarking, PDF reports, LLM
summarisation or free-text clustering, SSO and roles, HRIS/Slack/Teams
integrations, and host-anywhere packaging. Each was considered and cut with a
reason recorded in [docs/limitations.md](docs/limitations.md#product-scope).

---

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contributions are pilot
evidence, a hole in the privacy model, or wording that overstates what a survey
can prove.

## License

MIT — see [LICENSE](LICENSE).

Created by Mattie Labs.
