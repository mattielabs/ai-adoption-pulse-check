# Contributing

Thanks for looking. This is an open-source portfolio project by Mattie Labs, and
the most useful contributions are the ones that challenge the methodology or
find a hole in the privacy model.

---

## Setup

```bash
npm install
npm run validate
```

`npm run validate` runs typecheck → lint → unit tests → build. It needs no
database, no secrets and no network. If it passes, your checkout is sound.

For the browser flows:

```bash
npx playwright install chromium
npm run test:e2e
```

The E2E suite starts a real Worker against its own throwaway D1 database in
`.wrangler/e2e-state`, recreated empty every run, so it never touches your local
development data.

Full setup, including a real deployment, is in
[docs/self-hosting.md](docs/self-hosting.md).

---

## Before opening a pull request

- `npm run validate` passes.
- `npm run test:e2e` passes if you touched the client, the API surface, or
  anything user-facing.
- New behaviour has a test. Changed behaviour has a changed test, and the diff
  makes it obvious which assertion moved and why.
- Comments explain **why**, not what. The existing code is written that way;
  please match it.
- No new dependency without a stated reason. The project deliberately has no
  chart library, no date library, no state-management library and no AI SDK.

## Where code goes

```text
src/core/     methodology. No React, no Hono, no Cloudflare APIs (ESLint-enforced)
src/server/   the single Hono Worker
src/client/   the React SPA
```

The rule that matters: **no scoring, classification, recommendation, threshold
or privacy logic in a component or a route handler.** It belongs in `src/core`
so the same versioned code runs in the browser, in the Worker, against the demo
fixture, and in Vitest. A React component may format a number; it may not decide
what the number means.

---

## Changing methodology

Please read this part before proposing a change to any of the following:

- survey wording or options;
- scoring weights or score mappings;
- the classification ladder;
- recommendation rules, thresholds, priorities or deduplication;
- Opportunity Map thresholds or labels;
- the minimum reporting threshold or the complement rule;
- score band boundaries.

These are not implementation details. They define what a number **means**, and
changing one silently makes every previous Pulse incomparable to every future
one without anybody noticing.

`AI_Adoption_Pulse_Check_Source_of_Truth_v1.1` in the repository root is the
authoritative specification. Where the code and that document disagree, the
discrepancy is a bug to resolve — not a licence to change methodology.

A methodology proposal should say:

1. **What is wrong now**, with a concrete case where the current rule produces a
   misleading result.
2. **What the new rule is**, precisely enough to implement without further
   judgement.
3. **What it does to historical data.** Do existing Pulses still mean the same
   thing? If not, this needs a version bump.
4. **Which tests change**, and why the old expectation was wrong rather than
   merely inconvenient.

Version constants live in [`src/core/versions.ts`](src/core/versions.ts) and are
never edited in place — a new version is added, so historical results stay
reproducible. If your change alters what a score means, it needs a new
`scoringVersion`; if it alters what an answer means, a new `surveyVersion`.

Corrections that make the code match the specification more exactly are a
different and much easier case — see the band-boundary fix in
[docs/changelog.md](docs/changelog.md#v11-implementation-corrections) for the
shape of one.

---

## Changing privacy behaviour

Anything that widens what leaves the server needs the same care, plus a note in
[docs/threat-model.md](docs/threat-model.md).

Specifically: the minimum reporting threshold, the complement check, the
one-dimension segmentation rule, what appears in an export, and anything that
would put Q27 in the same request, file or query as another answer. Several of
these are enforced structurally rather than by a check — for instance, the
free-text endpoint takes no filter argument at all — and a refactor that turns a
structural guarantee into a conditional is a regression even if every test still
passes.

---

## Reporting a security or privacy issue

Please open an issue describing the impact without including any real
respondent data. If you believe the issue is sensitive, say so in the issue and
leave out the specifics until there is somewhere private to send them.

Findings that would be especially valuable:

- a way to reach an aggregate below the reporting threshold;
- a way to associate a written response with any other answer;
- a way for the public demo to return anything other than the committed
  fixture;
- an export that carries something the dashboard would not show.

---

## Good first contributions

- Pilot evidence. Every threshold in the product is specified and **not yet
  validated** — real completion times, drop-off points and score distributions
  would be worth more than any feature.
- Accessibility findings, especially from actual assistive-technology use.
- Documentation that is wrong, out of date, or assumes knowledge the reader does
  not have.
- Wording that overstates what the survey can prove. That is the failure mode
  this project cares most about avoiding.

---

## Licence

By contributing you agree that your contribution is licensed under the MIT
licence, the same as the rest of the project.
