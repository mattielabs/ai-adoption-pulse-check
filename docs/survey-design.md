# Survey design

Why the questionnaire is shaped the way it is. The questions themselves are
defined once, in [`src/core/survey/questions.ts`](../src/core/survey/questions.ts),
which every other part of the system reads. Scoring is in
[methodology.md](methodology.md).

---

## Shape

28 core questions plus one additional diagnostic (Q19b), in eight sections, plus
up to three organization-specific questions. Target completion 7–10 minutes —
specified, and **not yet pilot-validated**.

| Section | Questions | Purpose |
|---|---|---|
| 1. About Your Work | Q1–Q3 | Optional work context, for aggregate grouping only |
| 2. Current AI Use | Q4–Q7 | Adoption, plus tools and use cases |
| 3. Confidence | Q8–Q11 | Self-reported confidence |
| 4. How AI Fits Into Your Workflow | Q12–Q15 | Workflow maturity and artifacts |
| 5. Safe & Responsible Use | Q16–Q19b | Safety behaviour, approved-tool clarity, unmanaged tools |
| 6. Organizational Support | Q20–Q23 | Enablement and barriers |
| 7. Learning & Development | Q24–Q25 | Training demand and format |
| 8. Workflow & Opportunity Discovery | Q26–Q28 | Pain, written answer, interest |

Sections are presented one at a time with visible progress. Answers are drafted
to `localStorage` on every change and sent only on submit — no partial response
reaches the server.

---

## Machine values are separate from wording

Every question and option has a **stable machine id** stored in D1 and a
**display label** that can be rewritten freely. `few_times_week` means the same
thing forever; the sentence beside it does not have to.

This is why a wording improvement is not a data migration, and why historical
responses stay interpretable. It also means the exports contain option ids
rather than prose, which is less readable and much less ambiguous.

---

## Decisions worth explaining

### Q1–Q3 are optional and deliberately broad

Twelve departments, seven role levels, six work types — plus "Other" and "Prefer
not to say" on all three. Narrower categories would segment better and identify
people faster. They are never scored, and never appear at row level in an export.

### Q4 is diagnostic only

"How often do you use generative AI generally" does not feed Adoption. Only Q5
(work-related use) does. Somebody who uses AI constantly at home and never at
work has low work Adoption, and the two figures side by side are a more
interesting finding than an average of them.

### Q6 is diagnostic only, and tool count is never maturity

Using six tools is not better than using one well. The count is never scored.

### Q7 and Q26 share a category list

Twelve **shared** workflow categories appear in both "what do you use AI for"
and "what takes significant time". That alignment is by construction — a
module-load assertion fails the application if the two definitions ever drift
apart — which is what lets the Opportunity Map compare them exactly instead of
guessing at a mapping. Q7 has extra usage-only categories, and Q26 has extra
pain-only categories; only the shared twelve are compared.

### Confidence asks about four distinct acts

Giving clear instructions, adding context when the first answer is not good
enough, judging whether an answer is right, and deciding when AI is the wrong
tool. Equal weight. Every one is preceded by "how confident are you", and the
scale includes **"I have not done this"**, which is recorded as not-assessed
rather than scored as zero.

### Q12 is a pure ordinal ladder

Six steps from "I do not use AI for work" to "I have built AI workflows,
automations or tools". An earlier draft mixed helping coworkers into the same
scale, which made the ladder non-monotonic — helping a colleague is not a later
stage than building an automation, it is a different axis. That evidence moved
to Q15.

### Q15 is evidence, not a score

Reusable prompts, shared libraries, custom GPTs, automations, agents,
applications, documentation, helping coworkers. Never scored; used to
corroborate a classification and the champion signal. It also includes "I am not
sure what some of these mean", which is itself worth knowing.

### Q16 and Q17 measure behaviour, Q18 measures awareness

Verification and human review are things people do. Q18 asks whether they know
what must not be entered into a tool — which is about the respondent, not about
whether the organization ever told them. That is Q20's job, and separating them
is what lets a recommendation distinguish "nobody knows the rule" from "there is
no rule".

### Q19 is Enablement, not Safety

Knowing which tools are approved is a measure of organizational clarity. Putting
it in Safety would have made an organization look unsafe because it had not
published a tool list, which is a different problem with a different fix.

### Q19b is neutral by construction

"How often do you use AI tools or accounts for work that were not provided by
your organization" is the unmanaged-AI discovery signal. The helper text says
explicitly that this does not necessarily mean the tool is prohibited. It is
never scored. "Prefer not to say" is excluded from the rate denominator and
reported separately, so declining to answer never counts as an admission.

### "Unsure" is never silently 50

Every scale that includes Unsure, Not applicable or "I have not done this"
handles it explicitly: excluded as not-assessed where it means "no basis to
answer", scored 0 where it means "this resource has not reached me". The rate is
always shown beside the score. Mapping unknowns to the midpoint would invent a
neutral opinion nobody expressed.

### Q23, Q24, Q25 cap selections

Three barriers, three training topics, two learning formats. A cap forces
prioritisation; an uncapped multi-select produces a list where everything is
equally important.

### Q27 is optional, capped, and prompted carefully

The written answer is the highest-value field in the survey and the highest
risk. The helper text asks people to describe the task rather than paste
content: *"Turning meeting notes into follow-up actions"* rather than actual
meeting notes. Capped at 1,000 characters. Never scored, never segmentable,
never read by a model.

### Q28 is Interest, never maturity

Willingness is not adoption. Interest is reported separately and drives
recommendations only in combination — high Interest with low Enablement means
something specific, and neither number means it alone.

---

## Custom questions

Up to three per Pulse, keyed by **position** (`c1`–`c3`) rather than by database
row id, so the public payload carries no internal identifier. They never
participate in scoring, classification or recommendations, and are validated
against the Pulse's own configuration on submission — an answer to a question
this Pulse never configured is rejected.

Select-type custom answers appear in the response CSV. Custom free-text answers
are stored and never exported, for the same reason Q27 has its own file. See
[running-a-pulse.md](running-a-pulse.md) for the trap: a custom question that
narrows the group defeats Q1–Q3's deliberate breadth.

---

## What the survey deliberately does not ask

Name, email, employee ID, job title, team, manager, tenure, location, age, or
anything else that would identify or narrow. Not a satisfaction question, not a
performance question, and no comparison with coworkers.

---

## Validation

The same Zod schema validates a submission in the browser and in the Worker.
Rejected: unknown question ids, wrong types, option ids that do not exist,
selections beyond a question's cap, free text over the limit, payloads over
32 KB, and a survey version the deployment cannot score.

Stored responses are re-validated on read against a variant that is identical
except that it does not require completeness — a stored response may legitimately
be missing an answer, and the scoring engine's missing-data rule exists for
exactly that case. Everything else stays strict.
