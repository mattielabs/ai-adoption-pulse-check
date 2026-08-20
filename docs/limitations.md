# Limitations

Every limitation below is real and current. Several are deliberate scope
decisions rather than gaps; those are marked as such. Nothing here is a
roadmap promise.

---

## Measurement

**Everything is self-report.** Nobody is observed, tested or audited. Confidence
measures how confident people feel; Safety measures what people say they do.
A short survey cannot establish skill, safety, or compliance.

**Safety is asymmetric, and that is the honest reading.** A low score is a
meaningful warning. A high score is not proof of safe behaviour, because the
same reporting bias runs both ways.

**Thresholds are specified, not validated.** The 40/50/60/70 recommendation
thresholds, the 60% valid-weight rule, the 20% pain rate, the 40% AI-use rate,
the five-response reporting minimum and the band edges all come from the V1.1
specification. None has been checked against pilot data. They are the most
likely thing in the product to be wrong, and they are all in named constants so
that changing one is a deliberate, versioned act.

**Scores are presented as 0–100.** That may read as more precision than a short
self-report survey deserves. The dashboard mitigates it with medians,
distributions, coverage counts and a sample caveat below 30 responses, but the
scale itself is a pilot question.

**No causal claims.** The tool can say Adoption is high while Safety is low. It
cannot say one caused the other.

**Opportunity ≠ automation readiness.** An Explore or Standardize label means a
workflow is worth investigating. It says nothing about feasibility, effort, time
saved or return on investment, and the survey has no way to see any of those.

**Small samples.** Below 30 responses, differences between dimensions are not
reliably meaningful. Below 10 the results carry an explicit early-directional
caution. Below 5 nothing is computed.

**Non-response bias is invisible.** If the people who ignore the survey are the
people who do not use AI, Adoption is overstated, and nothing in the data
reveals it.

---

## Privacy

**Not anonymous, and never claimed to be.** No direct identifiers are collected
and small groups are suppressed. Somebody can still identify themselves in a
written answer, and a manager who already knows a situation can recognise it.
Full analysis in [threat-model.md](threat-model.md).

**Segmentation is often unavailable in small organizations.** A segment needs
five respondents *and* five outside it. At 10–25 employees most departments
report nothing, which is correct behaviour and still a real limitation on
usefulness.

**A self-hoster can query their own database.** The product's restraint governs
what the product hands out, not what the owner of the infrastructure can do.

**Exports leave the model behind.** Once a CSV is downloaded it can be joined to
anything the holder also has.

**No row-level work-context export, and no way to enable one.** Deliberate.

---

## Product scope

Deliberate V1 exclusions, each with a reason:

| Not built | Why |
|---|---|
| Trend / longitudinal engine | Comparing two Pulses meaningfully needs stable methodology and pilot data first |
| Benchmarking between organizations | There is no dataset, and inventing one would be fabricated evidence |
| PDF reports | The dashboard and the JSON export cover the need |
| LLM summaries or free-text clustering | The whole point is that the methodology is inspectable and deterministic |
| Employee or admin user accounts, SSO, RBAC | One deployment, one credential; anything more is an authentication product |
| Email invitations, HRIS / Slack / Teams integrations | Each is an integration surface with its own privacy questions |
| Aggregate caching | Measured at 3.8 ms for 75 responses and 17.4 ms for 500. A cache would buy nothing and cost an invalidation problem |
| Stacked demographic filters | Re-identification risk, removed in V1.1 |
| Per-workflow Enable / Scale / Guardrail labels | Survey evidence cannot support them |
| Editing the core survey | It would break comparability and the scoring contract |
| Docker / host-anywhere distribution | Would mean a second storage layer for no V1 user benefit |

---

## Operations

**Cloudflare-only.** Workers plus D1. Stated, not hidden.

**One administrator credential.** No accounts, no roles, no recovery flow, no
per-action audit log. Everyone with the passcode is the same administrator.

**Closed Pulses cannot be reopened.** Duplicate instead.

**Login throttling fails open.** If Cloudflare's rate limiter is unreachable,
login proceeds without throttling rather than locking out the only
administrator. The passcode hash and constant-time comparison still apply.

**Rotating the passcode does not invalidate existing sessions** (up to 8 hours).
Rotating `SESSION_SECRET` does, immediately.

**No migration path for a scoring change.** Historical responses stay
interpretable because every response records its survey version, and the
analysis refuses to mix versions — but if scoring changes, comparing an old
Pulse to a new one is a manual exercise.

**Custom questions are the one place collection can widen.** A badly chosen
custom question can undo Q1–Q3's deliberate breadth. The product warns; it
cannot prevent.

---

## Engineering

**Not pilot-tested with real employees.** Completion time, drop-off, and whether
Q15's terminology confuses people are all open questions. The pilot plan is in
the source of truth, §67.

**No load testing beyond the V1 target.** Analysis was measured at 75 and 500
responses. Nothing establishes behaviour at 5,000, and V1 does not target it.

**Accessibility is validated but not audited.** Semantic tables, labelled
controls, focus management on navigation, `role="status"` on live regions, and
mobile flows tested at 375×812 with no horizontal overflow. No formal WCAG audit
and no screen-reader user testing.

**English only.** No internationalisation, and the survey wording is the
methodology — a translation is a methodology change.

**Browser support is untested outside Chromium.** The E2E suite runs Chromium
only. Nothing in the client is exotic, but that is an assumption rather than a
result.
