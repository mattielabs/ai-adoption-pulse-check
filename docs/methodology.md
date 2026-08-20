# Methodology notes

This is a summary of the decisions that shape the code. It does not restate the source of truth — see `AI_Adoption_Pulse_Check_Source_of_Truth_v1.1.md` for the full specification, including every mapping table.

---

## Five dimensions, no combined score

| Dimension | Inputs | Weights |
|---|---|---|
| Adoption | Q5 work AI frequency, Q7 breadth of use | 70 / 30 |
| Confidence | Q8–Q11 | equal (25 each) |
| Workflow | Q12 behaviour ladder, Q13 reuse, Q14 process redesign | 50 / 25 / 25 |
| Safety | Q16 verification, Q17 human review, Q18 data-handling awareness | 40 / 30 / 30 |
| Enablement | Q19 approved tools, Q20 policy, Q21 access, Q22 training | 20 / 30 / 20 / 30 |

There is **no single AI maturity score**. One average would hide the differences the product exists to surface. An organization at Adoption 72 / Safety 38 and one at Adoption 45 / Safety 65 might average identically while needing opposite interventions.

Interest (Q28) is reported separately and is **not** a sixth dimension.

---

## Confidence is self-report

This dimension was called *Capability* in V1.0 and was renamed in V1.1 specifically so nothing in the code or UI can imply it measures demonstrated skill.

**It measures self-reported confidence using and evaluating AI.** It does not measure competence, proficiency, or capability. A respondent who has never seen an AI hallucination can be highly confident evaluating output and be wrong.

Practical consequences in the code:

- the identifier is `confidence` everywhere, never `capability` or `skill`;
- "I have not done this" is `NOT_ASSESSED`, not zero — never having attempted something is not the same as being unconfident at it;
- the aggregate always reports the "I have not done this" rate beside the score.

---

## Safety is self-report, and asymmetric

**Safety measures self-reported verification, review and data-handling awareness.** It is not a compliance audit and not a measure of verified safe behaviour.

The interpretation rule is asymmetric and must be stated wherever the score appears:

> **A low Safety score is a meaningful risk signal. A high Safety score is not proof that behaviour is actually safe.**

Self-reported review behaviour reliably skews high — people report reviewing AI output more carefully than they do. That is why a high score earns no conclusion while a low score earns a Priority 1 recommendation.

Q19 (approved-tool clarity) is deliberately **not** part of Safety. It measures what the organization supplied, so it belongs to Enablement. Q19b (unmanaged tool use) is diagnostic only and never scored, though the recommendation engine uses it as evidence.

The Q18 "Unsure" rate is always shown beside the Safety score.

---

## "Unsure" is handled explicitly, and never as 50

Unknown data is never silently mapped to the scale midpoint. Each option is classified deliberately:

| Option | Treatment | Why |
|---|---|---|
| Q8–Q11 "I have not done this" | **Not Assessed** | Not attempting something is not low confidence |
| Q14 "Unsure" | **Not Assessed** | The respondent does not know whether a process changed |
| Q16/Q17 "Not applicable" | **Not Assessed** | The behaviour genuinely does not apply to their work |
| Q18 "Unsure" | **0** | Not knowing what must not be entered into AI *is* the risk |
| Q19 "Unsure" / "not defined" | **0** | Guidance the employee cannot find is not enabling them |
| Q20–Q22 "Unsure" | **0** | Same reasoning |
| Q28 "Unsure" | **Not Assessed** | Interest is genuinely unknown |

The `Unsure = 0` choices are the harshest decision in the methodology, so every dimension that contains one reports its Unsure/unclear rate alongside the score. An Enablement score of 25 with a 61% unclear rate tells a very different story from 25 with a 5% unclear rate, and the dashboard must never show one without the other.

---

## Missing data: the 60% rule

A dimension is calculated only when at least **60% of its intended weighting** carries a valid scored response.

- Above the threshold, legitimate Not-Assessed inputs are excluded and the **remaining weights are normalized**. Without normalization, excluding an input would silently drag the score toward zero — the opposite of what "not assessed" means.
- Below the threshold, the result is a typed **Not Assessed**, never `0`, `NaN`, or an unexplained `null`.

"We do not have enough information" and "this organization scored zero" are different findings, and the type system keeps them apart: `DimensionScore` is a discriminated union on `assessed`, so a caller cannot read `.score` off an unassessed result.

Every result also carries which inputs were scored, which were Not Assessed, and which were simply missing.

### Worked example

Safety with Q16 answered "Not applicable":

```text
Q16 (0.40)  Not Assessed  -> excluded
Q17 (0.30)  Always = 100
Q18 (0.30)  Somewhat = 50

valid weight = 0.60  ->  exactly at the threshold, which is inclusive
score = (100 x 0.30 + 50 x 0.30) / 0.60 = 75
```

Unnormalized this would have been 45, and the organization would appear meaningfully less safe purely because one question did not apply to some respondents.

---

## Aggregation order

Respondent scores are computed **first**, then averaged. Organization scores are never computed by pooling raw answer points.

Pooling first would let a respondent who answered more questions carry more weight than one who answered fewer, which turns partial completion into a silent weighting factor.

