# Running a Pulse

The administrator's cycle, once the deployment exists. For setup see
[self-hosting.md](self-hosting.md); for reading the output see
[interpreting-results.md](interpreting-results.md).

---

## 1. Create the Pulse

`/admin/pulses` → **Create Pulse**.

**Basics**

| Field | Notes |
|---|---|
| Name | Shown to employees. "Q3 AI Adoption Pulse" reads better than "Pulse 2" |
| Description | Optional |
| Opens on | Before this date the link says "not yet open" |
| Closes on | Optional. After it, the link stops accepting responses |

**Configuration**

- **Personal results** — whether an employee sees their own scores after
  submitting. Calculated in their browser, stored only in their browser, and
  never sent back. It measurably helps participation; turn it off if your
  organization would read it as scoring people.
- **Custom questions** — up to three, single-select, multi-select or free text.
  They are never scored and never affect any recommendation.

A warning about custom questions: Q1–Q3 are deliberately broad so that no single
answer narrows the group much. A custom question asking "which team are you on?"
in a 40-person company undoes that, and no privacy control downstream can
recover it. Ask about work, not about which small group somebody belongs to.
Custom **free-text** answers are collected but never exported, for the same
reason Q27 gets its own file.

**Review** shows exactly what employees will see, including the privacy notice.

---

## 2. Share the link

The Pulse detail page shows the employee link — `/p/{publicId}` — with a copy
button. The id carries at least 128 bits of cryptographic randomness, so it is
not guessable, and an invalid id returns the same 404 as one that never existed.

Practical advice for the announcement:

- say who is asking and what will happen with the results;
- quote the privacy claim rather than paraphrasing it: *"the survey does not ask
  for your name, email or employee ID, and results are only shown for groups
  that meet the minimum reporting threshold"*;
- do **not** say the survey is anonymous — it is not, and one written answer can
  make that obvious;
- say the work-context questions are optional, because they are;
- give a completion estimate of 7–10 minutes;
- say what a low score would lead to. People answer differently when they think
  the result might be used against them, and they are right to.

Employees need no account and no login. Answers are drafted in their browser and
sent only when they submit; nothing partial reaches the server.

---

## 3. While it is open

The Pulse list shows the response count and state. Results become available at 5
responses, with an early-directional caution up to 9.

Some fields are locked once the first response arrives — the survey version and
anything that would change what an answer means. The API refuses a request that
so much as mentions a locked field, rather than silently ignoring it. Name,
description and dates stay editable.

**How many responses do you need?** Enough for the segments you care about.
Organization-level results are usable from about 10. Departmental segmentation
needs 5 in the group *and* 5 outside it, which in practice means about 15
responses before any department reports.

---

## 4. Close it

**Close Pulse** stops new submissions and preserves the analysis and the
exports. It is **irreversible** in V1 — there is no reopen. If you need to
collect more, duplicate instead.

---

## 5. Read the results

`/admin/pulses/{id}/results`. Suggested order in
[interpreting-results.md](interpreting-results.md).

Tabs: Overview, one per dimension, Opportunities, Written responses, Exports.

---

## 6. Export

The **Exports** tab offers three files, each shaped and gated on the server:

| File | For |
|---|---|
| Response CSV | Your own analysis. Privacy-limited: no work context, no written answers, no dates, no row ids |
| Written responses CSV | Reading Q27 outside the app. Text and a per-file token, nothing else |
| Aggregate results JSON | Archiving the analysis with its engine versions |

All three require the minimum sample. Once a file is on a laptop it is outside
the product's privacy model — see
[threat-model.md](threat-model.md#export-specific-risks).

---

## 7. Act, then repeat

The output of a Pulse is a decision about what to investigate, not a plan. A
reasonable next step is two or three conversations with people who do the
workflows the Opportunity Map surfaced.

**Duplicate as new Pulse** copies the configuration, custom questions and
branding, and copies **no** responses and no analysis. Run it again after
something has actually changed — a quarter, a policy, a rollout. V1 has no trend
engine, so comparison is manual; the aggregate JSON export is the sensible thing
to keep for that.

---

## 8. Deleting

**Delete Pulse** removes the Pulse, its custom questions and its responses,
behind an explicit destructive confirmation. There is no soft delete and no
recovery. Retention is the self-hosting organization's decision — see
[privacy.md](privacy.md#for-self-hosters).

---

## Shared devices

If personal results are enabled, an employee's result is stored in their
browser. The result screen offers **Clear my result from this browser**, which
removes the local copy and leaves both the submitted response and the duplicate
marker in place — so clearing does not let somebody retake the survey. Worth
mentioning if people share machines.
