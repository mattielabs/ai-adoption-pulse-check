# Phase 3 — Organization results and discovery dashboard

**Goal:** an administrator opens a Pulse with enough responses and can answer
three questions — what is happening, what matters most, and what should we
investigate next — without reading the methodology docs first.

Phase 3 adds no methodology. It is a presentation layer over the engine Phase 0
built and Phase 0's tests pin. The dashboard's job is to be honest about what
the numbers mean.

---

## Architecture

```text
D1 responses          (answers only; Q27 removed in SQL)
   ↓  parse + validate against the stored-answers schema
   ↓  runAnalysis(responses, { filters })      ← the Phase 0 engine, unchanged
   ↓  buildAnalysisPayload(...)                 ← explicit core → DTO mapping
   ↓  privacy-safe JSON
React dashboard        (formats; computes nothing)
```

React never calculates a score, mean, median, band, threshold, recommendation,
ranking, opportunity status, or suppression decision. It rounds for display and
resolves option ids to labels using the same survey schema the server scored
against. That is the whole of its arithmetic.

### The DTO boundary

`OrganizationAggregate` carries a `respondents` array with per-person scores,
classifications and row ids. It must never reach a browser, so the mapping in
`src/core/results/buildResults.ts` is written **field by field** rather than
spread. A field added to the core aggregate later is invisible to the API until
somebody deliberately maps it, and a test asserts the exhaustive key set of the
response.

### Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/pulses/:id/results` | the whole dashboard, one analysis pass |
| `GET /api/admin/pulses/:id/results/free-text` | Q27, isolated |

Both sit behind the Phase 2 admin session, applied by the router rather than
repeated per route, and both are read-only.

One payload serves every tab because every view is derived from the same
analysis over the same responses; an endpoint per card would re-read and
re-analyse the same rows several times to render one screen. Segment
availability travels with that payload, so there is no separate `/segments`
call.

### Data-access separation

Two queries, deliberately unable to produce the same row twice:

```sql
-- analysis: free text removed by the database itself
SELECT id, submitted_on, survey_version,
       json_remove(answers_json, '$.q27') AS answers_json
FROM responses WHERE pulse_id = ?

-- free text: nothing else, in random order
SELECT json_extract(answers_json, '$.q27') AS text
FROM responses WHERE pulse_id = ? AND ... ORDER BY random()
```

Q27 is not consumed by scoring, aggregation, classification, the recommendation
engine or the Opportunity Map — verified, and asserted by a test that runs the
whole pipeline with and without free text and requires byte-identical output.
So it is stripped at the data layer rather than filtered later.

---

## Minimum sample and early direction

| Responses | Behaviour |
|---|---|
| 0–4 | `status: "insufficient_sample"`. **Nothing is computed.** The payload has three keys: `status`, `pulse`, `sample`. |
| 5–9 | Full results, plus `earlyDirectional: true` and the caution banner. |
| 10+ | Normal presentation. |

The gate runs **before** analysis, not after: below the threshold no aggregate
exists in memory at all, so there is nothing for a later refactor to serialize
by accident. The browser never receives hidden results to obscure, and a test
asserts the response body contains no `dimensions`, `recommendations`,
`opportunities` or `mean` at n=4.

Free text is gated on the same threshold.

---

## What the dashboard shows

**Overview** — the five dimensions, then the top priorities, then the
distribution behind the averages, then barriers, training and the opportunity
summary. Recommendations sit near the top rather than beneath an analytics
wall, because "what should we investigate next" is the question the product
exists to answer.

**Each dimension** carries mean, median, band, band distribution, scored and
not-assessed counts, and the relevant Unsure/unclear rate with its basis. Scores
display to **one decimal place**: a Safety of 49.94 rendered as "50" would
contradict the recommendation beside it. Rounding happens at the last moment;
thresholds are never compared against a rounded value.

**Dimension detail** adds the question-level breakdown:

| View | Beyond the score |
|---|---|
| Adoption | Q5 work use, Q4 general use side by side, tools, use cases. Q4 is labelled diagnostic-only; breadth of tools is explicitly not maturity. |
| Confidence | Q8–Q11, labelled self-reported, with "nothing here was tested" stated on the page. |
| Workflow | Q12–Q14, plus Q15 artifacts marked never scored. |
| Safety | Q16–Q18, the asymmetric caveat, and Q19b framed neutrally. Q19 is **not** here — it belongs to Enablement. |
| Enablement | Q19–Q22, Unsure rates, and reported barriers, framed as the support employees experienced. |

**Recommendations** come from the engine in its ranking, already merged and
deduplicated. Each card shows priority and what that priority means, the
confidence label, *what we found* (only the conditions that actually fired, each
with its measured value beside its threshold), *why it matters*, the recommended
action, and the measurable evidence. Merged findings — R10 folded into R01, for
instance — appear inside the card that absorbed them rather than as a second
near-identical card. Nothing is generated: the standing rationale is a fixed
string per rule, and every number comes from the engine.

**Opportunity Map** shows the shared Q7/Q26 categories with pain count and rate,
AI use **among the pain group**, and Explore / Standardize / below-threshold.
Guardrail is one organization-wide banner driven by the Safety score, never a
per-row label. Enable and Scale do not exist. Each labelled row can expand to
its meaning, its next discovery action, and an explicit statement that this does
not establish automation feasibility, time savings, or return on investment.

**Written responses** are Q27 and nothing else (below).

### Charting decision

