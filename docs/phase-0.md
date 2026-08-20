# Phase 0

**Goal:** prove the methodology works correctly before any product UI exists.

Phase 0 is complete when a fixture dataset can be pushed through the whole engine and produce deterministic, tested, privacy-safe output — with no React component and no LLM anywhere in the path.

---

## What Phase 0 implemented

### Repository and tooling

- Vite + React 19 + TypeScript SPA scaffold; Tailwind v4 via `@tailwindcss/vite`; React Router.
- One Cloudflare Worker (Hono) serving both `/api/*` and the built SPA assets.
- Wrangler configuration with D1 binding, SPA fallback, and `run_worker_first` for `/api/*`.
- Three TypeScript projects (client / worker / node) so DOM and Workers globals never collide and the core is typechecked under all three.
- ESLint with a `no-restricted-imports` rule forbidding React, Hono and `cloudflare:*` inside `src/core`.
- Vitest for core logic (plain Node, no plugins), Playwright for the integration smoke test.

### Core methodology (`src/core`)

| Area | Files | Status |
|---|---|---|
| Survey schema | `survey/questions.ts`, `options.ts`, `categories.ts` | Q1–Q28 + Q19b, stable machine ids separate from display copy |
| Validation | `survey/validation.ts` | Zod schema **derived from** the survey definition |
| Scoring | `scoring/*` | All five dimensions, exact V1.1 weights, 60% rule, normalization |
| Classification | `classification/classifyRespondent.ts` | Ordered exhaustive ladder, Levels 4→0 |
| Champion signal | `classification/championSignal.ts` | ≥3 threshold, count hidden below 5 |
| Aggregation | `aggregation/*` | Respondent-first, bands, medians, Unsure rates, diagnostics |
| Recommendations | `recommendations/*` | 10 rules, merge/suppression, ranking, deduplication |
| Opportunities | `opportunities/*` | Explore/Standardize, pain-group denominator, Guardrail banner |
| Privacy | `privacy/*` | Segment + complement suppression, one-dimension rule, export shaping |
| Pipeline | `analysis/runAnalysis.ts` | Suppression → scoring → aggregation → recommendations → opportunities |

### Database

`migrations/0001_initial_schema.sql` creates `organizations`, `pulses`, `custom_questions`, `responses` with foreign keys, status/type enums, day-granularity date checks, JSON validity checks, a unique `public_id` index, and a `responses(pulse_id)` index.

### Worker API

Only `GET /api/health` and `GET /api/version`. That is intentional: the rest of the API surface arrives with the features that consume it, rather than being built speculatively.

### Synthetic fixture

`demo/sample-responses.json` — 75 responses, deterministic from seed `20260818`, regenerated with `npm run fixture:generate`. No real people, no real employer.

---

## What the fixture is designed to exercise

Eight cohorts, each chosen to drive specific paths through the engine.

| Cohort | n | Designed to exercise |
|---|---:|---|
| `builders` | 5 | Level 4 classification, champion signal, R09 |
| `workflow_users` | 10 | Level 3 with corroboration from Q13/Q14/Q15 |
| `heavy_users_weak_safety` | 18 | High adoption + weak verification/review/data-handling → R01, R03, R10 |
| `regular_users` | 18 | Level 2, mid-range everything |
| `interested_non_adopters` | 10 | High interest + low adoption + weak enablement → R04, R07 suppression |
| `explorers` | 8 | Level 1 |
| `non_users` | 4 | Level 0, Not-Assessed paths on Q16/Q17 |
| `partial_responses` | 2 | The 60% validity threshold and typed Not Assessed results |

Work-context assignment is deliberately uneven so the dataset contains **both** reportable and suppressed segments. `legal_compliance` (3) and `product_design` (3) sit below the minimum reporting group on purpose; `it_technology` (12, complement 63) is reportable.

