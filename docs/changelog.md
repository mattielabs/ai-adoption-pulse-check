# Changelog

Two kinds of change are recorded here: **methodology** decisions, which change
what a number means, and **implementation** phases, which change what exists.
They are separate on purpose — the V1.1 methodology review happened before any
code was written, and the deletions it made are part of the engineering story
rather than something to tidy away.

This is not a commit log.

---

## Methodology

### V1.0 → V1.1 — pre-implementation review

An independent second-opinion review, completed before the first line of code.
It did not change the product concept; it corrected measurement, privacy,
recommendation logic and architecture, and made the product **smaller**.

**Measurement**

- Renamed **Capability → Confidence**, and defined it explicitly as
  self-reported rather than demonstrated. The survey cannot measure capability;
  the name implied it could.
- Reframed **Safety** as self-reported behaviour and awareness, with an
  asymmetric interpretation rule: a low score is a warning signal, a high score
  is not proof.
- Removed **Q4** from Adoption scoring — general AI use is not work AI use, and
  the two side by side are more informative than an average.
- Simplified Confidence to equal weighting across Q8–Q11.
- Removed **Q15** from Workflow scoring; it became classification evidence.
- Removed **Q19** from Safety; it belongs to Enablement.
- Separated **Q18** (respondent awareness) from **Q20** (organizational
  guidance), so a recommendation can tell "nobody knows the rule" from "there is
  no rule".
- Simplified weights across every dimension.
- Added `Unsure`-rate reporting beside every score that has one.

**Survey**

- Rewrote **Q12** as a true ordinal ladder; moved "helping coworkers" to Q15,
  because helping a colleague is a different axis from building an automation,
  not a later stage of it.
- Added plain-language examples to Q15.
- Aligned **Q7 and Q26** around one shared workflow-category list, making the
  Opportunity Map comparison exact by construction rather than by a mapping
  table.
- Added **Q19b** for independently accessed / unmanaged AI tools, with
  deliberately neutral wording.
- Kept **Q27** free text, because it is central to discovery value even though
  it is the highest-risk field.

**Recommendations**

- Reduced overlapping rules to **10 outcomes**. An earlier draft could fire ten
  near-identical recommendations, which is how a report becomes unreadable.
- Merged tool / data / policy clarity into one guidance recommendation.
- Merged access / training / support blockers into one enablement
  recommendation.
- Made verification weakness a sub-finding of the broader Safety rule when that
  rule already fired.
- Added unmanaged-tool reliance as a first-class risk signal.
- Added a root-evidence duplication backstop, so a future rule cannot recreate
  the flooding.

**Opportunity Map**

- Removed per-workflow **Enable**, **Scale** and **Guardrail** labels — survey
  evidence cannot support per-workflow readiness claims.
- Kept only **Explore** and **Standardize**.
- Added a single organization-wide Guardrail banner driven by the Safety score.

**Privacy**

- Replaced perfect-anonymity language with no-direct-identifier language.
- Added **complement suppression**: a segment of 18 out of 20 also describes the
  other two.
- Removed stacked demographic filters.
- Changed submission timestamps to **day granularity**.
- Removed Q1–Q3 from the default row-level CSV, and removed the V1 option to
  opt back in.
- Split Q27 into a standalone free-text export.
- Required a privacy threat-model document.
- Clarified the infrastructure-metadata limitation.

**Architecture**

- Replaced Next.js plus a separate API Worker with one Vite/React SPA served by
  one Hono Cloudflare Worker.
- Removed the `pulse_aggregates` table — analysis is computed on read.
- Removed generic `organization_settings`; known settings live in
  `organizations`.
- Added Zod as the API validation layer.
- Defined a minimum public-release security floor.

### V1.1 implementation corrections

Corrections to how V1.1 was implemented, not to what V1.1 says.

- **Score bands are assigned from the raw score.** `bandForScore` rounded to a
  whole number first, which moved every boundary down by half a point: 24.87
  displayed as "24.9" and banded as Emerging, a band that starts at 25. The
  V1.1 table lists whole-number ranges; scores are continuous, so those are read
  as half-open intervals and matched against the raw value. Scores, weights,
  missing-data handling, display precision and every recommendation and
  opportunity threshold were unchanged. Boundary tests now cover immediately
  below, exactly at and immediately above each edge. *(Corrected before Phase 4;
  no version bump — banding is a display mapping over an unchanged score, so
  historical results remain reproducible.)*
- **The public-id randomness test was probabilistic.** It asserted that a
  22-character base64url id did not contain the substring `q3` — a roughly
  one-in-two-hundred coin flip that duly failed during a clean-install
  rehearsal. Replaced with the property that actually matters and is not
  probabilistic: eight Pulses created from identical configuration get eight
  distinct ids. *(Phase 4; a test defect, not a product one.)*
- **Stored answers validate against a completeness-relaxed schema.** Re-applying
  the submission-time schema on read would make a Pulse containing one partial
  response permanently unanalysable, even though the scoring engine has an
  explicit missing-data rule for exactly that case. Unknown ids, wrong types,
  invalid option ids and over-long selections still fail. *(Phase 3.)*

---

## Implementation

### Phase 0 — deterministic core engine

Versioned survey schema (Q1–Q28 + Q19b), five-dimension scoring, the
classification ladder, organization aggregation, the 10-rule recommendation
engine with ranking and deduplication, the Opportunity Map, privacy thresholds
and export shaping — all framework-independent in `src/core`, with an ESLint
rule forbidding React, Hono and Cloudflare imports there. A committed
75-response synthetic fixture exercises every rule.
[docs/phase-0.md](phase-0.md)

### Phase 1 — employee survey experience

The public section-based survey at `/p/{publicId}`, local drafts, D1
submission with server-side validation, the browser-local personal result, the
soft duplicate marker, and the closed / not-yet-open / already-submitted
states. [docs/phase-1.md](phase-1.md)

### Phase 2 — admin authentication and Pulse management

Deployment-level passcode with PBKDF2-HMAC-SHA256 and constant-time comparison,
HMAC-signed HttpOnly session cookies, login throttling, first-run organization
setup, and the Pulse lifecycle: create, edit, close, duplicate, delete — with
configuration locking once the first response arrives. Shared-device result
cleanup. [docs/phase-2.md](phase-2.md)

### Phase 3 — organization results and discovery dashboard

The results API and dashboard: five dimensions with distributions and coverage,
recommendation cards showing measured value beside threshold, classification
distribution, barriers, training demand, the Opportunity Map with the Guardrail
banner, privacy-safe single-dimension segmentation, and the isolated Q27
viewer. A presentation layer over the engine — React computes no score,
threshold, ranking or suppression decision. [docs/phase-3.md](phase-3.md)

### Phase 4 — exports, public demo, release readiness

Three protected export routes (privacy-limited response CSV, isolated free-text
CSV, aggregate results JSON) with server-side gating and formula-injection
protection; the export UI; the public synthetic demo at `/demo` and the public
methodology page at `/methodology`, both running the real engine over the
committed fixture and structurally unable to read D1; the documentation set;
and the security, privacy and terminology audits.
[docs/phase-4.md](phase-4.md)

---

## Version constants

Pinned in [`src/core/versions.ts`](../src/core/versions.ts):

```text
surveyVersion               1.1.0
scoringVersion              1.1.0
recommendationEngineVersion 1.1.0
```

Every response records the survey version it was collected under, and every
analysis and export identifies all three. These strings are never edited in
place — a new version is added instead, so historical results stay reproducible
under the version that produced them.