There is no chart library. Every figure on the dashboard is a count or a
proportion, and a real `<table>` with a CSS-width bar in one column communicates
that as well as a canvas would while staying readable by assistive technology,
selectable, printable, and free of a dependency. The bar is decoration on a row
that already carries its number; it is never the only representation.

---

## Segmentation privacy

One dimension at a time — Department, Role level, or Work type. The control has
one "group by" select and one segment select, and changing the dimension clears
the segment: **stacked filters are unrepresentable in the UI**, not merely
disabled. The server enforces the same rule regardless, and a hand-made request
naming two dimensions is refused with `multiple_segmentation_dimensions`.

A segment is reportable only when the segment **and its complement** both have
at least five respondents. The complement check is the one people forget:
"Managers, 18 of 20" also reveals the two non-managers by differencing.

When a segment is suppressed the response carries no aggregate at all — not a
partial one, not a zeroed one. The suppressed variant has `status`, `pulse`,
`reason` and the segmentation options, and nothing else.

Availability is exposed as **booleans only**. An unavailable option is disabled
and labelled "not enough responses to report safely", never explained with a
count: "only 3 respondents" would defeat the suppression it is explaining.

---

## Free text

Q27 has its own endpoint, its own query, and its own type. The response is a
list of **plain strings** with a sample state — no id, no submission date, no
department, role or work type, no scores, no classification, no other answers.

It is **never segmentable**. The endpoint accepts no filter argument at all, so
a filter is not refused so much as inexpressible; a test confirms that adding
query parameters changes nothing. There is no filter control on that tab.

Order is randomised per request, because insertion order is submission order and
that is a weak timing signal.

Text is rendered as text. React escapes it, nothing on the page interprets
markup, and no model reads it. The prominent warning states that written
responses may contain identifying information the employee chose to include.

---

## No raw respondent browser

There is no respondent table, no per-person detail, no answer viewer, no
per-person score, and no click-through from any figure to a person. The champion
signal is organization-level and shows a display string, never a list. This is
an aggregate discovery product; a respondent browser would contradict the
privacy model it is built on.

---

## Failure handling

| Situation | Response |
|---|---|
| Pulse not found | 404 `pulse_not_found` |
| Fewer than 5 responses | 200 `insufficient_sample`, no analysis |
| Suppressed segment | 200 `suppressed`, no aggregate |
| Responses under an unsupported survey version | 500 `analysis_failed` / `unsupported_survey_version` |
| Mixed survey versions in one Pulse | same — never silently averaged |
| Corrupt stored answers | 500 `analysis_failed` / `corrupt_response` |

A corrupt row fails the whole request rather than being dropped, because
silently dropping one would change every denominator on the page without saying
so. Logs record the Pulse id and the failure class only — never answer content.

### Incomplete is not corrupt

Stored responses are validated on read against `storedAnswersSchema`, which is
the submission schema with one difference: it does not require completeness.
`SurveyAnswers` types every field optional precisely because a stored response
may be missing one, and the scoring engine has explicit missing-data handling
with a 60% validity rule. Re-applying the submission-time completeness check on
read would make a Pulse containing a single partial response impossible to
analyse — the committed fixture contains two such responses on purpose.

Everything else stays strict: an unknown question id, a wrong type, an option id
that does not exist, or an over-long selection list still fails, because those
mean the row was not written by this application.

---

## Performance

Measured locally, including JSON parse, validation, the full analysis pipeline
and the DTO build (median of 20 runs, Node 24):

| Responses | Median | Range |
|---|---|---|
| 75 (canonical fixture) | 3.8 ms | 2.5–15.5 ms |
| 500 (V1 target ceiling) | 17.4 ms | 15.4–27.3 ms |

Analysis is computed on read, as V1.1 intends. Nothing here justifies a cache,
and no cache was added: an aggregate cache would buy nothing measurable and cost
an invalidation problem, a second copy of derived respondent data, and ambiguity
about which engine version produced a stored result.

---

## Testing

The results API tests run the real Hono app against real SQLite with the real
migrations, seeded from the committed fixture, and assert the dashboard's
numbers equal the engine's. The Phase 0 pipeline-regression test pins the same
values from the other direction, so a reshape that quietly moved a number would
fail both.

The E2E flows provision three Pulses from the canonical fixture through the real
employee submission endpoint — 73 responses (the two deliberately incomplete
fixture rows are rejected by the submission schema, as they should be), 7, and 3
— and then assert the rendered page matches what `runAnalysis` produces for that
exact set. Expected values are computed in the spec rather than typed in, so the
tests check UI-equals-engine rather than restating numbers.

---

## Known limitations

1. **Segmentation applies to the whole analysis or none of it.** Selecting a
   segment re-runs the engine over that group, so dimensions, classifications,
   barriers, training and the Opportunity Map all reflect it. Free text never
   does.
2. **No export UI.** The shaping utilities exist from Phase 0; the download
   surface is Phase 4.
3. **No trend or benchmark comparison.** V1 has no longitudinal engine.
4. **Band edges use whole-number rounding.** Phase 0 assigns a band from the
   score rounded to a whole number while the dashboard displays one decimal, so
   a score of 24.87 shows as "24.9" in the Emerging band, whose range starts at
   25. This is inherited Phase 0 behaviour, affects only scores within half a
   point of a boundary, and was left unchanged because Phase 3 is not a
   methodology phase. Flagged rather than fixed.
5. **The champion signal shows a display string** ("3+ potential champions"
   below five), never an exact small count.

---

## Deliberate Phase 4 exclusions

CSV response export, free-text export, aggregate JSON download, the polished
public synthetic demo, PDF reports, longitudinal comparison, benchmarking,
GitHub publication, and production deployment.