---

## Classification is ordered and exhaustive

Rules are evaluated strictly from Level 4 down to Level 0. First valid match wins.

| Level | Name | Requires |
|---|---|---|
| 4 | Builder / Champion | Q12 = built workflows/tools **and** corroborating Q15 evidence |
| 3 | Workflow User | Q12 = reuse or repeatable **and** corroboration from Q13, Q14 or Q15 |
| 2 | Regular User | Q5 ≥ a few times per month **and** Q12 ≥ regular individual tasks |
| 1 | Explorer | any work AI use or experimentation not qualifying above |
| 0 | Non-user | Q5 = Never, Q12 = no use, and no contradictory Q15 evidence |

**Contradictory but valid responses fall to the most conservative matching level rather than becoming unclassified.** Someone who claims repeatable processes but reports never reusing anything, no changed process and no artifact lands at Level 2, not Level 3. Someone who reports never using AI but also reports having built an AI agent lands at Level 1, not Level 0.

Exhaustiveness is enforced by a generated test walking all 1,327,104 valid Q5 × Q12 × Q13 × Q14 × Q15 combinations, asserting each resolves to exactly one level and that every level and every ladder rule remains reachable.

---

## Recommendations are deterministic

Ten rules, no LLM. Each returns structured data — the conditions it evaluated, the measured values, the thresholds compared against, and the evidence — never UI markup.

Priorities: 1 Guardrail/Risk, 2 Adoption Blocker, 3 Improvement/Discovery, 4 Internal Opportunity.

Output is capped at **3 primary recommendations plus up to 3 additional signals**, because a dashboard listing nine things to fix prioritises nothing.

Three constraints produce that cap, applied over a ranked list:

1. one primary per family (SAFETY, POLICY, ENABLEMENT, CONFIDENCE, WORKFLOW, DISCOVERY, CHAMPIONS);
2. no more than two primaries resting on the same root evidence question — the backstop that stops future rule additions from recreating recommendation flooding;
3. at most three primaries.

Cross-rule relationships are applied **before** ranking:

- **R03 → R01**: when overall Safety is already low, a verification weakness is a sub-finding of the broader safe-use recommendation, not a second Priority 1 slot.
- **R10 → R01**: unmanaged-tool reliance becomes a supporting finding of R01.
- **R07 ← R04**: interest-not-converting is suppressed when weak Enablement already explains the adoption gap.

The spec says R10 "may" merge into R01. The engine always merges, because a deterministic engine cannot have a "may".

### Ranking

Priority ascending, then larger gap from threshold, then greater proportion of respondents affected, then lower rule id. The final tie-break exists so identical measurements always produce identical order.

### Confidence labels

Only three, all qualitative: **Strong Signal** (multiple supporting measures, n ≥ 10), **Signal** (one clear rule, n ≥ 10), **Early Signal** (5 ≤ n < 10).

The engine never invents a statistical confidence percentage. A self-report survey of 40 people does not support one, and a number would imply precision the data does not have.

Below n = 5 the engine returns `insufficient_sample` and produces nothing.

---

## Thresholds compare the raw score, not the displayed one

Scores are held at internal precision and rounded only for display. Rule thresholds compare the raw value.

This means an organization can display "Safety 50" while R01 fires on "Safety is below 50", because the raw value is 49.94. That looks like an inconsistency, so the evidence attached to every recommendation carries the raw measured value, and the dashboard shows scores to one decimal place so the number beside a recommendation is not itself misleading.

The alternative — thresholding on the rounded score — would double-round and make the result depend on display formatting. Comparing the measurement is the more defensible of the two.

**Score bands follow the same rule.** The V1.1 table lists bands as whole-number ranges (0–24 Low, 25–49 Emerging, 50–69 Developing, 70–84 Established, 85–100 Strong); scores are continuous, so those are read as the half-open intervals `<25`, `<50`, `<70`, `<85`, `85–100` and matched against the raw value. An earlier implementation rounded to a whole number first, which quietly moved every boundary down by half a point — 24.87 displayed as "24.9" and banded as Emerging, a band that starts at 25. Corrected before Phase 4; boundary tests now cover immediately below, exactly at, and immediately above each edge.

---

## Opportunity Map: the denominator is the point

Q7 ("what do you use AI for") and Q26 ("what takes significant time") share the same 12 workflow categories. That alignment is **by construction**, not by a mapping table, and a module-load assertion fails the application if the two question definitions ever drift apart.

For each shared category:

```text
pain count            respondents reporting that workflow as repetitive
pain rate             pain count / respondents who answered Q26
AI use among pain     of THAT pain group, how many report using AI there
```

**Current AI usage is measured among the respondents who reported that same workflow as painful** — never against a global usage percentage. Using an organization-wide AI-use figure would let heavy AI use in one area imply AI use in an unrelated painful one.

The regression test makes the difference concrete: 20 people report data-entry pain and only 2 of them use AI for it, while 50 other people use AI for data entry without finding it painful. The correct pain-group denominator gives 10% → **Explore**. A global denominator would give 52% → **Standardize**, the opposite conclusion.

### Two labels only