Workflow pain (Q26) and AI use (Q7) are generated from per-category probability models rather than fixed lists, so the Opportunity Map produces a realistic spread — some categories clearly above the 20% pain threshold, some near it, and some clearly below. Three categories land on Standardize, six on Explore, and three earn no label at all.

The data is deliberately imperfect: partial responses, "prefer not to say" answers, "unsure" answers, Not-Assessed dimensions, and contradictions all appear.

---

## Phase 0 analysis output

Produced by `npm run analysis:report`. **These numbers are verification evidence about the engine, not claims about any real organization.**

```text
Responses: 75

Adoption     63    median 71   scored 75/75   not assessed 0
Confidence   49    median 50   scored 66/75   not assessed 9    30.7% "have not done this"
Workflow     39    median 35   scored 75/75   not assessed 0    10.7% unsure
Safety       48    median 48   scored 68/75   not assessed 7    32.0% unsure
Enablement   25    median 23   scored 75/75   not assessed 0    61.3% unsure/unclear

Interest     75    median 75   assessed 73    not assessed 2

Classification
  Level 4  Builder / Champion    5   6.7%
  Level 3  Workflow User        12  16.0%
  Level 2  Regular User         36  48.0%
  Level 1  Explorer             18  24.0%
  Level 0  Non-user              4   5.3%
  Unclassified                   0
  Champion signal: 5 potential champions

Q19b  valid 70, prefer-not-to-say 5, sometimes/often 32 (45.7%)

Recommendations triggered: R01 R02 R04 R05 R06 R09 R10
  R10 merged into R01 rather than taking a separate primary slot
  R03 did not fire — verification and review are not the specific weakness here;
      Q18 data-handling awareness is what pulls Safety down

Top 3 after ranking and deduplication
  1. [P1 POLICY]     R02  Publish clear AI usage guidance          Strong Signal
  2. [P1 SAFETY]     R01  Strengthen safe AI use before expanding  Strong Signal  (+R10 merged)
  3. [P2 ENABLEMENT] R04  Remove organizational barriers           Strong Signal

Additional signals: R05, R06, R09  (primary slots full)

Opportunity Map — Guardrail ACTIVE (Safety 48 < 50)
  Workflow                            Pain    AI use in pain group   Status
  Email and communication            42.7%                  43.8%   Standardize
  Research and finding information   33.3%                  64.0%   Standardize
  Writing documents and reports      41.3%                  45.2%   Standardize
  Meetings and follow-up             29.3%                  36.4%   Explore
  Reviewing or summarizing documents 26.7%                  35.0%   Explore
  Data entry and cleanup             41.3%                  16.1%   Explore
  Spreadsheets and analysis          26.7%                   5.0%   Explore
  Scheduling and coordination        29.3%                   9.1%   Explore
  Customer questions and support     28.0%                  28.6%   Explore
  Presentations                      14.7%                   9.1%   —
  Creating content                    6.7%                   0.0%   —
  Planning and project management    18.7%                   7.1%   —

Privacy
  ALLOWED     department=it_technology       n=12, complement=63
  SUPPRESSED  department=legal_compliance    minimum_group_or_complement_size
  SUPPRESSED  department + role_level        multiple_segmentation_dimensions

Export shaping
  response CSV:  27 columns, 75 rows, no q1/q2/q3/q27
  free-text CSV: 2 columns (row_token, response_text), 17 rows
```

---

## Validation commands

```bash
npm run validate
```

Runs typecheck → lint → unit tests → build.

```bash
npm run test:e2e
```

Playwright smoke tests against `wrangler dev`. Requires `npx playwright install chromium` once, and `npx wrangler d1 migrations apply pulse_check --local` for `/api/health` to report 200 rather than 503.

```bash
npm run analysis:report
```

Prints the analysis above.

### Results at time of writing

| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` | pass |
| `tsc -p tsconfig.worker.json` | pass |
| `tsc -p tsconfig.node.json` | pass |
| `eslint . --max-warnings=0` | pass, 0 problems |
| `vitest run` | **298 passed**, 14 files, 2.9s |
| `vite build` + `wrangler deploy --dry-run` | pass |
| `playwright test` | **7 passed**, 14.7s |
| `git diff --check` | clean |

Test distribution:

| Area | Tests |
|---|---:|
| Survey schema and validation | 51 |
| Scoring (mappings, dimensions, missing data) | 35 |
| Classification (incl. 1,327,104-case exhaustiveness) | 25 |
| Aggregation | 26 |
| Recommendations (rules + engine) | 76 |
| Opportunities | 20 |
| Privacy (segmentation + exports) | 33 |
| Full-pipeline fixture regression | 32 |

---

## Explicitly out of scope for Phase 0

Not built, deliberately:

- employee survey UI;
- personal-result screen;
- admin authentication UI and the PBKDF2/session implementation (Phase 2);
- Pulse creation, duplication, closing, deletion UI;
- admin dashboard, results dashboard, Opportunity dashboard;
- charts, cards, animations, branding, responsive product layouts;
- export download endpoints and UI;
- free-text review screen;
- the public synthetic demo site;
- the remaining API endpoints from spec section 58;
- a migration engine for re-scoring historical responses under a new engine version.

The React application contains only enough to build, route, and prove the Worker/static-asset integration.

---

## Known limitations

1. **Thresholds are unvalidated.** 40/50/60/70, the 60% validity rule, the 20% pain rule and the 40% AI-use rule are implemented exactly as specified but have not been tested against a real pilot. They are named constants in one place each, so revising them is a small change.

2. **Rule thresholds compare raw scores while the UI shows rounded ones.** An organization can display "Safety 50" while R01 fires on 49.94. Evidence carries the raw value; the dashboard will need to show it near boundaries. See `docs/methodology.md`.

3. **`custom_questions` has no maximum-three database constraint.** SQLite cannot express "at most N rows per parent" without a trigger. The limit is enforced in Zod and by the `position BETWEEN 1 AND 3` unique index, which bounds it in practice.

4. **Classification requires Q5 and Q12.** A response missing either returns a typed `{ classified: false, reason: 'missing_required_answers' }` rather than a level. Both are required questions, so this only occurs with partial data. Exhaustiveness is proved over valid combinations, which is what the spec requires.

5. **No version dispatch yet.** Interfaces are shaped so multiple survey/scoring versions can coexist, but nothing branches on version because only 1.1.0 exists.

6. **The E2E suite is a smoke test.** Seven assertions covering asset serving, SPA fallback, API routing, the D1 binding and security headers. Real happy-path coverage arrives with the screens.

7. **Local D1 must be migrated manually** before `/api/health` returns 200.

---

## Notes relevant to Phase 1

Facts, not a plan:

- `runAnalysis(responses, { filters })` is the single entry point the dashboard endpoint will call. It already returns everything spec section 44 lists for the overview, plus the Opportunity Map.
- `SURVEY_QUESTIONS` is ordered and carries `section`, `required`, `maxSelections` and `helperText`, so a section-based survey UI can be driven directly from it without restating anything.
- `answersSchema` is derived from the same definition, so the client can validate a local draft with the exact schema the Worker enforces.
- `calculateScores` and `classifyRespondent` are pure and dependency-free, so the local personal result needs no network call.
- `buildResponseExport` / `buildFreeTextExport` / `buildAggregateExport` return `{ headers, rows, csv }` and an envelope; the export endpoints need only set headers and stream the string.
- `listReportableSegments` returns booleans without counts, so the filter UI can disable unavailable options without leaking group sizes.
- The `.dev.vars` contract for `ADMIN_PASSCODE_HASH` and `SESSION_SECRET` exists and is surfaced as booleans by `/api/health`, so Phase 2 auth has somewhere to land.
