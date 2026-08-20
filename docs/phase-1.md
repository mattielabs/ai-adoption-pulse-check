# Phase 1 — Employee Survey Experience

**Goal:** an employee can open a valid Pulse URL, complete the survey on desktop or mobile, submit it without providing any direct identifier, and receive their optional personal result — end to end against the real Worker and real D1.

Phase 0 built the deterministic engine; Phase 1 put the employee experience on top of it without touching methodology.

---

## The employee flow

```text
/p/:publicId
   ↓
Landing (privacy explanation, estimated time, section/question counts)
   ↓
8 core sections  (+ 1 "Additional questions from your organization" section
   ↓              when the Pulse has custom questions)
Local draft persisted on every change
   ↓
Review (per-section completion, jump-back editing, sensitive-info reminder)
   ↓
POST /api/pulses/:publicId/responses   (server re-validates everything)
   ↓
Personal result (local calculation)  ·  or plain confirmation when disabled
```

Availability states handled before any survey renders: **not found** (generic,
identical for unknown and unpublished ids), **not yet open** (`opens_on` in the
future), **closed** (status closed or `closes_on` passed). The server is
authoritative — a page loaded while a Pulse was open cannot submit after it
closes.

## Public API

| Endpoint | Behaviour |
|---|---|
| `GET /api/pulses/:publicId` | Public survey configuration only: name, description, availability, open/close dates, `personalResultsEnabled`, survey version, organization name/logo/accent/intro, custom questions keyed `c1`–`c3`. No internal ids, no counts, no admin data. Unknown and draft ids return the identical generic 404. |
| `POST /api/pulses/:publicId/responses` | One complete response. Order: 32 KB size gate → Zod schema (required questions, option validity, selection limits, Q27 ≤ 1000 chars) → Pulse exists → availability → survey-version match (409 on mismatch) → custom answers validated against the Pulse's configured questions → insert. Returns 201, or 409 `not_accepting_responses` / `survey_version_mismatch`, or 400 with field paths only (values never echoed). |

Availability semantics (documented, tested): dates are day-granular and
compared against the **UTC** day; a Pulse is open **on** `opens_on` and accepts
responses **through** `closes_on` inclusive; `draft` status is a 404.

## Data persistence

- One row per response: `pulse_id`, `submitted_on` (YYYY-MM-DD, UTC day),
  `survey_version`, `answers_json`, `custom_answers_json`. Nothing else — the
  column set is closed and unit tests assert the INSERT binds exactly these
  five values.
- No IP address, user agent, fingerprint, cookie, email, name, or employee ID
  is read or stored anywhere on the write path.
- Custom answers are stored keyed by position (`c1`–`c3`), never by database
  row id, and never participate in scoring or classification.

## localStorage keys (browser-local convenience only)

| Key | Purpose |
|---|---|
| `pulse-check:draft:{publicId}:{surveyVersion}` | In-progress answers + current section (+ day-granular `updatedOn`). Version-scoped: a draft from another survey version is discarded, never migrated. Cleared **only after** the server confirms persistence. |
| `pulse-check:submitted:{publicId}` | Soft duplicate marker. Honest copy: it prevents accidental duplicates on this browser and neither identifies the respondent nor guarantees one response per employee. |
| `pulse-check:result:{publicId}` | The employee's own result snapshot (only when personal results are enabled), so "View my result" works on a return visit. Local-only. |

All storage access is fault-tolerant: with storage disabled, the survey still
works — it just cannot save drafts or show the duplicate notice.

## Privacy behaviour

- Landing copy uses the approved framing: no name/email/employee ID/account
  information; group-size protection for organization reporting; written
  answers can contain identifying details if the employee includes them; do
  not enter confidential/sensitive information. No anonymity claim anywhere.
- Q27 (and custom free text): plain text only — no Markdown, no HTML
  rendering; capped at 1,000 characters client- and server-side; never echoed
  into the result screen; never logged (`onError` logs error name/message
  only, and validation errors return field paths without values).
- No fingerprinting, no IP blocking, no identity cookies, no login.

## Personal result

- Calculated **locally in the browser** with the same versioned core modules
  the Worker uses (`calculateScores`, `classifyRespondent`); no second request,
  never sent to the server.
- Shows: behaviour classification, Adoption, Confidence ("your self-reported
  confidence…"), Workflow, Safety ("your self-reported verification…"), and
  Enablement as **Organization Support Experience** ("based on your answers
  about approved tools, guidance, access, and training") — never personal
  ability.
- Scores display with **one decimal place** (49.9, not 50) so the display can
  never contradict the engine's raw-score thresholds. No rounding happens
  before threshold logic; formatting is display-only.
- Personal focus: exactly 1 Primary Focus + 1 Suggested Next Step from a
  small deterministic ruleset (`src/core/personal/focus.ts`), separate from
  the organization recommendation engine, evaluated first-match in fixed
  order: strengthen-safety → document-workflow → start-small →
  make-repeatable → consolidate. Exhaustively tested.
- No coworker comparison, no percentile, no leaderboard, no champion claims.

## Accessibility & mobile (validated in E2E)

- Every question is a `fieldset` with the prompt as `legend`; helper and error
  text are wired via `aria-describedby`; all controls have associated labels —
  the E2E suite drives the entire survey through role+name selectors, which
  fails if any label breaks.
- Section changes move focus to the heading; validation failures render a
  `role="alert"` summary plus per-question error text and move focus to the
  first affected question; a visually-hidden live region announces error
  counts.
- Progress is text first ("Section 3 of 9") with an ARIA `progressbar`; state
  is never colour-only; controls are ≥ 44 px touch targets; the accent colour
  is contrast-checked (WCAG relative luminance) before white text is used on
  it; animation is `motion-safe` gated.
- The full completion flow runs at a 375×812 touch viewport asserting no
  horizontal scrolling at any step.

## Development data

`scripts/dev-seed.sql` (via `npm run db:seed:local`, or `npm run dev:setup`
for migrate + seed) creates five synthetic dev Pulses under fixed `dev-*`
public ids: active with 3 custom questions, active plain, active with personal
results disabled, closed, and future-opening. Idempotent; touches only its own
rows; local database only.

## Known limitations

1. ~~No admin surface~~ — Phase 2 added authentication and Pulse management;
   Pulses no longer depend on seed data. See [phase-2.md](phase-2.md).
2. ~~Only two API endpoints exist~~ — the admin API arrived in Phase 2.
3. The landing "not yet open" message shows the raw `YYYY-MM-DD` date.
4. Draft persistence writes on every answer change (no debounce) — harmless at
   this payload size.
5. The duplicate marker is per-browser by design; private windows or a second
   device can submit again. The UI says so honestly.
6. Availability uses the UTC day, so a Pulse closing on date X stops accepting
   at midnight UTC, not the organization's local midnight. Documented here and
   in the availability module; revisit only if a real pilot trips on it.

## What Phase 1 deliberately excluded

Admin login/passcode/session, organization setup UI, and Pulse creation and
management — all delivered in [Phase 2](phase-2.md). Dashboards, charts,
Opportunity Map UI, filtering UI, exports UI, historical comparison, the public
demo, PDF, and any LLM functionality remain out of scope.

One Phase 1 behaviour was extended in Phase 2: the locally stored personal
result can now be cleared from the result screen, for shared devices. Clearing
removes only the local snapshot — the submitted response and the duplicate
marker are untouched.