| Label | Trigger | Meaning |
|---|---|---|
| **Explore** | pain ≥ 20% and AI use among that group < 40% | Real friction, little AI use — interview and map the process first |
| **Standardize** | pain ≥ 20% and AI use among that group ≥ 40% | Already using AI and still finding it repetitive — look at shared prompts, templates, process guidance |

V1.1 **removed** per-workflow Enable, Scale and Guardrail labels. A single question about workflow pain cannot support a claim that a workflow is ready to scale. Guardrail survives only as **one organization-wide banner** when Safety < 50.

---

## Privacy thresholds

`MIN_REPORTING_GROUP = 5`, applied to **both** the segment and its complement:

```text
segment n >= 5  AND  complement n >= 5
```

The complement check is the one people forget. With 20 respondents and 18 managers, showing the managers' segment also reveals the two non-managers by differencing, even though the displayed group is comfortably large.

V1 permits **one** filter dimension at a time — department, role level, or work type. Stacked filters are **rejected**, not silently truncated to the first: a caller asking for a stacked filter must be told no. Two demographic filters on a 30-person organization reliably produce identifiable groups.

A suppressed request returns exactly:

```json
{ "suppressed": true, "reason": "minimum_group_or_complement_size" }
```

No counts, no partial view, no underlying aggregate. Suppression is applied before the aggregate is computed, so there is nothing to leak.

Small-segment data must never be sent to the browser and merely hidden visually.

---

## Export restrictions

Three separate representations:

1. **Limited response CSV** — scored and diagnostic answers under readable column names (`q5_work_ai_frequency`, `q19b_unmanaged_tool_use`, …), `survey_version`, and organization-specific **select** answers. Excludes Q1–Q3, Q27, custom free text, row ids, and every date — including the day-level `submitted_on` the database stores, because V1 is not a timeline tool and a date is one more correlation handle. Multi-selects join with `|`. Rows are shuffled with a cryptographic source so export order carries no submission-order signal. Labelled *limited response export*, never "fully anonymous data".
2. **Free-text CSV** — Q27 text and a per-export row token. No department, role, work type, other answers, or date. The token is generated at export time and never stored, so it cannot be linked back.
3. **Aggregate JSON** — the unsegmented organization analysis, stamped with all three engine versions. The builder takes an already-checked aggregate rather than raw responses, so there is no code path from raw rows to an export that skips the privacy checks; a test asserts the exported payload equals the live results endpoint field for field.

V1 deliberately offers **no** row-level Q1–Q3 export. A self-hoster with database access technically controls their infrastructure, but the product should not ship a convenient re-identification path.

Every export refuses below the five-response reporting threshold, and the gate runs before any row content is loaded or shaped — a download must not become the one place four responses are readable.

Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with a single quote and wrapped in double quotes, so a spreadsheet treats them as literal text rather than a formula.

---

## What this survey cannot tell you

Stated plainly because it is part of the product:

- It does not measure actual employee AI competence.
- It does not verify that behaviour is safe.
- It is not a compliance assessment.
- It does not measure ROI.
- It does not establish readiness for automation.
- It cannot prevent a respondent from identifying themselves in free text.
- It cannot prevent a manager who already knows a unique situation from recognising it.

Survey findings are directional evidence about where to look next. The Opportunity Map identifies workflows worth a discovery interview; it does not conclude the interview.

---

## Documented interpretations

Places where the specification left room and the implementation had to choose. Each is a candidate for pilot validation.

| Decision | Choice | Reasoning |
|---|---|---|
| Q7 breadth counting | All selected options except the `no_work_ai_use` sentinel count, including "Other" | "Other" is a real AI use; the spec lists it under usage categories |
| Q7 contradiction | `no_work_ai_use` forces breadth 0 regardless of other selections | The spec fixes this option at 0; resolving deterministically beats rejecting a valid response |
| Empty Q7/absent Q7 | Treated as **missing**, not breadth 0 | A non-user selects the explicit "I do not use AI" option, which does score 0 |
| Level 3 "reusable system/artifact" | The six artifact options, excluding `documentation_training` and `helped_coworkers` | Those two are enablement of other people, not a reusable system the respondent runs on |
| Level 0 "contradictory Q15 evidence" | Same six artifact options | Helping a coworker does not contradict reporting no personal AI use |
| Champion "Q12/Q15 corroboration" | Q12 ∈ {repeatable processes, built} **or** any Q15 artifact/enablement option | All three score inputs are self-reported, so behavioural corroboration is required |
| Enablement unclear rate | Share of respondents choosing any unclear option across Q19–Q22 | A respondent-level rate is what an admin can act on |
| Pain-rate denominator | Respondents who answered Q26, including "none of these" | Excluding them would inflate every pain rate |
| Ranking gap for multi-condition rules | The gap of the primary deficiency being fixed | The magnitude of the problem, not of the qualifying condition |
| "Supporting measures" for Strong Signal | Corroborating measures beyond the primary trigger, counted per rule | Counting trigger conditions would make every two-condition rule automatically Strong |
| R10 merge into R01 | Always merged when both fire | The spec says "may"; a deterministic engine cannot have a "may" |
