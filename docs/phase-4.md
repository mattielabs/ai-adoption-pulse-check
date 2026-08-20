# Phase 4 — Exports, public demo, release readiness

The V1 finish line. Three protected downloads, a public synthetic demo, the
documentation set, and the audits. No new product surface beyond that.

Phase 4 opened with a methodology **correction**, not a methodology change: see
[changelog.md](changelog.md#v11-implementation-corrections) for the score-band
fix that landed first, in its own commit.

---

## Exports

```text
GET /api/admin/pulses/:id/export/responses.csv
GET /api/admin/pulses/:id/export/free-text.csv
GET /api/admin/pulses/:id/export/results.json
```

All three sit behind the same admin session as the rest of `/api/admin/*`,
applied by the router rather than repeated per route. All three are GET and
side-effect free.

```text
authenticated admin
   ↓  minimum-sample gate           (before any row content is shaped)
   ↓  D1 read                        (Q27 removed in SQL, or Q27 alone)
   ↓  src/core/privacy/exports.ts   (the shaping the unit tests already pin)
   ↓  download headers
```

Nothing is shaped in `routes/adminExports.ts` and nothing is shaped in the
browser. There is one implementation of each rule, in core, and the route turns
its output into a response.

### Response CSV

| Included | Excluded |
|---|---|
| `survey_version` | Q1 department, Q2 role level, Q3 work type |
| Q4–Q26, Q28, Q19b under readable column names | Q27 written response |
| Custom **select** answers (`c1_…`) | Custom **free-text** answers |
| | Every date, including day-level `submitted_on` |
| | Row ids and every other identifier |

Columns are named `q5_work_ai_frequency`, `q19b_unmanaged_tool_use` and so on —
the question id in front so a column traces back to the survey, a readable
suffix so the file is usable without the spec open beside it. Those names are
part of the export contract and are treated like option ids, not like display
copy.

Multi-selects join with `|`. No option id contains one, so splitting is
unambiguous and a spreadsheet will not mistake it for a field separator.

**No date column at all.** Phase 0's shaping kept the day-level `submitted_on`;
V1 is not a timeline analysis tool, so a date would buy nothing while adding a
correlation handle to every row. Rows are shuffled with `crypto.getRandomValues`
before writing, so file order carries no submission-order signal either.

**Custom select answers are included** because the export is otherwise the only
place an administrator would never see the organization-specific questions they
configured — those answers were previously write-only. Custom free text is
excluded for the same reason Q27 is: prose beside twenty-five answers on one row
is exactly the linkage the separate file exists to prevent.

### Free-text CSV

`row_token`, `response_text`, and nothing else. The token is generated per
export and never stored, so two downloads cannot be aligned against each other.
Order is randomised. The path uses the free-text query, which selects Q27 alone.

The Exports screen shows the re-identification warning **before** the download
control, and the word "anonymous" appears exactly once on that screen, in the
sentence denying it.

### Aggregate JSON

The same payload the dashboard renders, unsegmented, wrapped in the version
envelope. A test asserts the exported `data` equals the live results endpoint
field for field — which means the file cannot contain anything the dashboard
would not show, and a reader can check the download against the screen.

A `dimension`/`value` query string on this route changes nothing, because
nothing reads it.

### Gate, authorization, headers

Every export refuses below **5 responses** with `409 insufficient_sample`,
carrying the threshold and the response count and nothing else. The gate runs
before any row content is loaded or shaped: a download must not become the one
place four responses are readable.

Filenames are built from the Pulse name reduced to lowercase letters, digits and
single hyphens — an allowlist rather than an escape list — and the route
re-asserts the pattern before setting `Content-Disposition`. `Q3 "Autumn" Pulse;
2026` becomes `q3-autumn-pulse-2026-responses.csv`.

---

## Public demo

| Route | What it is |
|---|---|
| `/demo` | Landing: what it measures, what it does not claim |
| `/demo/results` | The synthetic organization, in the real dashboard |
| `/demo/survey` | The real survey, local-only |
| `/methodology` | The short public methodology |

```text
GET /api/demo/results
GET /api/demo/results/free-text
```

### It cannot read live data

Not "does not" — cannot, structurally:

- neither handler takes a path parameter, a query parameter or a body;
- neither touches `c.env.DB`;
- `lib/demo.ts` imports no database type and holds no database reference;
- the only data source is `demo/sample-responses.json`, compiled into the
  bundle.

Tests run both endpoints against a `DB` binding that throws on any property
access, and against an environment with no binding at all. Both return 200.
There is no `/api/demo/results?pulseId=…` to add later without deliberately
deleting that property.

### It is the real engine

The fixture goes through the same `runAnalysis` and the same
`buildAnalysisPayload` as a self-hosted Pulse, and comes back in the same
`ResultsResponse` shape — so `/demo/results` renders through the same components
as `/admin/pulses/:id/results`, in `demo` mode, rather than a second dashboard.
A test compares the endpoint against `runAnalysis` over the same fixture.

Demo mode differs only in where the payload comes from and in what it does not
offer: no segmentation control, no exports tab, no administrative action, no
"Back to Pulse".

The analysis is recomputed per request. At 75 responses that is a few
milliseconds, and V1.1 is explicit that aggregate caching is not built until
measurement justifies it.

### Synthetic labelling

**Northstar Services** is fictional. The label appears in a banner on every
demo page, as a badge beside the Pulse name, and in a notice above the
dashboard. No customer, no employer, no client, no adoption number, no outcome
claim — nothing that is not true of a committed fixture of generated responses.

### The sample survey

`/demo/survey` renders the same `PulsePage` as `/p/:publicId`, in `demo` mode:
the same schema, the same sections, the same validation, the same local draft,
and the same core engine computing the personal result in the browser. It
differs in two places — the Pulse is built locally instead of fetched, and
submitting computes the result without posting anything.

An E2E flow records every non-GET request during a full completion and asserts
the list is empty.

Local state is namespaced under the four-character id `demo`. A real public id
is a 128-bit value in twenty-two URL-safe characters, so the demo cannot read or
write a real Pulse's draft, result snapshot or submission marker. There is no
`hasSubmitted` gate — the duplicate marker is part of a real Pulse's privacy
behaviour, and a visitor should be able to retake a sample as often as they
like. A "Take the sample survey again" control clears the draft.

---

## Shared results components

Phase 3 put the dashboard under `src/client/admin/results/`. Phase 4 moved it to
`src/client/results/`, and moved `ui.tsx`, `uiTokens.ts` and `useHeadingFocus`
alongside it, because a public route now renders the same components and a
public page importing from `admin/` would have been a misleading directory
name rather than a boundary.

`ResponsesTab` receives its free-text loader through the outlet context rather
than importing one, so a public page is not one edit away from calling an admin
endpoint.

---

## Documentation

| Document | Covers |
|---|---|
| [README](../README.md) | The two-minute version |
| [methodology.md](methodology.md) | Why every measurement decision is what it is |
| [survey-design.md](survey-design.md) | Why the questionnaire is shaped that way |
| [interpreting-results.md](interpreting-results.md) | How to read a Pulse without over-reading it |
| [privacy.md](privacy.md) | What is collected, what is claimed, what is enforced |
| [threat-model.md](threat-model.md) | What it reduces, and what it cannot promise |
| [self-hosting.md](self-hosting.md) | Clone to first Pulse |
| [running-a-pulse.md](running-a-pulse.md) | The administrator's cycle |
| [architecture.md](architecture.md) | How it is put together |
| [limitations.md](limitations.md) | Every real limitation, in one place |
| [changelog.md](changelog.md) | Methodology history, then implementation phases |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Setup, expectations, and the methodology warning |

---

## Testing

| Gate | Result |
|---|---|
| Vitest | 713 across 30 files |
| Playwright | 80 |
| Typecheck | 4 projects |
| Lint | 0 problems |
| Build + `wrangler deploy --dry-run` | Clean |

New in Phase 4: `tests/server/exportApi.test.ts` (28) and
`tests/server/demoApi.test.ts` (13) run the real Hono app against real SQLite;
`e2e/exports.spec.ts` and `e2e/demo.spec.ts` (19) drive a real browser, with the
export flows asserting the **downloaded file** through Playwright's download API
rather than an intercepted fetch.

The export assertions are deliberately written against bytes rather than against
the shaping helpers. A helper that behaves correctly while the route hands out
something else is exactly the failure that matters.

---

## Performance

Median of 20 runs, Node 24, after the Phase 4 DTO and export changes:

| Responses | Analysis + DTO | Response CSV | Free-text CSV |
|---|---|---|---|
| 75 (fixture) | 2.1 ms | 0.7 ms | <0.1 ms |
| 500 (V1 ceiling) | 8.6 ms | 4.5 ms | 0.1 ms |

Nothing here justifies a cache, and none was added. The exports are cheaper
than the analysis they sit beside, which is what you would expect from
shaping rows that have already been read.

---

## Known limitations

Consolidated in [limitations.md](limitations.md). The ones Phase 4 introduced or
made concrete:

1. **Custom free-text answers are collected and never exported.** They are
   stored, validated and shown nowhere. Excluding them was the conservative
   choice; a fourth export file was not worth the surface in V1.
2. **The demo recomputes on every request.** Correct at this scale and
   deliberately not cached, but it is work done per visitor on a public
   endpoint.
3. **The demo fixture is bundled into the Worker**, which adds roughly 120 KB to
   the upload.
4. **Exports are always whole-Pulse.** Selecting a segment does not scope a
   download; the Exports screen says so.
5. **No GitHub link on the demo.** There is no remote yet, and a broken link
   would be worse than none.
